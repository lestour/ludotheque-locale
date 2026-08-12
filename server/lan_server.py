#!/usr/bin/env python3

import argparse
import base64
import collections
import hashlib
import json
import mimetypes
import os
import random
import re
import secrets
import socket
import ssl
import struct
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
ROOM_CODE_PATTERN = re.compile(r"^[A-HJ-NP-Z2-9]{6}$")
GAME_PATTERN = re.compile(r"^games/[a-z0-9/_-]+\.html$")
PLAYER_NAME_PATTERN = re.compile(r"^[^<>\x00-\x1f]{1,24}$")
MAX_BODY_SIZE = 64 * 1024
MAX_ROOMS = 100
MAX_PLAYERS = 8
ROOM_IDLE_SECONDS = 4 * 60 * 60
PRESENCE_TIMEOUT_SECONDS = 12
EMPTY_ROOM_GRACE_SECONDS = 90
MAX_EVENTS = 600
PRIVATE_COLOR_GAME = "games/cards/modern/derniere-couleur.html"
TWO_PLAYER_GAMES = {"games/board/chess.html", "games/board/go.html"}
COLOR_GAME_COLORS = ("red", "yellow", "green", "blue")


def validate_public_action(game, value):
    if not isinstance(value, dict):
        raise ValueError("Action de jeu invalide.")
    action_type = value.get("type")
    if game == "games/cards/classic/bataille.html":
        if action_type != "draw" or not isinstance(value.get("round"), int) or value["round"] < 0:
            raise ValueError("Action de bataille invalide.")
        return {"type": "draw", "round": value["round"]}
    if game == "games/cards/classic/bataille-corse.html":
        if action_type not in {"corse-play", "corse-slap"}:
            raise ValueError("Action de bataille corse invalide.")
        result = {"type": action_type}
        if isinstance(value.get("controlledSeat"), int) and 0 <= value["controlledSeat"] < MAX_PLAYERS:
            result["controlledSeat"] = value["controlledSeat"]
        return result
    if game == "games/cards/modern/totem-reflexe.html":
        if action_type not in {"totem-draw", "totem-slap"}:
            raise ValueError("Action de totem invalide.")
        result = {"type": action_type}
        if isinstance(value.get("controlledSeat"), int) and 0 <= value["controlledSeat"] < MAX_PLAYERS:
            result["controlledSeat"] = value["controlledSeat"]
        return result
    if game == "games/cards/modern/symbole-unique.html":
        if action_type == "symbol-start":
            return {"type": action_type}
        symbol = value.get("symbol")
        if action_type != "symbol-claim" or not isinstance(symbol, str) or not 1 <= len(symbol) <= 8 or any(ord(character) < 32 for character in symbol):
            raise ValueError("Action de symbole invalide.")
        result = {"type": action_type, "symbol": symbol}
        if isinstance(value.get("target"), int) and 0 <= value["target"] < MAX_PLAYERS:
            result["target"] = value["target"]
        if isinstance(value.get("controlledSeat"), int) and 0 <= value["controlledSeat"] < MAX_PLAYERS:
            result["controlledSeat"] = value["controlledSeat"]
        return result
    if game == "games/board/chess.html":
        coordinates = lambda item: isinstance(item, list) and len(item) == 2 and all(isinstance(number, int) and 0 <= number < 14 for number in item)
        if action_type != "board-move" or not coordinates(value.get("from")) or not coordinates(value.get("to")):
            raise ValueError("Déplacement de plateau invalide.")
        result = {"type": action_type, "from": value["from"], "to": value["to"]}
        if value.get("promotion") in {"q", "r", "b", "n"}:
            result["promotion"] = value["promotion"]
        if isinstance(value.get("controlledSeat"), int) and 0 <= value["controlledSeat"] < MAX_PLAYERS:
            result["controlledSeat"] = value["controlledSeat"]
        return result
    if game == "games/board/go.html":
        if action_type == "go-move" and isinstance(value.get("index"), int) and 0 <= value["index"] < 361:
            result = {"type": action_type, "index": value["index"]}
        elif action_type == "go-pass":
            result = {"type": action_type}
        else:
            raise ValueError("Action de Go invalide.")
        if isinstance(value.get("controlledSeat"), int) and 0 <= value["controlledSeat"] < MAX_PLAYERS:
            result["controlledSeat"] = value["controlledSeat"]
        return result
    raise ValueError("Ce jeu n’accepte pas d’action publique synchronisée.")


def color_game_rule(room, name, default=False):
    value = room.get("options", {}).get(name, default)
    return value is True or str(value).lower() in {"1", "true", "yes", "on"}


def color_game_deck(room, private_seed):
    cards = []
    card_id = 0

    def add(color, value):
        nonlocal card_id
        cards.append({"id": card_id, "color": color, "value": value})
        card_id += 1

    for color in COLOR_GAME_COLORS:
        add(color, 0)
        for value in range(1, 10):
            add(color, value)
            add(color, value)
        for value in ("skip", "reverse", "draw2"):
            add(color, value)
            add(color, value)
    for _ in range(4):
        add("wild", "wild")
        add("wild", "draw4")
    if color_game_rule(room, "extraCards"):
        for _ in range(2):
            add("wild", "swap")
            add("wild", "shuffle")
    random.Random(private_seed).shuffle(cards)
    return cards


def color_game_log(state, message):
    state["logs"].insert(0, message)
    del state["logs"][8:]


def color_game_name(room, seat):
    seats = public_seats(room)
    return seats[seat]["label"] if 0 <= seat < len(seats) else f"Joueur {seat + 1}"


def color_game_next(state, seat, steps=1):
    target = seat
    for _ in range(steps):
        target = (target + state["direction"] + len(state["hands"])) % len(state["hands"])
    return target


def color_game_refill(state):
    if state["deck"] or len(state["discard"]) < 2:
        return
    top = state["discard"].pop()
    state["deck"] = state["discard"]
    random.Random(f"{state['seed']}:{state['turnNumber']}").shuffle(state["deck"])
    state["discard"] = [top]


def color_game_draw(state, seat, count):
    drawn = []
    for _ in range(count):
        color_game_refill(state)
        if not state["deck"]:
            break
        card = state["deck"].pop()
        state["hands"][seat].append(card)
        drawn.append(card)
    return drawn


def color_game_can_play(room, state, card, seat):
    if state.get("chain"):
        return seat == state["current"] and card["value"] == state["chain"]
    pending = state.get("pending")
    if pending:
        if not color_game_rule(room, "stacking"):
            return False
        if card["value"] == pending["type"]:
            return True
        return pending["type"] == "draw4" and card["value"] == "draw2" and color_game_rule(room, "drawTwoOnFour")
    if card["color"] == "wild":
        if card["value"] != "draw4" or not color_game_rule(room, "strictFour", True):
            return True
        return not any(other["color"] == state["color"] for other in state["hands"][seat])
    top = state["discard"][-1]
    return card["color"] == state["color"] or card["value"] == top["value"]


def color_game_can_jump(room, state, card, seat):
    top = state["discard"][-1]
    return color_game_rule(room, "jumpIn") and not state.get("pending") and not state.get("chain") and seat != state["current"] and card["color"] == top["color"] and card["value"] == top["value"]


def color_game_finish(room, winner):
    state = room["gameState"]
    state["over"] = True
    state["winner"] = winner
    room["phase"] = "finished"
    room["results"] = {}
    for index, seat in enumerate(room["seats"]):
        key = seat.get("playerId") or f"bot-{index}"
        room["results"][key] = {
            "score": 1 if index == winner else 0,
            "scoreLabel": "Victoire" if index == winner else "Défaite",
            "won": index == winner,
            "bot": not bool(seat.get("playerId")),
            "seatIndex": index,
        }


def color_game_change_turn(state, seat, steps=1):
    state["current"] = color_game_next(state, seat, steps)
    state["turnNumber"] += 1
    state["mustPlayDrawn"] = None


def color_game_play(room, seat, card_id, selected_color=None, swap_target=None):
    state = room["gameState"]
    hand = state["hands"][seat]
    card = next((candidate for candidate in hand if candidate["id"] == card_id), None)
    if not card:
        raise ValueError("Cette carte ne se trouve pas dans votre main.")
    if state.get("mustPlayDrawn") is not None and card["id"] != state["mustPlayDrawn"]:
        raise ValueError("Seule la carte qui vient d’être piochée peut être jouée.")
    if seat != state["current"] and not color_game_can_jump(room, state, card, seat):
        raise ValueError("Ce n’est pas votre tour.")
    if not color_game_can_play(room, state, card, seat) and not color_game_can_jump(room, state, card, seat):
        raise ValueError("Cette carte ne peut pas être jouée.")
    if card["color"] == "wild" and selected_color not in COLOR_GAME_COLORS:
        raise ValueError("Choisissez une couleur pour le joker.")
    previous_color = state["color"]
    previous_pending = state.get("pending")
    hand.remove(card)
    state["discard"].append(card)
    state["color"] = selected_color if card["color"] == "wild" else card["color"]
    state["mustPlayDrawn"] = None
    state["chain"] = None
    state["lastDrawFour"] = {"seat": seat, "legal": not any(other["color"] == previous_color for other in hand)} if card["value"] == "draw4" else None
    color_game_log(state, f"{color_game_name(room, seat)} joue une carte {card['value']}.")
    if card["value"] == "swap":
        target = int(swap_target) if isinstance(swap_target, int) or str(swap_target).isdigit() else color_game_next(state, seat)
        if target == seat or not 0 <= target < len(state["hands"]):
            raise ValueError("Joueur d’échange invalide.")
        state["hands"][seat], state["hands"][target] = state["hands"][target], state["hands"][seat]
    elif card["value"] == "shuffle":
        sizes = [len(cards) for cards in state["hands"]]
        cards = [item for cards in state["hands"] for item in cards]
        random.Random(f"{state['seed']}:shuffle:{state['turnNumber']}").shuffle(cards)
        state["hands"] = [cards[sum(sizes[:index]):sum(sizes[:index + 1])] for index in range(len(sizes))]
    if color_game_rule(room, "multipleNumbers") and isinstance(card["value"], int) and not (color_game_rule(room, "sevenZero") and card["value"] in {0, 7}):
        extras = [other for other in state["hands"][seat] if other["value"] == card["value"]]
        for extra in extras:
            state["hands"][seat].remove(extra)
            state["discard"].append(extra)
            state["color"] = extra["color"]
    if not state["hands"][seat]:
        if card["color"] == "wild" and color_game_rule(room, "wildFinishPenalty"):
            color_game_draw(state, seat, 2)
        else:
            color_game_finish(room, seat)
            return
    state["announcementCandidate"] = seat if len(state["hands"][seat]) == 1 and color_game_rule(room, "announcementPenalty", True) else None
    can_chain = color_game_rule(room, "chainActions") and card["value"] in {"skip", "reverse", "draw2"} and any(other["value"] == card["value"] for other in state["hands"][seat])
    if card["value"] in {"draw2", "draw4"}:
        amount = 2 if card["value"] == "draw2" else 4
        state["pending"] = {"type": card["value"], "count": (previous_pending or {}).get("count", 0) + amount}
        if can_chain:
            state["chain"] = card["value"]
            state["current"] = seat
        else:
            color_game_change_turn(state, seat)
    elif card["value"] == "reverse":
        state["direction"] *= -1
        if can_chain:
            state["chain"] = card["value"]
            state["current"] = seat
        else:
            color_game_change_turn(state, seat, 2 if len(state["hands"]) == 2 else 1)
    elif card["value"] == "skip":
        if can_chain:
            state["chain"] = card["value"]
            state["current"] = seat
        else:
            color_game_change_turn(state, seat, 2)
    else:
        if color_game_rule(room, "sevenZero") and card["value"] == 0:
            state["hands"] = state["hands"][-1:] + state["hands"][:-1] if state["direction"] == 1 else state["hands"][1:] + state["hands"][:1]
        elif color_game_rule(room, "sevenZero") and card["value"] == 7:
            target = int(swap_target) if isinstance(swap_target, int) or str(swap_target).isdigit() else color_game_next(state, seat)
            if target != seat and 0 <= target < len(state["hands"]):
                state["hands"][seat], state["hands"][target] = state["hands"][target], state["hands"][seat]
        color_game_change_turn(state, seat)


def color_game_draw_action(room, seat):
    state = room["gameState"]
    if seat != state["current"]:
        raise ValueError("Ce n’est pas votre tour.")
    if state.get("mustPlayDrawn") is not None:
        state["mustPlayDrawn"] = None
        color_game_change_turn(state, seat)
        return
    if state.get("pending"):
        count = state["pending"]["count"]
        color_game_draw(state, seat, count)
        state["pending"] = None
        color_game_log(state, f"{color_game_name(room, seat)} pioche {count} cartes de pénalité.")
        if color_game_rule(room, "skipPenalty", True):
            color_game_change_turn(state, seat)
        return
    drawn = color_game_draw(state, seat, 1)
    while drawn and color_game_rule(room, "drawUntil") and not color_game_can_play(room, state, drawn[-1], seat) and state["deck"]:
        drawn.extend(color_game_draw(state, seat, 1))
    if drawn and color_game_can_play(room, state, drawn[-1], seat):
        state["mustPlayDrawn"] = drawn[-1]["id"]
    else:
        color_game_change_turn(state, seat)
    color_game_log(state, f"{color_game_name(room, seat)} pioche {len(drawn)} carte(s).")


def color_game_seat(room, player_id):
    return next((index for index, seat in enumerate(room.get("seats", [])) if seat.get("playerId") == player_id), None)


def color_game_bot_seat(room, seat):
    entry = public_seats(room)[seat]
    return entry["controller"] == "bot"


def color_game_bot_turn(room, seat):
    state = room["gameState"]
    if state.get("pending") and not color_game_rule(room, "stacking"):
        color_game_draw_action(room, seat)
        return
    playable = next((card for card in state["hands"][seat] if color_game_can_play(room, state, card, seat)), None)
    if not playable:
        color_game_draw_action(room, seat)
        if state.get("mustPlayDrawn") is not None:
            color_game_play(room, seat, state["mustPlayDrawn"], max(COLOR_GAME_COLORS, key=lambda color: sum(card["color"] == color for card in state["hands"][seat])))
        return
    color = max(COLOR_GAME_COLORS, key=lambda candidate: sum(card["color"] == candidate for card in state["hands"][seat])) if playable["color"] == "wild" else None
    color_game_play(room, seat, playable["id"], color)


def color_game_schedule_bot(room):
    state = room.get("gameState")
    if not state or room["phase"] != "playing" or not color_game_bot_seat(room, state["current"]):
        if state:
            state["botDueAt"] = None
        return
    ranges = {"easy": (1.1, 1.8), "normal": (0.7, 1.2), "hard": (0.35, 0.7)}
    minimum, maximum = ranges.get(str(room.get("options", {}).get("difficulty", "normal")), ranges["normal"])
    generator = random.Random(f"{state['seed']}:delay:{state['turnNumber']}")
    state["botDueAt"] = time.time() + generator.uniform(minimum, maximum)


def color_game_run_due_bot(room, now=None):
    state = room.get("gameState")
    now = now or time.time()
    if not state or room["phase"] != "playing" or not state.get("botDueAt") or state["botDueAt"] > now:
        return False
    if not color_game_bot_seat(room, state["current"]):
        state["botDueAt"] = None
        return False
    state["botDueAt"] = None
    color_game_bot_turn(room, state["current"])
    color_game_schedule_bot(room)
    return True


def color_game_initialize(room):
    private_seed = secrets.token_hex(32)
    deck = color_game_deck(room, private_seed)
    hands = [[] for _ in room["seats"]]
    for _ in range(7):
        for hand in hands:
            hand.append(deck.pop())
    first = deck.pop()
    while first["value"] == "draw4":
        deck.insert(0, first)
        first = deck.pop()
    room["gameState"] = {
        "version": 1,
        "seed": private_seed,
        "hands": hands,
        "deck": deck,
        "discard": [first],
        "color": first["color"] if first["color"] != "wild" else COLOR_GAME_COLORS[0],
        "current": 0,
        "direction": 1,
        "pending": None,
        "chain": None,
        "mustPlayDrawn": None,
        "announcementCandidate": None,
        "lastDrawFour": None,
        "logs": ["La partie LAN commence."],
        "turnNumber": 0,
        "over": False,
        "winner": None,
        "botDueAt": None,
    }
    color_game_schedule_bot(room)


def color_game_public_state(room, player_id):
    state = room.get("gameState")
    if not state:
        return None
    seat = color_game_seat(room, player_id)
    return {
        "version": state["version"],
        "yourSeat": seat,
        "hand": list(state["hands"][seat]) if seat is not None else [],
        "handCounts": [len(hand) for hand in state["hands"]],
        "deckCount": len(state["deck"]),
        "discardCount": len(state["discard"]),
        "discardTop": state["discard"][-1] if state["discard"] else None,
        "color": state["color"],
        "current": state["current"],
        "direction": state["direction"],
        "pending": state["pending"],
        "mustPlayDrawn": state["mustPlayDrawn"] if state["current"] == seat else None,
        "announcementCandidate": state["announcementCandidate"],
        "logs": list(state["logs"]),
        "over": state["over"],
        "winner": state["winner"],
    }


def color_game_action(room, player, action):
    if not isinstance(action, dict):
        raise ValueError("Action Dernière Couleur invalide.")
    state = room.get("gameState")
    seat = color_game_seat(room, player["id"])
    if not state or seat is None or state["over"]:
        raise ValueError("Aucune partie Dernière Couleur active.")
    action_type = action.get("type")
    if action_type == "play":
        color_game_play(room, seat, int(action.get("cardId", -1)), action.get("color"), action.get("target"))
    elif action_type in {"draw", "pass"}:
        color_game_draw_action(room, seat)
    elif action_type == "announce":
        if len(state["hands"][seat]) != 1:
            raise ValueError("L’annonce exige une seule carte en main.")
        state["announcementCandidate"] = None
        color_game_log(state, f"{color_game_name(room, seat)} annonce sa dernière carte.")
    elif action_type == "contest":
        target = state.get("announcementCandidate")
        if target is None or target == seat:
            raise ValueError("Aucune annonce adverse à contester.")
        color_game_draw(state, target, 2)
        state["announcementCandidate"] = None
        color_game_log(state, f"{color_game_name(room, target)} reçoit deux cartes pour oubli d’annonce.")
    elif action_type == "challenge":
        last = state.get("lastDrawFour")
        if (state.get("pending") or {}).get("type") != "draw4" or state["current"] != seat or not last:
            raise ValueError("Aucun +4 ne peut être contesté.")
        if last["legal"]:
            color_game_draw(state, seat, 6)
            state["pending"] = None
            color_game_change_turn(state, seat)
        else:
            color_game_draw(state, last["seat"], 4)
            state["pending"] = None
        state["lastDrawFour"] = None
    else:
        raise ValueError("Action Dernière Couleur inconnue.")
    color_game_schedule_bot(room)


def token_digest(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def public_player(player):
    return {
        "id": player["id"],
        "name": player["name"],
        "ready": player["ready"],
        "connected": player["connected"],
        "joinedAt": player["joinedAt"],
        "asset": player.get("asset"),
    }


def public_seats(room):
    seats = room.get("seats") or [{"playerId": player["id"]} for player in room["players"]]
    players = {player["id"]: player for player in room["players"]}
    result = []
    for index, seat in enumerate(seats):
        player = players.get(seat.get("playerId"))
        if player:
            result.append({
                "index": index,
                "kind": "human",
                "playerId": player["id"],
                "name": player["name"],
                "controller": "human" if player["connected"] else "bot",
                "label": player["name"] if player["connected"] else f"Bot remplaçant de {player['name']}",
            })
        else:
            result.append({"index": index, "kind": "bot", "playerId": None, "name": seat.get("name", f"Bot {index + 1}"), "controller": "bot", "label": seat.get("name", f"Bot {index + 1}")})
    return result


class LanRooms:
    def __init__(self, state_file=None):
        self.rooms = {}
        self.lock = threading.RLock()
        self.state_file = Path(state_file).resolve() if state_file else None
        self.load()

    def disk_state(self):
        rooms = []
        for room in self.rooms.values():
            stored = dict(room)
            stored["rematchVotes"] = sorted(room["rematchVotes"])
            stored["rematchDeclines"] = sorted(room["rematchDeclines"])
            rooms.append(stored)
        return {"version": 1, "savedAt": time.time(), "rooms": rooms}

    def persist(self):
        if not self.state_file:
            return
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.state_file.with_suffix(f"{self.state_file.suffix}.tmp")
        temporary.write_text(json.dumps(self.disk_state(), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        try:
            os.chmod(temporary, 0o600)
        except OSError:
            pass
        temporary.replace(self.state_file)

    def load(self):
        if not self.state_file or not self.state_file.is_file():
            return
        try:
            payload = json.loads(self.state_file.read_text(encoding="utf-8"))
            now = time.time()
            for room in payload.get("rooms", []):
                if not isinstance(room, dict) or not ROOM_CODE_PATTERN.fullmatch(str(room.get("code", ""))):
                    continue
                if now - float(room.get("updatedAt", 0)) >= ROOM_IDLE_SECONDS:
                    continue
                room["rematchVotes"] = set(room.get("rematchVotes", []))
                room["rematchDeclines"] = set(room.get("rematchDeclines", []))
                room["events"] = list(room.get("events", []))[-MAX_EVENTS:]
                room["players"] = list(room.get("players", []))[:MAX_PLAYERS]
                for player in room["players"]:
                    player["connected"] = False
                room["emptySince"] = now
                self.rooms[room["code"]] = room
        except (OSError, TypeError, ValueError, json.JSONDecodeError):
            self.rooms = {}

    def cleanup(self):
        now = time.time()
        deadline = now - ROOM_IDLE_SECONDS
        with self.lock:
            for room in list(self.rooms.values()):
                self.refresh_presence(room, now)
                if room["game"] == PRIVATE_COLOR_GAME and color_game_run_due_bot(room, now):
                    if room["phase"] == "finished":
                        self.emit(room, "finished", {"results": room["results"]})
                    else:
                        self.emit(room, "game-state", {"version": room["gameState"]["version"]})
            expired_codes = [
                code for code, room in self.rooms.items()
                if room["updatedAt"] < deadline or room.get("emptySince") and now - room["emptySince"] >= EMPTY_ROOM_GRACE_SECONDS
            ]
            for code in expired_codes:
                self.rooms.pop(code, None)
            if expired_codes:
                self.persist()

    def refresh_presence(self, room, now=None):
        now = now or time.time()
        disconnected = False
        for player in room["players"]:
            if player["connected"] and now - player["lastSeen"] > PRESENCE_TIMEOUT_SECONDS:
                player["connected"] = False
                disconnected = True
                self.emit(room, "player-disconnected", {"playerId": player["id"]}, player["id"])
        connected = [player for player in room["players"] if player["connected"]]
        current_host = next((player for player in room["players"] if player["id"] == room["hostId"]), None)
        if connected and (not current_host or not current_host["connected"]):
            if current_host:
                current_host["host"] = False
            connected[0]["host"] = True
            room["hostId"] = connected[0]["id"]
            self.emit(room, "host-changed", {"hostId": room["hostId"]}, room["hostId"])
        room["emptySince"] = None if connected else room.get("emptySince") or now
        if disconnected and room["game"] == PRIVATE_COLOR_GAME and room["phase"] == "playing":
            color_game_schedule_bot(room)
        return connected

    def room_code(self):
        for _ in range(100):
            code = "".join(secrets.choice(ROOM_CODE_ALPHABET) for _ in range(6))
            if code not in self.rooms:
                return code
        raise RuntimeError("Impossible de réserver un code de salon.")

    def player(self, name, host=False):
        token = secrets.token_urlsafe(32)
        now = time.time()
        return {
            "id": secrets.token_urlsafe(9),
            "name": name,
            "host": host,
            "ready": False,
            "connected": True,
            "joinedAt": now,
            "lastSeen": now,
            "tokenHash": token_digest(token),
            "asset": None,
        }, token

    def emit(self, room, event_type, payload=None, player_id=None):
        room["sequence"] += 1
        event = {
            "sequence": room["sequence"],
            "type": event_type,
            "payload": payload or {},
            "playerId": player_id,
            "at": time.time(),
        }
        room["events"].append(event)
        room["events"] = room["events"][-MAX_EVENTS:]
        room["updatedAt"] = time.time()
        self.persist()
        return event

    def serialize(self, room, player_id=None, since=0):
        result = {
            "code": room["code"],
            "visibility": room["visibility"],
            "game": room["game"],
            "phase": room["phase"],
            "hostId": room["hostId"],
            "playerId": player_id,
            "players": [public_player(player) for player in room["players"]],
            "seatCount": room["seatCount"],
            "seats": public_seats(room),
            "options": room["options"],
            "seed": room["seed"] if room["phase"] != "lobby" else None,
            "startAt": room["startAt"] if room["phase"] != "lobby" else None,
            "paused": room["paused"],
            "results": room["results"] if room["phase"] == "finished" else {},
            "rematchVotes": list(room["rematchVotes"]),
            "rematchDeclines": list(room["rematchDeclines"]),
            "sequence": room["sequence"],
            "events": [event for event in room["events"] if event["sequence"] > since],
        }
        if room["game"] == PRIVATE_COLOR_GAME and room["phase"] != "lobby":
            result["gameState"] = color_game_public_state(room, player_id)
        return result

    def create(self, name, game, visibility, options, seat_count=2):
        self.cleanup()
        with self.lock:
            if len(self.rooms) >= MAX_ROOMS:
                raise ValueError("Le nombre maximal de salons LAN est atteint.")
            code = self.room_code()
            host, token = self.player(name, True)
            now = time.time()
            room = {
                "code": code,
                "visibility": visibility,
                "game": game,
                "phase": "lobby",
                "hostId": host["id"],
                "players": [host],
                "seatCount": validate_game_seat_count(game, seat_count),
                "seats": [],
                "options": options,
                "seed": None,
                "startAt": None,
                "paused": False,
                "results": {},
                "rematchVotes": set(),
                "rematchDeclines": set(),
                "sequence": 0,
                "events": [],
                "createdAt": now,
                "updatedAt": now,
                "emptySince": None,
                "gameState": None,
            }
            self.rooms[code] = room
            self.emit(room, "room-created", {"visibility": visibility}, host["id"])
            return self.serialize(room, host["id"]), token

    def join(self, code, name, game=None):
        self.cleanup()
        with self.lock:
            room = self.rooms.get(code)
            if not room:
                raise LookupError("Salon introuvable ou expiré.")
            if room["phase"] != "lobby":
                raise ValueError("Cette partie a déjà commencé.")
            if game and room["game"] != game:
                raise ValueError("Ce salon utilise un autre jeu.")
            if len(room["players"]) >= room["seatCount"]:
                raise ValueError("Ce salon est complet.")
            player, token = self.player(name)
            room["players"].append(player)
            self.emit(room, "player-joined", {"player": public_player(player)}, player["id"])
            return self.serialize(room, player["id"]), token

    def random_join(self, name, game, seat_count=2):
        with self.lock:
            candidates = [
                room for room in self.rooms.values()
                if room["visibility"] == "public" and room["game"] == game and room["phase"] == "lobby" and len(room["players"]) < room["seatCount"]
            ]
            if not candidates:
                return self.create(name, game, "public", {}, seat_count)
            candidates.sort(key=lambda room: (len(room["players"]), room["createdAt"]), reverse=True)
            return self.join(candidates[0]["code"], name, game)

    def authenticate(self, code, token):
        if not ROOM_CODE_PATTERN.fullmatch(code):
            raise LookupError("Code de salon invalide.")
        self.cleanup()
        with self.lock:
            room = self.rooms.get(code)
            if not room:
                raise LookupError("Salon introuvable ou expiré.")
            digest = token_digest(token)
            player = next((player for player in room["players"] if secrets.compare_digest(player["tokenHash"], digest)), None)
            if not player:
                raise PermissionError("Jeton de salon invalide.")
            was_connected = player["connected"]
            player["connected"] = True
            player["lastSeen"] = time.time()
            room["emptySince"] = None
            room["updatedAt"] = time.time()
            if not was_connected:
                self.emit(room, "player-reconnected", {"playerId": player["id"]}, player["id"])
            self.refresh_presence(room)
            return room, player

    def command(self, room, player, command, payload):
        with self.lock:
            if command == "set-options":
                if player["id"] != room["hostId"] or room["phase"] != "lobby":
                    raise PermissionError("Seul l’hôte peut modifier les options avant la partie.")
                room["options"] = validate_options(payload.get("options", {}))
                self.emit(room, "options", {"options": room["options"]}, player["id"])
            elif command == "ready":
                if room["phase"] != "lobby":
                    raise ValueError("La partie est déjà commencée.")
                player["ready"] = bool(payload.get("ready"))
                player["asset"] = validate_asset(payload.get("asset")) if player["ready"] else None
                self.emit(room, "ready", {"ready": player["ready"]}, player["id"])
            elif command == "start":
                if player["id"] != room["hostId"]:
                    raise PermissionError("Seul l’hôte peut lancer la partie.")
                if room["phase"] != "lobby":
                    raise ValueError("La partie est déjà commencée.")
                if any(member["connected"] and not member["ready"] for member in room["players"]):
                    raise ValueError("Tous les joueurs doivent être prêts.")
                assets = {(member["asset"]["hash"], member["asset"]["size"]) if member.get("asset") else None for member in room["players"] if member["connected"]}
                if len(assets) > 1:
                    raise ValueError("Tous les joueurs doivent charger exactement le même fichier avant le départ.")
                room["seatCount"] = max(room["seatCount"], len(room["players"]))
                for key in ("playerCount", "players"):
                    if key in room["options"]:
                        room["options"][key] = room["seatCount"]
                room["seats"] = [{"playerId": member["id"]} for member in room["players"]]
                room["seats"].extend({"botId": secrets.token_urlsafe(6), "name": f"Bot {index + 1}"} for index in range(room["seatCount"] - len(room["players"])))
                room["phase"] = "playing"
                room["seed"] = secrets.token_hex(16)
                room["startAt"] = time.time() + 4
                room["paused"] = False
                room["results"] = {}
                room["rematchVotes"].clear()
                room["rematchDeclines"].clear()
                if room["game"] == PRIVATE_COLOR_GAME:
                    color_game_initialize(room)
                self.emit(room, "start", {"seed": room["seed"], "options": room["options"], "startAt": room["startAt"]}, player["id"])
            elif command == "pause":
                if room["phase"] != "playing":
                    raise ValueError("Aucune partie active à mettre en pause.")
                room["paused"] = bool(payload.get("paused"))
                self.emit(room, "pause", {"paused": room["paused"]}, player["id"])
            elif command == "action":
                if room["phase"] != "playing" or room["paused"]:
                    raise ValueError("La partie n’accepte pas d’action actuellement.")
                if room["game"] == PRIVATE_COLOR_GAME:
                    raise ValueError("Ce jeu exige une action privée validée par le serveur.")
                action = validate_public_action(room["game"], payload.get("action"))
                self.emit(room, "action", {"action": action}, player["id"])
            elif command == "game-action":
                if room["phase"] != "playing" or room["paused"]:
                    raise ValueError("La partie n’accepte pas d’action actuellement.")
                if room["game"] != PRIVATE_COLOR_GAME:
                    raise ValueError("Ce jeu ne possède pas de moteur privé côté serveur.")
                color_game_action(room, player, payload.get("action"))
                if room["phase"] == "finished":
                    self.emit(room, "finished", {"results": room["results"]}, player["id"])
                else:
                    self.emit(room, "game-state", {"version": room["gameState"]["version"]}, player["id"])
            elif command == "finish":
                if room["phase"] not in {"playing", "finished"}:
                    raise ValueError("Aucune partie active.")
                result = payload.get("result", {})
                if not isinstance(result, dict) or len(json.dumps(result)) > 4096:
                    raise ValueError("Résultat invalide.")
                if room["phase"] == "finished":
                    return self.serialize(room, player["id"])
                room["results"][player["id"]] = result
                race_winner = bool(result.get("raceWinner") and result.get("won"))
                if race_winner:
                    for index, seat in enumerate(room["seats"]):
                        result_key = seat.get("playerId") or f"bot-{index}"
                        if result_key == player["id"]:
                            room["results"][result_key] = {**result, "won": True}
                        elif result_key not in room["results"]:
                            room["results"][result_key] = {"score": 0, "scoreLabel": "Course terminée", "won": False, "bot": not bool(seat.get("playerId")), "seatIndex": index}
                    room["phase"] = "finished"
                    room["paused"] = False
                    self.emit(room, "finished", {"results": room["results"], "winnerId": player["id"]}, player["id"])
                    room["updatedAt"] = time.time()
                    return self.serialize(room, player["id"])
                connected_ids = {member["id"] for member in room["players"] if member["connected"]}
                if connected_ids.issubset(room["results"]):
                    winner_seat = next((value.get("winnerSeat") for value in room["results"].values() if isinstance(value.get("winnerSeat"), int)), None)
                    seated_player_ids = {seat.get("playerId") for seat in room["seats"] if seat.get("playerId")}
                    for index, seat in enumerate(room["seats"]):
                        result_key = seat.get("playerId") or f"bot-{index}"
                        if result_key in room["results"]:
                            continue
                        won = winner_seat == index
                        room["results"][result_key] = {"score": 1 if won else 0, "scoreLabel": "Victoire du bot" if won else "Bot remplaçant", "won": won, "bot": True, "seatIndex": index}
                    for member in room["players"]:
                        if member["id"] not in seated_player_ids and member["id"] not in room["results"]:
                            room["results"][member["id"]] = {"score": 0, "scoreLabel": "Déconnecté", "won": False, "bot": True}
                    room["phase"] = "finished"
                    self.emit(room, "finished", {"results": room["results"]}, player["id"])
                else:
                    self.emit(room, "result", {"result": result}, player["id"])
            elif command == "rematch":
                if room["phase"] != "finished":
                    raise ValueError("La partie doit être terminée.")
                if bool(payload.get("accept")):
                    room["rematchVotes"].add(player["id"])
                    room["rematchDeclines"].discard(player["id"])
                else:
                    room["rematchVotes"].discard(player["id"])
                    room["rematchDeclines"].add(player["id"])
                self.emit(room, "rematch-vote", {"accept": player["id"] in room["rematchVotes"]}, player["id"])
                if len(room["rematchVotes"]) == len(room["players"]):
                    room["phase"] = "lobby"
                    room["seed"] = None
                    room["startAt"] = None
                    room["results"] = {}
                    room["paused"] = False
                    room["seats"] = []
                    room["gameState"] = None
                    room["rematchVotes"].clear()
                    room["rematchDeclines"].clear()
                    for member in room["players"]:
                        member["ready"] = False
                    self.emit(room, "lobby-reset", {}, player["id"])
            elif command == "leave":
                leaving_id = player["id"]
                room["players"] = [member for member in room["players"] if member["id"] != leaving_id]
                room["rematchVotes"].discard(leaving_id)
                room["rematchDeclines"].discard(leaving_id)
                room["results"].pop(leaving_id, None)
                if not room["players"]:
                    self.rooms.pop(room["code"], None)
                    self.persist()
                    return None
                if room["hostId"] == leaving_id:
                    next_host = next((member for member in room["players"] if member["connected"]), room["players"][0])
                    next_host["host"] = True
                    room["hostId"] = next_host["id"]
                self.emit(room, "player-left", {"playerId": leaving_id, "hostId": room["hostId"]}, leaving_id)
            else:
                raise ValueError("Commande LAN inconnue.")
            return self.serialize(room, player["id"])


def validate_name(value):
    name = str(value or "").strip()
    if not PLAYER_NAME_PATTERN.fullmatch(name):
        raise ValueError("Le nom doit contenir entre 1 et 24 caractères sans balise HTML.")
    return name


def validate_game(value):
    game = str(value or "").lstrip("/")
    if not GAME_PATTERN.fullmatch(game) or ".." in game:
        raise ValueError("Jeu LAN invalide.")
    return game


def validate_options(value):
    if not isinstance(value, dict) or len(value) > 120:
        raise ValueError("Options de partie invalides.")
    clean = {}
    for key, option in value.items():
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,63}", str(key)):
            continue
        if isinstance(option, (str, bool, int, float)) and len(str(option)) <= 256:
            clean[str(key)] = option
    return clean


def validate_seat_count(value):
    count = int(value or 2)
    if count < 2 or count > MAX_PLAYERS:
        raise ValueError(f"Le salon doit contenir entre 2 et {MAX_PLAYERS} places.")
    return count


def validate_game_seat_count(game, value):
    count = validate_seat_count(value)
    if game in TWO_PLAYER_GAMES and count != 2:
        raise ValueError("Ce jeu LAN se joue obligatoirement à deux places.")
    return count


def validate_asset(value):
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("Empreinte de fichier invalide.")
    name = str(value.get("name", ""))[:120]
    digest = str(value.get("hash", "")).lower()
    size = int(value.get("size", 0))
    if not re.fullmatch(r"[0-9a-f]{64}", digest) or size <= 0 or size > 1024 * 1024 * 1024:
        raise ValueError("Empreinte de fichier invalide.")
    return {"name": name, "hash": digest, "size": size}


def lan_addresses(port, secure=False):
    addresses = {"127.0.0.1"}
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            addresses.add(info[4][0])
    except OSError:
        pass
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("192.0.2.1", 9))
        addresses.add(probe.getsockname()[0])
        probe.close()
    except OSError:
        pass
    scheme = "https" if secure else "http"
    return sorted(f"{scheme}://{address}:{port}/index.html" for address in addresses if not address.startswith("127."))


def find_available_port(start_port):
    for port in range(start_port, min(65536, start_port + 100)):
        probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            probe.bind(("127.0.0.1", port))
            return port
        except OSError:
            pass
        finally:
            probe.close()
    raise RuntimeError("Aucun port disponible trouvé.")


class LanRequestHandler(SimpleHTTPRequestHandler):
    server_version = "LudothequeLAN/1.0"
    protocol_version = "HTTP/1.1"
    rate_limits = collections.defaultdict(collections.deque)
    rate_lock = threading.Lock()

    def log_message(self, format_string, *args):
        print(f"[{self.log_date_time_string()}] {self.client_address[0]} {format_string % args}")

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Permissions-Policy", "camera=(), geolocation=(), payment=(), usb=()")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws: wss:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'")
        super().end_headers()

    def host_allowed(self):
        host = self.headers.get("Host", "").rsplit(":", 1)[0].strip("[]").lower()
        return host in self.server.allowed_hosts or host.endswith(".local")

    def origin_allowed(self):
        origin = self.headers.get("Origin")
        if not origin:
            return True
        parsed = urlsplit(origin)
        origin_host = (parsed.hostname or "").lower()
        return parsed.scheme in {"http", "https"} and (origin_host in self.server.allowed_hosts or origin_host.endswith(".local"))

    def rate_allowed(self):
        now = time.time()
        address = self.client_address[0]
        with self.rate_lock:
            entries = self.rate_limits[address]
            while entries and entries[0] < now - 10:
                entries.popleft()
            if len(entries) >= 80:
                return False
            entries.append(now)
            return True

    def reject(self, status, message):
        self.json_response(status, {"error": message})

    def json_response(self, status, payload, extra_headers=None):
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for key, value in (extra_headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def read_json(self):
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            raise ValueError("Le corps doit être envoyé en JSON.")
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BODY_SIZE:
            raise ValueError("Taille de requête invalide.")
        try:
            value = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValueError("JSON invalide.") from error
        if not isinstance(value, dict):
            raise ValueError("Le corps JSON doit être un objet.")
        return value

    def bearer_token(self):
        authorization = self.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            raise PermissionError("Jeton de salon absent.")
        token = authorization[7:].strip()
        if len(token) < 32 or len(token) > 128:
            raise PermissionError("Jeton de salon invalide.")
        return token

    def parse_room_path(self, suffix=""):
        path = urlsplit(self.path).path
        match = re.fullmatch(rf"/api/rooms/([A-HJ-NP-Z2-9]{{6}}){suffix}", path)
        if not match:
            raise LookupError("Route de salon invalide.")
        return match.group(1)

    def websocket_token(self):
        protocols = [value.strip() for value in self.headers.get("Sec-WebSocket-Protocol", "").split(",") if value.strip()]
        if len(protocols) != 2 or protocols[0] != "ludotheque-v1":
            raise PermissionError("Protocole WebSocket LAN invalide.")
        token = protocols[1]
        if len(token) < 32 or len(token) > 128 or not re.fullmatch(r"[A-Za-z0-9_-]+", token):
            raise PermissionError("Jeton WebSocket invalide.")
        return token

    def send_websocket_json(self, payload):
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(body) < 126:
            header = bytes((0x81, len(body)))
        elif len(body) <= 0xFFFF:
            header = bytes((0x81, 126)) + struct.pack("!H", len(body))
        else:
            header = bytes((0x81, 127)) + struct.pack("!Q", len(body))
        self.connection.sendall(header + body)

    def handle_room_websocket(self):
        self.close_connection = True
        if self.headers.get("Upgrade", "").lower() != "websocket" or "upgrade" not in self.headers.get("Connection", "").lower():
            raise ValueError("Mise à niveau WebSocket absente.")
        key = self.headers.get("Sec-WebSocket-Key", "")
        if not re.fullmatch(r"[A-Za-z0-9+/]{22}==", key):
            raise ValueError("Clé WebSocket invalide.")
        code = self.parse_room_path("/socket")
        room, player = self.server.rooms.authenticate(code, self.websocket_token())
        accept = base64.b64encode(hashlib.sha1(f"{key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11".encode("ascii")).digest()).decode("ascii")
        self.send_response(HTTPStatus.SWITCHING_PROTOCOLS)
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        self.send_header("Sec-WebSocket-Protocol", "ludotheque-v1")
        self.end_headers()
        last_sequence = -1
        last_heartbeat = 0.0
        try:
            while not self.server.cleanup_stop.wait(0.12):
                now = time.time()
                with self.server.rooms.lock:
                    if room["code"] not in self.server.rooms.rooms or player not in room["players"]:
                        break
                    player["lastSeen"] = now
                    player["connected"] = True
                    sequence = room["sequence"]
                    if sequence != last_sequence:
                        payload = self.server.rooms.serialize(room, player["id"], last_sequence)
                        last_sequence = sequence
                    elif now - last_heartbeat >= 5:
                        payload = {"heartbeat": True, "sequence": sequence}
                    else:
                        continue
                self.send_websocket_json(payload)
                last_heartbeat = now
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

    def api_guard(self):
        if not self.host_allowed():
            self.reject(HTTPStatus.BAD_REQUEST, "Hôte HTTP refusé.")
            return False
        if not self.origin_allowed():
            self.reject(HTTPStatus.FORBIDDEN, "Origine HTTP refusée.")
            return False
        if not self.rate_allowed():
            self.reject(HTTPStatus.TOO_MANY_REQUESTS, "Trop de requêtes. Réessayez dans quelques secondes.")
            return False
        return True

    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith("/api/"):
            if not self.api_guard():
                return
            try:
                if re.fullmatch(r"/api/rooms/[A-HJ-NP-Z2-9]{6}/socket", path):
                    self.handle_room_websocket()
                    return
                if path == "/api/lan/status":
                    self.json_response(HTTPStatus.OK, {"lan": True, "version": 3, "realtime": "websocket", "maxPlayers": MAX_PLAYERS, "publicUrls": self.server.public_urls})
                    return
                code = self.parse_room_path()
                room, player = self.server.rooms.authenticate(code, self.bearer_token())
                query = urlsplit(self.path).query
                since = 0
                for part in query.split("&"):
                    if part.startswith("since="):
                        since = max(0, int(part[6:] or "0"))
                self.json_response(HTTPStatus.OK, self.server.rooms.serialize(room, player["id"], since))
            except PermissionError as error:
                self.reject(HTTPStatus.UNAUTHORIZED, str(error))
            except LookupError as error:
                self.reject(HTTPStatus.NOT_FOUND, str(error))
            except (ValueError, OverflowError) as error:
                self.reject(HTTPStatus.BAD_REQUEST, str(error))
            return
        if not self.host_allowed():
            self.send_error(HTTPStatus.BAD_REQUEST, "Hôte HTTP refusé")
            return
        decoded = unquote(path)
        if any(part.startswith(".") for part in Path(decoded).parts) or decoded.startswith("/server/"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        super().do_GET()

    def do_HEAD(self):
        if urlsplit(self.path).path.startswith("/api/"):
            self.do_GET()
        elif not self.host_allowed():
            self.send_error(HTTPStatus.BAD_REQUEST, "Hôte HTTP refusé")
        else:
            super().do_HEAD()

    def do_POST(self):
        if not self.api_guard():
            return
        path = urlsplit(self.path).path
        try:
            payload = self.read_json()
            if path == "/api/rooms/create":
                room, token = self.server.rooms.create(
                    validate_name(payload.get("name")),
                    validate_game(payload.get("game")),
                    "public" if payload.get("visibility") == "public" else "private",
                    validate_options(payload.get("options", {})),
                    validate_seat_count(payload.get("seatCount", 2)),
                )
                self.json_response(HTTPStatus.CREATED, {"room": room, "token": token})
                return
            if path == "/api/rooms/join":
                code = str(payload.get("code", "")).strip().upper()
                if not ROOM_CODE_PATTERN.fullmatch(code):
                    raise ValueError("Le code doit contenir six caractères.")
                room, token = self.server.rooms.join(code, validate_name(payload.get("name")), validate_game(payload.get("game")))
                self.json_response(HTTPStatus.OK, {"room": room, "token": token})
                return
            if path == "/api/rooms/random":
                room, token = self.server.rooms.random_join(validate_name(payload.get("name")), validate_game(payload.get("game")), validate_seat_count(payload.get("seatCount", 2)))
                self.json_response(HTTPStatus.OK, {"room": room, "token": token})
                return
            code = self.parse_room_path("/command")
            room, player = self.server.rooms.authenticate(code, self.bearer_token())
            command = str(payload.get("command", ""))
            state = self.server.rooms.command(room, player, command, payload.get("payload", {}))
            self.json_response(HTTPStatus.OK, {"room": state})
        except PermissionError as error:
            self.reject(HTTPStatus.FORBIDDEN, str(error))
        except LookupError as error:
            self.reject(HTTPStatus.NOT_FOUND, str(error))
        except ValueError as error:
            self.reject(HTTPStatus.BAD_REQUEST, str(error))
        except Exception as error:
            self.reject(HTTPStatus.INTERNAL_SERVER_ERROR, f"Erreur interne du serveur LAN : {error}")


class LanHttpServer(ThreadingHTTPServer):
    def start_cleanup(self):
        self.cleanup_stop = threading.Event()
        self.cleanup_thread = threading.Thread(target=self.cleanup_loop, name="lan-room-cleanup", daemon=True)
        self.cleanup_thread.start()

    def cleanup_loop(self):
        while not self.cleanup_stop.wait(0.2):
            self.rooms.cleanup()

    def server_close(self):
        if hasattr(self, "cleanup_stop"):
            self.cleanup_stop.set()
        if hasattr(self, "cleanup_thread") and self.cleanup_thread is not threading.current_thread():
            self.cleanup_thread.join(timeout=3)
        if hasattr(self, "rooms"):
            self.rooms.persist()
        super().server_close()


def build_server(root, port, certificate=None, key=None, bind_host="0.0.0.0", state_file=None):
    os.chdir(root)
    server = LanHttpServer((bind_host, port), LanRequestHandler)
    server.rooms = LanRooms(state_file)
    server.allowed_hosts = {"localhost", "127.0.0.1", "::1"}
    hostname = socket.gethostname().lower()
    server.allowed_hosts.update({hostname, f"{hostname}.local"})
    actual_port = server.server_address[1]
    server.public_urls = lan_addresses(actual_port, bool(certificate)) if bind_host == "0.0.0.0" else []
    for url in server.public_urls:
        server.allowed_hosts.add(urlsplit(url).hostname)
    if certificate and key:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(certificate, key)
        server.socket = context.wrap_socket(server.socket, server_side=True)
    server.start_cleanup()
    return server


def main():
    parser = argparse.ArgumentParser(description="Serveur LAN sécurisé de la Ludothèque locale")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--bind", default="0.0.0.0", choices=("0.0.0.0", "127.0.0.1"))
    parser.add_argument("--cert", type=Path)
    parser.add_argument("--key", type=Path)
    parser.add_argument("--state-file", type=Path)
    parser.add_argument("--no-persist", action="store_true")
    parser.add_argument("--find-port", action="store_true")
    arguments = parser.parse_args()
    if not 1024 <= arguments.port <= 65535:
        parser.error("Le port doit être compris entre 1024 et 65535.")
    if bool(arguments.cert) != bool(arguments.key):
        parser.error("--cert et --key doivent être fournis ensemble.")
    if arguments.find_port:
        print(find_available_port(arguments.port))
        return
    root = arguments.root.resolve()
    state_file = None if arguments.no_persist else (arguments.state_file or root / ".runtime" / "lan-rooms.json")
    server = build_server(root, arguments.port, arguments.cert, arguments.key, arguments.bind, state_file)
    secure = bool(arguments.cert)
    print(f"Ludothèque LAN active sur {'https' if secure else 'http'}://127.0.0.1:{arguments.port}/index.html", flush=True)
    urls = server.public_urls
    for url in urls:
        print(f"Adresse à partager : {url}", flush=True)
    if not urls:
        print("Aucune adresse LAN détectée. Vérifiez la connexion réseau.", flush=True)
    if not secure:
        print("HTTP LAN actif : le microphone nécessite HTTPS ou localhost dans les navigateurs modernes.", flush=True)
    if state_file:
        print(f"Reprise des salons active : {state_file}", flush=True)
    print("Gardez cette fenêtre ouverte. Ctrl+C arrête le serveur ; les salons actifs pourront être repris au prochain lancement.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
