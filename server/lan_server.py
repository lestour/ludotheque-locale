#!/usr/bin/env python3

import argparse
import base64
import collections
import hashlib
import itertools
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
PRIVATE_SIXTH_GAME = "games/cards/modern/sixieme-carte.html"
PRIVATE_PIRATE_GAME = "games/cards/modern/roi-pirate.html"
PRIVATE_COURSE_GAME = "games/cards/modern/course-1000.html"
PRIVATE_CHAT_GAME = "games/cards/modern/chatastrophe.html"
PRIVATE_ZERO_GAME = "games/cards/modern/grille-zero.html"
PRIVATE_RUMMY_CARD_GAME = "games/cards/classic/rami-cartes.html"
PRIVATE_RUMMY_TILE_GAME = "games/board/rami-tuiles.html"
PUBLIC_BOARD_GAMES = "games/board/board-games.html"
PRIVATE_GAMES = {PRIVATE_COLOR_GAME, PRIVATE_SIXTH_GAME, PRIVATE_PIRATE_GAME, PRIVATE_COURSE_GAME, PRIVATE_CHAT_GAME, PRIVATE_ZERO_GAME, PRIVATE_RUMMY_CARD_GAME, PRIVATE_RUMMY_TILE_GAME}
TWO_PLAYER_GAMES = {"games/board/chess.html", "games/board/go.html"}
GAME_MAX_SEATS = {
    PRIVATE_COLOR_GAME: 4,
    PRIVATE_SIXTH_GAME: 6,
    PRIVATE_COURSE_GAME: 4,
    PRIVATE_CHAT_GAME: 4,
    PRIVATE_ZERO_GAME: 4,
    PRIVATE_RUMMY_CARD_GAME: 4,
    PRIVATE_RUMMY_TILE_GAME: 4,
}
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
    if game == "games/grid/minesweeper.html":
        index = value.get("index")
        if action_type != "minesweeper-start" or not isinstance(index, int) or not 0 <= index < 3840:
            raise ValueError("Ouverture de démineur invalide.")
        return {"type": action_type, "index": index}
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
    if game == PUBLIC_BOARD_GAMES:
        result = {"type": action_type}
        if action_type == "board-roll":
            pass
        elif action_type == "board-modal" and isinstance(value.get("value"), (str, int, bool)):
            result["value"] = value["value"]
        elif action_type == "board-estate-buy" and isinstance(value.get("accepted"), bool):
            result["accepted"] = value["accepted"]
        elif action_type in {"board-build", "board-world-buy"} and isinstance(value.get("index"), int) and 0 <= value["index"] < 100:
            result["index"] = value["index"]
        elif action_type == "board-world-end":
            pass
        elif action_type == "board-world-trade":
            integer_fields = ("from", "to", "offered", "requested", "offeredCash", "requestedCash")
            if not all(isinstance(value.get(field), int) and 0 <= value[field] <= 100_000_000 for field in integer_fields):
                raise ValueError("Échange de plateau invalide.")
            result.update({field: value[field] for field in integer_fields})
        else:
            raise ValueError("Action de plateau invalide.")
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
    state["version"] += 1
    color_game_schedule_bot(room)


def sixth_horns(number):
    if number == 55:
        return 7
    if number % 11 == 0:
        return 5
    if number % 10 == 0:
        return 3
    if number % 10 == 5:
        return 2
    return 1


def sixth_score(row):
    return sum(sixth_horns(card) for card in row)


def sixth_limit(room):
    try:
        value = int(room.get("options", {}).get("limit", 66))
    except (TypeError, ValueError):
        value = 66
    return value if value in {66, 100} else 66


def sixth_deal_round(room):
    state = room["gameState"]
    cards = list(range(1, 105))
    random.Random(f"{state['seed']}:{state['round']}").shuffle(cards)
    state["rows"] = [[cards.pop()] for _ in range(4)]
    state["hands"] = [[] for _ in room["seats"]]
    state["captured"] = [[] for _ in room["seats"]]
    for _ in range(10):
        for hand in state["hands"]:
            hand.append(cards.pop())
    state["choices"] = {}
    state["queue"] = []
    state["pendingRow"] = None
    state["turn"] = 0
    state["message"] = "Choisissez simultanément une carte."


def sixth_finish(room, winner):
    state = room["gameState"]
    state["over"] = True
    state["winner"] = winner
    room["phase"] = "finished"
    room["results"] = {}
    for index, seat in enumerate(room["seats"]):
        key = seat.get("playerId") or f"bot-{index}"
        room["results"][key] = {
            "score": state["scores"][index],
            "scoreLabel": f"{state['scores'][index]} têtes",
            "lowerIsBetter": True,
            "won": index == winner,
            "bot": not bool(seat.get("playerId")),
            "seatIndex": index,
        }


def sixth_place(room, player_index, card, row_index=None):
    state = room["gameState"]
    ends = [row[-1] for row in state["rows"]]
    choices = [(end, index) for index, end in enumerate(ends) if end < card]
    if not choices:
        if row_index is None:
            return False
        penalty = sixth_score(state["rows"][row_index])
        state["scores"][player_index] += penalty
        state["captured"][player_index].extend(state["rows"][row_index])
        state["rows"][row_index] = [card]
        state["message"] = f"Le joueur {player_index + 1} prend {penalty} têtes."
        return True
    target = max(choices)[1]
    if len(state["rows"][target]) == 5:
        penalty = sixth_score(state["rows"][target])
        state["scores"][player_index] += penalty
        state["captured"][player_index].extend(state["rows"][target])
        state["rows"][target] = [card]
        state["message"] = f"Le joueur {player_index + 1} prend {penalty} têtes avec la sixième carte."
    else:
        state["rows"][target].append(card)
    return True


def sixth_resolve(room):
    state = room["gameState"]
    while state["queue"]:
        choice = state["queue"][0]
        if not any(row[-1] < choice["card"] for row in state["rows"]):
            if color_game_bot_seat(room, choice["seat"]):
                row_index = min(range(4), key=lambda index: sixth_score(state["rows"][index]))
                sixth_place(room, choice["seat"], choice["card"], row_index)
                state["queue"].pop(0)
                continue
            state["pendingRow"] = choice
            state["message"] = "Choisissez la rangée à prendre."
            return
        sixth_place(room, choice["seat"], choice["card"])
        state["queue"].pop(0)
    state["pendingRow"] = None
    state["choices"] = {}
    state["turn"] += 1
    if any(score >= sixth_limit(room) for score in state["scores"]):
        sixth_finish(room, min(range(len(state["scores"])), key=lambda index: state["scores"][index]))
    elif state["turn"] >= 10:
        state["round"] += 1
        sixth_deal_round(room)
        sixth_bot_choices(room)
    else:
        state["message"] = "Choisissez simultanément une nouvelle carte."


def sixth_bot_choices(room):
    state = room["gameState"]
    pending = state.get("pendingRow")
    if pending and color_game_bot_seat(room, pending["seat"]):
        row_index = min(range(4), key=lambda index: sixth_score(state["rows"][index]))
        sixth_place(room, pending["seat"], pending["card"], row_index)
        state["queue"].pop(0)
        state["pendingRow"] = None
        sixth_resolve(room)
        state["version"] += 1
        return
    for seat, hand in enumerate(state["hands"]):
        if str(seat) in state["choices"] or not color_game_bot_seat(room, seat):
            continue
        ends = [row[-1] for row in state["rows"]]
        safe = sorted(card for card in hand if any(end < card for end in ends))
        card = safe[0] if safe else min(hand)
        hand.remove(card)
        state["choices"][str(seat)] = card
    if len(state["choices"]) == len(state["hands"]):
        state["queue"] = sorted(({"seat": int(seat), "card": card} for seat, card in state["choices"].items()), key=lambda item: item["card"])
        sixth_resolve(room)


def sixth_initialize(room):
    room["gameState"] = {
        "version": 1,
        "seed": secrets.token_hex(32),
        "round": 1,
        "turn": 0,
        "rows": [],
        "hands": [],
        "scores": [0 for _ in room["seats"]],
        "choices": {},
        "queue": [],
        "pendingRow": None,
        "message": "",
        "over": False,
        "winner": None,
    }
    sixth_deal_round(room)
    sixth_bot_choices(room)


def sixth_public_state(room, player_id):
    state = room.get("gameState")
    if not state:
        return None
    seat = color_game_seat(room, player_id)
    pending = state.get("pendingRow")
    return {
        "version": state["version"],
        "yourSeat": seat,
        "hand": list(state["hands"][seat]) if seat is not None else [],
        "handCounts": [len(hand) for hand in state["hands"]],
        "rows": [list(row) for row in state["rows"]],
        "scores": list(state["scores"]),
        "capturedCounts": [len(cards) for cards in state["captured"]],
        "round": state["round"],
        "turn": state["turn"],
        "chosen": seat is not None and str(seat) in state["choices"],
        "pendingRow": pending if pending and pending["seat"] == seat else None,
        "waitingForSeat": pending["seat"] if pending else None,
        "message": state["message"],
        "over": state["over"],
        "winner": state["winner"],
    }


def sixth_action(room, player, action):
    if not isinstance(action, dict):
        raise ValueError("Action Sixième Carte invalide.")
    state = room.get("gameState")
    seat = color_game_seat(room, player["id"])
    if seat is None or state.get("over"):
        raise ValueError("Aucun siège actif pour cette partie.")
    action_type = action.get("type")
    if action_type == "choose":
        if state.get("pendingRow") or str(seat) in state["choices"]:
            raise ValueError("Votre choix est déjà enregistré ou une rangée doit être choisie.")
        card = int(action.get("card", 0))
        if card not in state["hands"][seat]:
            raise ValueError("Cette carte ne se trouve pas dans votre main.")
        state["hands"][seat].remove(card)
        state["choices"][str(seat)] = card
        state["message"] = "Choix enregistré, attente des autres joueurs."
        sixth_bot_choices(room)
        if len(state["choices"]) == len(state["hands"]) and not state["queue"] and not state.get("pendingRow"):
            state["queue"] = sorted(({"seat": int(index), "card": value} for index, value in state["choices"].items()), key=lambda item: item["card"])
            sixth_resolve(room)
    elif action_type == "row":
        pending = state.get("pendingRow")
        row_index = int(action.get("row", -1))
        if not pending or pending["seat"] != seat or not 0 <= row_index < 4:
            raise ValueError("Cette rangée ne peut pas être choisie.")
        sixth_place(room, seat, pending["card"], row_index)
        state["queue"].pop(0)
        state["pendingRow"] = None
        sixth_resolve(room)
    else:
        raise ValueError("Action Sixième Carte inconnue.")
    state["version"] += 1


def pirate_rule(room, name, default=False):
    value = room.get("options", {}).get(name, default)
    return value is True or str(value).lower() in {"1", "true", "yes", "on"}


def pirate_deck(room, seed):
    cards = []
    card_id = 0

    def add(card_type, suit=None, value=None, label=None):
        nonlocal card_id
        cards.append({"id": card_id, "type": card_type, "suit": suit, "value": value, "label": label})
        card_id += 1

    for suit in ("red", "blue", "yellow", "black"):
        for value in range(1, 15):
            add("number", suit, value)
    for _ in range(5):
        add("escape", label="Fuite")
    for _ in range(5):
        add("pirate", label="Corsaire")
    for _ in range(2):
        add("mermaid", label="Oracle")
    add("king", label="Roi Pirate")
    if pirate_rule(room, "pirateCreatures"):
        add("kraken", label="Kraken")
        add("whale", label="Baleine blanche")
    random.Random(seed).shuffle(cards)
    return cards


def pirate_max_rounds(room, deck_size):
    available = deck_size // len(room["seats"])
    requested = room.get("options", {}).get("pirateRounds", 10)
    if str(requested) == "all":
        return available
    try:
        return min(available, max(1, int(requested)))
    except (TypeError, ValueError):
        return min(available, 10)


def pirate_name(room, seat):
    return public_seats(room)[seat]["label"]


def pirate_legal_cards(state, seat):
    hand = state["hands"][seat]
    leading = next((entry["card"] for entry in state["trick"] if entry["card"]["type"] == "number"), None)
    if not leading:
        return hand
    matching = [card for card in hand if card["type"] == "number" and card["suit"] == leading["suit"]]
    return matching + [card for card in hand if card["type"] != "number"] if matching else hand


def pirate_rank(state, entry):
    card = entry["card"]
    if card["type"] == "mermaid":
        return 1000 if any(item["card"]["type"] == "king" for item in state["trick"]) else 700
    if card["type"] == "king":
        return 900
    if card["type"] == "pirate":
        return 800
    if card["type"] in {"escape", "kraken", "whale"}:
        return 0
    if card["suit"] == "black":
        return 600 + card["value"]
    lead = next((item["card"]["suit"] for item in state["trick"] if item["card"]["type"] == "number"), None)
    return 100 + card["value"] if card["suit"] == lead else card["value"]


def pirate_trick_outcome(state):
    creatures = [entry for entry in state["trick"] if entry["card"]["type"] in {"kraken", "whale"}]
    active_creature = creatures[-1] if creatures else None
    ordinary = [entry for entry in state["trick"] if entry["card"]["type"] not in {"kraken", "whale"}]
    normal_winner = max(ordinary, key=lambda entry: pirate_rank(state, entry), default=None)
    if active_creature and active_creature["card"]["type"] == "kraken":
        return None, normal_winner["seat"] if normal_winner else active_creature["seat"], "Le Kraken engloutit le pli."
    if active_creature and active_creature["card"]["type"] == "whale":
        numbers = [entry for entry in ordinary if entry["card"]["type"] == "number"]
        winning = max(numbers, key=lambda entry: entry["card"]["value"], default=None)
        if winning:
            return winning["seat"], winning["seat"], "La Baleine blanche neutralise couleurs et personnages."
        return active_creature["seat"], active_creature["seat"], "La Baleine blanche reste seule en jeu."
    return normal_winner["seat"], normal_winner["seat"], ""


def pirate_trick_bonus(state, winner):
    winning = max((entry for entry in state["trick"] if entry["seat"] == winner), key=lambda entry: pirate_rank(state, entry), default=None)
    bonus = sum(20 if entry["card"]["suit"] == "black" else 10 for entry in state["trick"] if entry["card"]["type"] == "number" and entry["card"]["value"] == 14)
    if winning and winning["card"]["type"] == "pirate":
        bonus += 20 * sum(entry["card"]["type"] == "mermaid" for entry in state["trick"])
    if winning and winning["card"]["type"] == "king":
        bonus += 30 * sum(entry["card"]["type"] == "pirate" for entry in state["trick"])
    if winning and winning["card"]["type"] == "mermaid" and any(entry["card"]["type"] == "king" for entry in state["trick"]):
        bonus += 40
    return bonus


def pirate_bot_bid(state, seat):
    hand = state["hands"][seat]
    strong = sum(card["type"] in {"king", "pirate"} or card["type"] == "number" and card["suit"] == "black" and card["value"] > 8 for card in hand)
    adjustment = 0 if random.Random(f"{state['seed']}:bid:{state['round']}:{seat}").random() < .72 else -1
    return min(state["round"], max(0, strong + adjustment))


def pirate_fill_bot_bids(room):
    state = room["gameState"]
    for seat in range(len(state["hands"])):
        if state["bids"][seat] is None and color_game_bot_seat(room, seat):
            state["bids"][seat] = pirate_bot_bid(state, seat)
    if all(bid is not None for bid in state["bids"]):
        state["phase"] = "play"
        state["turn"] = state["leader"]
        state["message"] = f"{pirate_name(room, state['turn'])} ouvre le pli."
        pirate_schedule_bot(room)


def pirate_deal_round(room):
    state = room["gameState"]
    deck = pirate_deck(room, f"{state['seed']}:{state['round']}")
    if state["round"] == 1:
        state["maxRounds"] = pirate_max_rounds(room, len(deck))
    state["hands"] = [[] for _ in room["seats"]]
    for _ in range(state["round"]):
        for hand in state["hands"]:
            hand.append(deck.pop())
    state["deckCount"] = len(deck)
    state["leader"] = (state["round"] - 1) % len(state["hands"])
    state["turn"] = state["leader"]
    state["trick"] = []
    state["lastTrick"] = []
    state["bids"] = [None for _ in state["hands"]]
    state["tricks"] = [0 for _ in state["hands"]]
    state["bonus"] = [0 for _ in state["hands"]]
    state["phase"] = "bid"
    state["message"] = "Choisissez secrètement votre enchère."
    state["botDueAt"] = None
    pirate_fill_bot_bids(room)


def pirate_finish(room):
    state = room["gameState"]
    high = max(state["scores"])
    winner = state["scores"].index(high)
    state["done"] = True
    state["winner"] = winner
    state["phase"] = "finished"
    room["phase"] = "finished"
    room["results"] = {}
    for index, seat in enumerate(room["seats"]):
        key = seat.get("playerId") or f"bot-{index}"
        room["results"][key] = {"score": state["scores"][index], "scoreLabel": f"{state['scores'][index]} points", "won": index == winner, "bot": not bool(seat.get("playerId")), "seatIndex": index}


def pirate_finish_round(room):
    state = room["gameState"]
    for seat in range(len(state["hands"])):
        bid = state["bids"][seat]
        tricks = state["tricks"][seat]
        correct = tricks == bid
        delta = ((10 * state["round"] if bid == 0 else 20 * bid) + state["bonus"][seat]) if correct else (-10 * state["round"] if bid == 0 else -10 * abs(tricks - bid))
        state["scores"][seat] += delta
    if state["round"] >= state["maxRounds"]:
        pirate_finish(room)
        return
    state["round"] += 1
    pirate_deal_round(room)


def pirate_play_card(room, seat, card_id):
    state = room["gameState"]
    if state["phase"] != "play" or seat != state["turn"]:
        raise ValueError("Ce n’est pas votre tour de jouer.")
    card = next((item for item in state["hands"][seat] if item["id"] == card_id), None)
    if not card or card not in pirate_legal_cards(state, seat):
        raise ValueError("Cette carte ne peut pas être jouée.")
    state["hands"][seat].remove(card)
    state["trick"].append({"seat": seat, "card": card})
    state["turn"] = (seat + 1) % len(state["hands"])
    state["message"] = f"{pirate_name(room, seat)} joue une carte."
    if len(state["trick"]) == len(state["hands"]):
        winner, next_leader, label = pirate_trick_outcome(state)
        bonus = 0 if winner is None else pirate_trick_bonus(state, winner)
        if winner is not None:
            state["tricks"][winner] += 1
            state["bonus"][winner] += bonus
        state["lastTrick"] = list(state["trick"])
        state["trick"] = []
        state["leader"] = next_leader
        state["turn"] = next_leader
        state["message"] = label or (f"{pirate_name(room, winner)} remporte le pli" + (f" et {bonus} points bonus." if bonus else "."))
        if all(not hand for hand in state["hands"]):
            pirate_finish_round(room)
    pirate_schedule_bot(room)


def pirate_bot_turn(room):
    state = room["gameState"]
    if state["phase"] == "bid":
        pirate_fill_bot_bids(room)
        return
    if state["phase"] != "play" or not color_game_bot_seat(room, state["turn"]):
        return
    seat = state["turn"]
    legal = pirate_legal_cards(state, seat)
    generator = random.Random(f"{state['seed']}:play:{state['round']}:{sum(len(hand) for hand in state['hands'])}:{seat}")
    pirate_play_card(room, seat, generator.choice(legal)["id"])


def pirate_schedule_bot(room):
    state = room.get("gameState")
    if not state or room["phase"] != "playing":
        return
    needs_bot = state["phase"] == "bid" and any(state["bids"][seat] is None and color_game_bot_seat(room, seat) for seat in range(len(state["hands"]))) or state["phase"] == "play" and color_game_bot_seat(room, state["turn"])
    if not needs_bot:
        state["botDueAt"] = None
        return
    state["botDueAt"] = time.time() + random.Random(f"{state['seed']}:delay:{state['round']}:{state['turn']}:{state['version']}").uniform(.35, .85)


def pirate_run_due_bot(room, now=None):
    state = room.get("gameState")
    now = now or time.time()
    if not state or room["phase"] != "playing" or not state.get("botDueAt") or state["botDueAt"] > now:
        return False
    state["botDueAt"] = None
    pirate_bot_turn(room)
    state["version"] += 1
    pirate_schedule_bot(room)
    return True


def pirate_initialize(room):
    room["gameState"] = {"version": 1, "seed": secrets.token_hex(32), "round": 1, "maxRounds": 1, "hands": [], "deckCount": 0, "scores": [0 for _ in room["seats"]], "bids": [], "tricks": [], "bonus": [], "leader": 0, "turn": 0, "trick": [], "lastTrick": [], "phase": "bid", "message": "", "done": False, "winner": None, "botDueAt": None}
    pirate_deal_round(room)
    pirate_schedule_bot(room)


def pirate_public_state(room, player_id):
    state = room.get("gameState")
    if not state:
        return None
    seat = color_game_seat(room, player_id)
    reveal_bids = state["phase"] != "bid" or all(bid is not None for bid in state["bids"])
    bids = list(state["bids"]) if reveal_bids else [state["bids"][index] if index == seat else None for index in range(len(state["bids"]))]
    return {"version": state["version"], "yourSeat": seat, "hand": list(state["hands"][seat]) if seat is not None else [], "handCounts": [len(hand) for hand in state["hands"]], "scores": list(state["scores"]), "bids": bids, "bidSubmitted": [bid is not None for bid in state["bids"]], "tricks": list(state["tricks"]), "bonus": list(state["bonus"]), "round": state["round"], "maxRounds": state["maxRounds"], "leader": state["leader"], "current": state["turn"], "trick": list(state["trick"]), "lastTrick": list(state["lastTrick"]), "phase": state["phase"], "message": state["message"], "done": state["done"], "winner": state["winner"]}


def pirate_action(room, player, action):
    if not isinstance(action, dict):
        raise ValueError("Action Roi Pirate invalide.")
    state = room.get("gameState")
    seat = color_game_seat(room, player["id"])
    if seat is None or state.get("done"):
        raise ValueError("Aucun siège actif pour cette partie.")
    if action.get("type") == "bid":
        bid = int(action.get("value", -1))
        if state["phase"] != "bid" or state["bids"][seat] is not None or not 0 <= bid <= state["round"]:
            raise ValueError("Cette enchère est invalide.")
        state["bids"][seat] = bid
        state["message"] = "Enchère enregistrée, attente des autres joueurs."
        pirate_fill_bot_bids(room)
        if all(value is not None for value in state["bids"]):
            state["phase"] = "play"
            state["turn"] = state["leader"]
            state["message"] = f"{pirate_name(room, state['turn'])} ouvre le pli."
            pirate_schedule_bot(room)
    elif action.get("type") == "play":
        pirate_play_card(room, seat, int(action.get("cardId", -1)))
    else:
        raise ValueError("Action Roi Pirate inconnue.")
    state["version"] += 1


def course_rule(room, name, default=False):
    value = room.get("options", {}).get(name, default)
    return value is True or str(value).lower() in {"1", "true", "yes", "on"}


def game_option_int(room, name, default, minimum, maximum):
    try:
        value = int(room.get("options", {}).get(name, default))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


def course_target(room):
    try:
        return 700 if int(room.get("options", {}).get("targetDistance", 1000)) == 700 else 1000
    except (TypeError, ValueError):
        return 1000


def course_deck(seed):
    cards = []
    card_id = 0
    def add(kind, name, value=0):
        nonlocal card_id
        cards.append({"id": card_id, "kind": kind, "name": name, "value": value})
        card_id += 1
    for value, count in ((25, 10), (50, 10), (75, 10), (100, 12), (200, 4)):
        for _ in range(count): add("distance", f"{value} km", value)
    for name, count in (("Feu rouge", 5), ("Panne", 3), ("Crevaison", 3), ("Accident", 3), ("Limite", 4)):
        for _ in range(count): add("attack", name)
    for name, count in (("Feu vert", 14), ("Essence", 6), ("Roue", 6), ("Réparation", 6), ("Fin limite", 6)):
        for _ in range(count): add("remedy", name)
    for name in ("Véhicule prioritaire", "Citerne", "Increvable", "As du volant"): add("safety", name)
    random.Random(seed).shuffle(cards)
    return cards


def course_safety_for(attack):
    return {"Feu rouge": "Véhicule prioritaire", "Limite": "Véhicule prioritaire", "Panne": "Citerne", "Crevaison": "Increvable", "Accident": "As du volant"}.get(attack)


def course_is_rolling(person):
    return person["battle"] == "go" or person["battle"] == "stop" and any(card["name"] == "Véhicule prioritaire" for card in person["safeties"])


def course_immune(person, attack):
    safety = course_safety_for(attack)
    return any(card["name"] == safety for card in person["safeties"])


def course_playable(room, state, seat, card, target=None):
    person = state["people"][seat]
    if card["kind"] == "distance":
        exact = course_rule(room, "exactDistance", True)
        return course_is_rolling(person) and (not person["limit"] or card["value"] <= 50) and (not exact or person["distance"] + card["value"] <= course_target(room)) and person["distance"] < course_target(room) and (card["value"] != 200 or person["twoHundreds"] < 2)
    if card["kind"] == "safety":
        return not any(item["name"] == card["name"] for item in person["safeties"])
    if card["kind"] == "remedy":
        if card["name"] == "Feu vert": return person["battle"] == "stop"
        if card["name"] == "Fin limite": return person["limit"]
        return {"Essence": "Panne", "Roue": "Crevaison", "Réparation": "Accident"}.get(card["name"]) == person["battle"]
    return card["kind"] == "attack" and target is not None and target != seat and not course_immune(state["people"][target], card["name"]) and (card["name"] == "Limite" and not state["people"][target]["limit"] or card["name"] != "Limite" and course_is_rolling(state["people"][target]))


def course_draw(state, seat):
    if not state["deck"]: return False
    state["hands"][seat].append(state["deck"].pop())
    return True


def course_finish(room, winner=None):
    state = room["gameState"]
    if winner is None:
        best = max(person["distance"] for person in state["people"])
        winners = [seat for seat, person in enumerate(state["people"]) if person["distance"] == best]
    else:
        winners = [winner]
    state["over"] = True
    state["winners"] = winners
    state["message"] = "Course terminée."
    room["phase"] = "finished"
    room["results"] = {}
    for seat, slot in enumerate(room["seats"]):
        key = slot.get("playerId") or f"bot-{seat}"
        distance = state["people"][seat]["distance"]
        room["results"][key] = {"score": distance, "scoreLabel": f"{distance} km", "won": seat in winners, "bot": not bool(slot.get("playerId")), "seatIndex": seat}


def course_advance(room):
    state = room["gameState"]
    next_seat = state.pop("forcedTurn", None)
    if next_seat is None: next_seat = state.pop("extraTurn", None)
    if next_seat is None: next_seat = (state["turn"] + 1) % len(state["hands"])
    state["turn"] = next_seat
    refill = state.pop("refillBeforeTurn", None)
    if refill == next_seat:
        course_draw(state, next_seat)
        state["awaitingDraw"] = False
    else:
        state["awaitingDraw"] = True
    if not state["deck"] and all(not hand for hand in state["hands"]):
        course_finish(room)
        return
    skipped = 0
    while not state["deck"] and not state["hands"][state["turn"]] and skipped < len(state["hands"]):
        state["turn"] = (state["turn"] + 1) % len(state["hands"])
        skipped += 1
    if skipped >= len(state["hands"]):
        course_finish(room)
        return
    state["message"] = f"{pirate_name(room, state['turn'])} doit piocher." if state["awaitingDraw"] else f"{pirate_name(room, state['turn'])} doit jouer."
    course_schedule_bot(room)


def course_apply(room, seat, card_id, target=None):
    state = room["gameState"]
    card = next((item for item in state["hands"][seat] if item["id"] == card_id), None)
    if card is None or not course_playable(room, state, seat, card, target):
        raise ValueError("Cette carte ne peut pas être jouée dans cette situation.")
    state["hands"][seat].remove(card)
    person = state["people"][seat]
    if card["kind"] == "distance":
        person["distance"] += card["value"]
        if card["value"] == 200: person["twoHundreds"] += 1
    elif card["kind"] == "attack":
        victim = state["people"][target]
        safety_name = course_safety_for(card["name"])
        safety = next((item for item in state["hands"][target] if item["kind"] == "safety" and item["name"] == safety_name), None) if course_rule(room, "coupFourre", True) else None
        if safety:
            state["hands"][target].remove(safety)
            victim["safeties"].append(safety)
            victim["coupBonus"] += 300
            if safety["name"] == "Véhicule prioritaire": victim["limit"] = False
            state["discard"].append(card)
            state["forcedTurn"] = target
            state["refillBeforeTurn"] = target
            state["message"] = f"{pirate_name(room, target)} réalise un coup fourré."
        elif card["name"] == "Limite": victim["limit"] = True
        else: victim["battle"] = card["name"]
    elif card["kind"] == "remedy":
        if card["name"] == "Fin limite": person["limit"] = False
        elif card["name"] == "Feu vert": person["battle"] = "go"
        else: person["battle"] = "stop"
    else:
        person["safeties"].append(card)
        if card["name"] == "Véhicule prioritaire": person["battle"], person["limit"] = "go", False
        elif {"Citerne": "Panne", "Increvable": "Crevaison", "As du volant": "Accident"}.get(card["name"]) == person["battle"]: person["battle"] = "stop"
        state["extraTurn"] = seat
    if person["distance"] >= course_target(room) and (not course_rule(room, "exactDistance", True) or person["distance"] == course_target(room)):
        course_finish(room, seat)
    else:
        course_advance(room)


def course_bot_turn(room):
    state = room["gameState"]
    seat = state["turn"]
    if state["awaitingDraw"]:
        course_draw(state, seat)
        state["awaitingDraw"] = False
    candidates = []
    for card in state["hands"][seat]:
        if card["kind"] == "attack":
            for target in range(len(state["hands"])):
                if course_playable(room, state, seat, card, target): candidates.append((card, target))
        elif course_playable(room, state, seat, card): candidates.append((card, None))
    priority = {"safety": 0, "remedy": 1, "distance": 2, "attack": 3}
    if candidates:
        card, target = min(candidates, key=lambda item: (priority[item[0]["kind"]], -item[0]["value"]))
        course_apply(room, seat, card["id"], target)
    elif state["hands"][seat]:
        state["discard"].append(state["hands"][seat].pop(0))
        course_advance(room)


def course_schedule_bot(room):
    state = room.get("gameState")
    if not state or room["phase"] != "playing" or not color_game_bot_seat(room, state["turn"]):
        if state: state["botDueAt"] = None
        return
    state["botDueAt"] = time.time() + .45


def course_run_due_bot(room, now=None):
    state = room.get("gameState")
    now = now or time.time()
    if not state or room["phase"] != "playing" or not state.get("botDueAt") or state["botDueAt"] > now: return False
    state["botDueAt"] = None
    course_bot_turn(room)
    state["version"] += 1
    course_schedule_bot(room)
    return True


def course_initialize(room):
    seed = secrets.token_hex(32)
    count = len(room["seats"])
    state = {"version": 1, "seed": seed, "deck": course_deck(seed), "discard": [], "hands": [[] for _ in range(count)], "people": [{"distance": 0, "battle": "stop", "limit": False, "safeties": [], "twoHundreds": 0, "coupBonus": 0} for _ in range(count)], "turn": 0, "awaitingDraw": True, "over": False, "winners": [], "message": "Piochez une carte.", "botDueAt": None}
    room["gameState"] = state
    for _ in range(6):
        for seat in range(count): course_draw(state, seat)
    course_schedule_bot(room)


def course_public_state(room, player_id):
    state = room.get("gameState")
    if not state: return None
    seat = color_game_seat(room, player_id)
    return {"version": state["version"], "yourSeat": seat, "hand": list(state["hands"][seat]) if seat is not None else [], "handCounts": [len(hand) for hand in state["hands"]], "deckCount": len(state["deck"]), "discardTop": state["discard"][-1] if state["discard"] else None, "people": [{"distance": person["distance"], "battle": person["battle"], "limit": person["limit"], "safeties": list(person["safeties"]), "twoHundreds": person["twoHundreds"], "coupBonus": person["coupBonus"]} for person in state["people"]], "turn": state["turn"], "awaitingDraw": state["awaitingDraw"], "target": course_target(room), "exactDistance": course_rule(room, "exactDistance", True), "over": state["over"], "winners": list(state["winners"]), "message": state["message"]}


def course_action(room, player, action):
    if not isinstance(action, dict): raise ValueError("Action Course 1000 invalide.")
    state = room.get("gameState")
    seat = color_game_seat(room, player["id"])
    if seat is None or state.get("over") or seat != state["turn"]: raise ValueError("Ce n’est pas votre tour.")
    action_type = action.get("type")
    if action_type == "draw":
        if not state["awaitingDraw"]: raise ValueError("Vous avez déjà pioché.")
        course_draw(state, seat)
        state["awaitingDraw"] = False
        state["message"] = "Jouez ou défaussez une carte."
    elif action_type == "play":
        if state["awaitingDraw"]: raise ValueError("Vous devez piocher avant de jouer.")
        target = action.get("target")
        target = int(target) if target is not None else None
        course_apply(room, seat, int(action.get("cardId", -1)), target)
    elif action_type == "discard":
        if state["awaitingDraw"]: raise ValueError("Vous devez piocher avant de défausser.")
        card = next((item for item in state["hands"][seat] if item["id"] == int(action.get("cardId", -1))), None)
        if card is None: raise ValueError("Cette carte ne se trouve pas dans votre main.")
        state["hands"][seat].remove(card)
        state["discard"].append(card)
        course_advance(room)
    else:
        raise ValueError("Action Course 1000 inconnue.")
    state["version"] += 1
    course_schedule_bot(room)


def chat_deck(room, seed):
    recipe = str(room.get("options", {}).get("catastropheRecipe", "classic"))
    counts = {"attack": 6, "skip": 6, "favor": 6, "shuffle": 6, "future": 6, "nope": 6, "cat": 6}
    if recipe == "assault": counts.update(attack=10, skip=8, future=3)
    elif recipe == "premonition": counts.update(future=11, shuffle=3, favor=3)
    elif recipe == "theft": counts.update(favor=10, cat=10, nope=3)
    elif recipe == "danger": counts.update(attack=9, skip=4, shuffle=3)
    cards = []
    card_id = 0
    def add(card_type, **extra):
        nonlocal card_id
        cards.append({"id": card_id, "type": card_type, **extra})
        card_id += 1
    for card_type, count in counts.items():
        for _ in range(count): add(card_type)
    random.Random(seed).shuffle(cards)
    return cards, add, cards


def chat_next_alive(state, seat):
    for _ in range(len(state["people"])):
        seat = (seat + 1) % len(state["people"])
        if state["people"][seat]["alive"]: return seat
    return seat


def chat_finish(room):
    state = room["gameState"]
    alive = [seat for seat, person in enumerate(state["people"]) if person["alive"]]
    if len(alive) > 1: return False
    state["over"] = True
    state["winner"] = alive[0] if alive else None
    room["phase"] = "finished"
    room["results"] = {}
    for seat, slot in enumerate(room["seats"]):
        key = slot.get("playerId") or f"bot-{seat}"
        room["results"][key] = {"score": 1 if seat == state["winner"] else 0, "scoreLabel": "Survivant" if seat == state["winner"] else "Éliminé", "won": seat == state["winner"], "bot": not bool(slot.get("playerId")), "seatIndex": seat}
    state["message"] = "Le dernier survivant gagne."
    return True


def chat_next(room):
    state = room["gameState"]
    if chat_finish(room): return
    state["turn"] = chat_next_alive(state, state["turn"])
    state["people"][state["turn"]]["turns"] = max(1, state["people"][state["turn"]]["turns"])
    state["futureFor"] = None
    state["pending"] = None
    state["message"] = f"Au tour de {pirate_name(room, state['turn'])}."
    chat_schedule_bot(room)


def chat_end_draw(room, seat):
    state = room["gameState"]
    state["people"][seat]["turns"] -= 1
    if state["people"][seat]["turns"] > 0:
        state["message"] = f"{pirate_name(room, seat)} doit encore jouer {state['people'][seat]['turns']} tour(s)."
        chat_schedule_bot(room)
    else:
        chat_next(room)


def chat_draw(room, seat):
    state = room["gameState"]
    if not state["deck"]: raise ValueError("La pioche est vide.")
    card = state["deck"].pop()
    person = state["people"][seat]
    if card["type"] == "imploding":
        if not card.get("armed"):
            card["armed"] = True
            state["deck"].insert(len(state["deck"]) // 2, card)
            state["message"] = "L’incident implosif revient face visible au milieu de la pioche."
            chat_end_draw(room, seat)
        else:
            person["alive"] = False
            state["discard"].append(card)
            chat_next(room)
        return
    if card["type"] != "kitten":
        state["hands"][seat].append(card)
        chat_end_draw(room, seat)
        return
    defuse = next((item for item in state["hands"][seat] if item["type"] == "defuse"), None)
    if defuse is None:
        person["alive"] = False
        state["discard"].append(card)
        chat_next(room)
        return
    state["hands"][seat].remove(defuse)
    state["discard"].append(defuse)
    state["pending"] = {"seat": seat, "card": card}
    state["message"] = f"{pirate_name(room, seat)} neutralise un incident et doit le replacer."
    if color_game_bot_seat(room, seat): chat_insert(room, seat, "middle")


def chat_insert(room, seat, place):
    state = room["gameState"]
    pending = state.get("pending")
    if not pending or pending["seat"] != seat: raise ValueError("Aucun incident ne doit être replacé.")
    index = len(state["deck"]) if place == "top" else 0 if place == "bottom" else len(state["deck"]) // 2
    state["deck"].insert(index, pending["card"])
    state["pending"] = None
    chat_end_draw(room, seat)


def chat_play(room, seat, card_ids, target=None):
    state = room["gameState"]
    hand = state["hands"][seat]
    cards = [next((item for item in hand if item["id"] == card_id), None) for card_id in card_ids]
    if not cards or any(card is None for card in cards): raise ValueError("Carte absente de votre main.")
    card = cards[0]
    if card["type"] in {"defuse", "kitten", "imploding"}: raise ValueError("Cette carte ne peut pas être jouée.")
    if card["type"] == "cat":
        if len(cards) != 2 or cards[1]["type"] != "cat" or target is None or target == seat or not state["people"][target]["alive"] or not state["hands"][target]: raise ValueError("Une paire de compagnons et une cible valide sont requises.")
    elif len(cards) != 1:
        raise ValueError("Une seule carte est attendue.")
    if card["type"] == "favor" and (target is None or target == seat or not state["people"][target]["alive"] or not state["hands"][target]): raise ValueError("Cible invalide.")
    for played in cards:
        hand.remove(played)
        state["discard"].append(played)
    if card["type"] == "attack":
        victim = chat_next_alive(state, seat)
        state["people"][seat]["turns"] = 0
        state["people"][victim]["turns"] += 2
        chat_next(room)
        return
    if card["type"] == "skip":
        chat_end_draw(room, seat)
        return
    if card["type"] == "shuffle":
        random.Random(f"{state['seed']}:{state['version']}:shuffle").shuffle(state["deck"])
    elif card["type"] == "future":
        state["futureFor"] = seat
    elif card["type"] in {"favor", "cat"}:
        generator = random.Random(f"{state['seed']}:{state['version']}:{seat}:{target}")
        taken = generator.choice(state["hands"][target])
        state["hands"][target].remove(taken)
        hand.append(taken)
    state["message"] = f"{pirate_name(room, seat)} joue une carte."


def chat_bot_turn(room):
    state = room["gameState"]
    seat = state["turn"]
    hand = state["hands"][seat]
    preferred = next((card for card in hand if card["type"] in {"attack", "skip"}), None)
    if preferred:
        chat_play(room, seat, [preferred["id"]])
    else:
        chat_draw(room, seat)


def chat_schedule_bot(room):
    state = room.get("gameState")
    if not state or room["phase"] != "playing" or not color_game_bot_seat(room, state["turn"]):
        if state: state["botDueAt"] = None
        return
    state["botDueAt"] = time.time() + .5


def chat_run_due_bot(room, now=None):
    state = room.get("gameState")
    now = now or time.time()
    if not state or room["phase"] != "playing" or not state.get("botDueAt") or state["botDueAt"] > now: return False
    state["botDueAt"] = None
    chat_bot_turn(room)
    state["version"] += 1
    chat_schedule_bot(room)
    return True


def chat_initialize(room):
    seed = secrets.token_hex(32)
    action_cards, add, _ = chat_deck(room, seed)
    count = len(room["seats"])
    hands = [[] for _ in range(count)]
    next_id = max((card["id"] for card in action_cards), default=-1) + 1
    def create(card_type, **extra):
        nonlocal next_id
        card = {"id": next_id, "type": card_type, **extra}; next_id += 1; return card
    for seat in range(count):
        hands[seat].append(create("defuse"))
        for _ in range(7): hands[seat].append(action_cards.pop())
    action_cards.append(create("defuse"))
    for _ in range(count - 1): action_cards.append(create("kitten"))
    if course_rule(room, "implodingIncident"): action_cards.append(create("imploding", armed=False))
    random.Random(f"{seed}:danger").shuffle(action_cards)
    room["gameState"] = {"version": 1, "seed": seed, "deck": action_cards, "discard": [], "hands": hands, "people": [{"alive": True, "turns": 1 if seat == 0 else 0} for seat in range(count)], "turn": 0, "pending": None, "futureFor": None, "over": False, "winner": None, "message": "Jouez une carte ou piochez.", "botDueAt": None}
    chat_schedule_bot(room)


def chat_public_state(room, player_id):
    state = room.get("gameState")
    if not state: return None
    seat = color_game_seat(room, player_id)
    future = list(reversed(state["deck"][-3:])) if seat is not None and state.get("futureFor") == seat else []
    return {"version": state["version"], "yourSeat": seat, "hand": list(state["hands"][seat]) if seat is not None else [], "handCounts": [len(hand) for hand in state["hands"]], "deckCount": len(state["deck"]), "discardTop": state["discard"][-1] if state["discard"] else None, "people": [dict(person) for person in state["people"]], "turn": state["turn"], "pendingDefuse": bool(state.get("pending") and state["pending"]["seat"] == seat), "future": future, "over": state["over"], "winner": state["winner"], "message": state["message"]}


def chat_action(room, player, action):
    if not isinstance(action, dict): raise ValueError("Action Chatastrophe invalide.")
    state = room.get("gameState")
    seat = color_game_seat(room, player["id"])
    if seat is None or state.get("over") or seat != state["turn"]: raise ValueError("Ce n’est pas votre tour.")
    action_type = action.get("type")
    if action_type == "draw":
        if state.get("pending"): raise ValueError("Replacez d’abord l’incident.")
        chat_draw(room, seat)
    elif action_type == "insert":
        place = str(action.get("place", "middle"))
        if place not in {"top", "middle", "bottom"}: raise ValueError("Position invalide.")
        chat_insert(room, seat, place)
    elif action_type == "play":
        if state.get("pending"): raise ValueError("Replacez d’abord l’incident.")
        ids = action.get("cardIds")
        if not isinstance(ids, list): ids = [action.get("cardId")]
        target = action.get("target")
        chat_play(room, seat, [int(value) for value in ids], int(target) if target is not None else None)
    else:
        raise ValueError("Action Chatastrophe inconnue.")
    state["version"] += 1
    chat_schedule_bot(room)


def zero_rule(room, name, default=False):
    return course_rule(room, name, default)


ZERO_ACTION_COUNTS = {"selfSwap": 4, "doubleTurn": 4, "drawThree": 4, "inspect": 4, "reactivate": 3, "defense": 3, "opponentSwap": 3, "thief": 2, "meteor": 3}


def zero_deck(seed, bonus=False):
    cards = []
    card_id = 0
    for value, count in [(-2, 5), (-1, 10), (0, 15), *[(value, 10) for value in range(1, 13)]]:
        for _ in range(count):
            cards.append({"id": card_id, "kind": "number", "value": value}); card_id += 1
    if bonus:
        for _ in range(8): cards.append({"id": card_id, "kind": "star", "value": 0}); card_id += 1
    random.Random(seed).shuffle(cards)
    return cards


def zero_action_deck(seed):
    actions = [action for action, count in ZERO_ACTION_COUNTS.items() for _ in range(count)]
    random.Random(seed).shuffle(actions)
    return actions


def zero_visible(card):
    return card.get("up") and not card.get("removed")


def zero_remove_groups(room, seat):
    state = room["gameState"]
    board = state["people"][seat]["board"]
    groups = []
    if zero_rule(room, "columns", True): groups += [[column, column + 4, column + 8] for column in range(4)]
    if zero_rule(room, "rows", False): groups += [[row * 4 + offset for offset in range(4)] for row in range(3)]
    changed = True
    while changed:
        changed = False
        for indexes in groups:
            cards = [board[index] for index in indexes]
            if all(zero_visible(card) for card in cards) and len({(card["kind"], card["value"]) for card in cards}) == 1:
                for card in cards: card["removed"] = True
                if cards[0]["kind"] == "star":
                    state["people"][seat]["roundBonus"] -= 15 if len(indexes) == 4 else 10
                changed = True


def zero_all_revealed(person):
    return all(card.get("removed") or card.get("up") for card in person["board"])


def zero_score(person):
    return person.get("roundBonus", 0) + sum(card["value"] for card in person["board"] if zero_visible(card))


def zero_refill_action_market(state):
    while len(state["actionMarket"]) < 4:
        if not state["actionDeck"]:
            if not state["actionDiscard"]: break
            state["actionDeck"] = state["actionDiscard"]; state["actionDiscard"] = []
            random.Random(f"{state['seed']}:{state['round']}:{state['version']}:actions").shuffle(state["actionDeck"])
        state["actionMarket"].append(state["actionDeck"].pop())


def zero_acquire_action(state, seat, market_index=None, free=False):
    if market_index is None:
        if not state["actionDeck"]: return False
        action_id = state["actionDeck"].pop()
    else:
        if not 0 <= market_index < len(state["actionMarket"]): return False
        action_id = state["actionMarket"].pop(market_index)
    state["people"][seat]["actions"].append({"id": action_id, "readyAfter": state["turnSerial"] + (0 if free else 1)})
    zero_refill_action_market(state)
    return True


def zero_grant_star_action(room, seat):
    state = room["gameState"]
    if not state["bonus"]: return
    zero_refill_action_market(state)
    zero_acquire_action(state, seat, 0 if state["actionMarket"] else None, True)


def zero_reveal(room, seat, index):
    card = room["gameState"]["people"][seat]["board"][index]
    if card.get("removed") or card.get("up"): return False
    card["up"] = True
    if card["kind"] == "star": zero_grant_star_action(room, seat)
    return True


def zero_draw(state):
    if not state["deck"]:
        top = state["discard"].pop() if state["discard"] else None
        state["deck"] = state["discard"]
        state["discard"] = [top] if top else []
        random.Random(f"{state['seed']}:{state['version']}:refill").shuffle(state["deck"])
    if not state["deck"]: raise ValueError("La pioche est vide.")
    return state["deck"].pop()


def zero_finish_game(room):
    state = room["gameState"]
    winner = min(range(len(state["people"])), key=lambda seat: state["people"][seat]["score"])
    state["over"] = True; state["winner"] = winner; room["phase"] = "finished"; room["results"] = {}
    for seat, slot in enumerate(room["seats"]):
        key = slot.get("playerId") or f"bot-{seat}"; score = state["people"][seat]["score"]
        room["results"][key] = {"score": score, "scoreLabel": f"{score} points", "lowerIsBetter": True, "won": seat == winner, "bot": not bool(slot.get("playerId")), "seatIndex": seat}


def zero_start_round(room):
    state = room["gameState"]
    state["deck"] = zero_deck(f"{state['seed']}:{state['round']}", state["bonus"])
    first_discard = state["deck"].pop()
    while first_discard["kind"] == "star":
        state["deck"].insert(0, first_discard)
        random.Random(f"{state['seed']}:{state['round']}:discard").shuffle(state["deck"])
        first_discard = state["deck"].pop()
    state["discard"] = [first_discard]
    state["actionDeck"] = zero_action_deck(f"{state['seed']}:{state['round']}:actions") if state["bonus"] else []
    state["actionMarket"] = []
    state["actionDiscard"] = []
    zero_refill_action_market(state)
    reveals = game_option_int(room, "initialReveals", 2, 2, 4)
    state["initialReveals"] = reveals; state["setupCounts"] = [0] * len(state["people"])
    for seat, person in enumerate(state["people"]):
        person["board"] = [{**state["deck"].pop(), "up": False, "removed": False} for _ in range(12)]
        person["actions"] = []
        person["roundBonus"] = 0
        if color_game_bot_seat(room, seat):
            for index in random.Random(f"{state['seed']}:{state['round']}:{seat}").sample(range(12), reveals): zero_reveal(room, seat, index)
            state["setupCounts"][seat] = reveals
    state.update(phase="setup", turn=0, pending=None, pendingAction=None, peekFor=None, finisher=None, extraTurns=0, message="Choisissez vos cartes initiales à révéler.")
    zero_try_begin(room)


def zero_try_begin(room):
    state = room["gameState"]
    if not all(count >= state["initialReveals"] for count in state["setupCounts"]): return
    state["phase"] = "play"
    state["turnSerial"] += 1
    state["turn"] = max(range(len(state["people"])), key=lambda seat: zero_score(state["people"][seat]))
    state["message"] = f"{pirate_name(room, state['turn'])} commence."
    zero_schedule_bot(room)


def zero_finish_round(room):
    state = room["gameState"]
    for seat, person in enumerate(state["people"]):
        for card in person["board"]:
            if not card.get("removed"): card["up"] = True
        zero_remove_groups(room, seat)
    scores = [zero_score(person) + (len(person["actions"]) * 10 if state["bonus"] else 0) for person in state["people"]]
    if zero_rule(room, "doubleFinish", True) and scores[state["finisher"]] != min(scores): scores[state["finisher"]] *= 2
    for seat, value in enumerate(scores): state["people"][seat]["score"] += value
    limit = game_option_int(room, "limit", 100, 1, 10000)
    if any(person["score"] >= limit for person in state["people"]): zero_finish_game(room)
    else:
        state["round"] += 1
        zero_start_round(room)


def zero_next(room):
    state = room["gameState"]
    if zero_all_revealed(state["people"][state["turn"]]) and state["finisher"] is None: state["finisher"] = state["turn"]
    state["pending"] = None; state["pendingAction"] = None; state["peekFor"] = None
    if state["extraTurns"] > 0:
        state["extraTurns"] -= 1; state["turnSerial"] += 1
        state["message"] = f"{pirate_name(room, state['turn'])} rejoue."
        zero_schedule_bot(room); return
    next_seat = (state["turn"] + 1) % len(state["people"])
    if state["finisher"] is not None and next_seat == state["finisher"]:
        zero_finish_round(room); return
    state["turn"] = next_seat
    state["turnSerial"] += 1
    state["message"] = f"Au tour de {pirate_name(room, next_seat)}."
    zero_schedule_bot(room)


def zero_replace(room, seat, index, replacement):
    state = room["gameState"]
    if not 0 <= index < 12 or state["people"][seat]["board"][index].get("removed"): raise ValueError("Case de grille invalide.")
    old = state["people"][seat]["board"][index]
    state["people"][seat]["board"][index] = {**replacement, "up": True, "removed": False}
    if not old.get("removed"): state["discard"].append({"id": old["id"], "kind": old["kind"], "value": old["value"]})
    if replacement["kind"] == "star": zero_grant_star_action(room, seat)
    zero_remove_groups(room, seat)


def zero_consume_defense(room, seat):
    state = room["gameState"]
    defense_index = next((index for index, action in enumerate(state["people"][seat]["actions"]) if action["id"] == "defense"), None)
    if defense_index is None: return False
    state["people"][seat]["actions"].pop(defense_index)
    state["actionDiscard"].append("defense")
    return True


def zero_action_effect(room, seat, action_id, bot=False):
    state = room["gameState"]
    person = state["people"][seat]
    if action_id == "selfSwap":
        available = [index for index, card in enumerate(person["board"]) if not card.get("removed")]
        if bot:
            if len(available) > 1:
                first, last = available[0], available[-1]
                person["board"][first], person["board"][last] = person["board"][last], person["board"][first]
                zero_remove_groups(room, seat)
            zero_next(room)
        else: state["pendingAction"] = {"seat": seat, "type": "selfSwap", "picks": []}
    elif action_id == "doubleTurn":
        state["extraTurns"] += 2; zero_next(room)
    elif action_id == "drawThree":
        choices = [zero_draw(state) for _ in range(min(3, len(state["deck"]) + len(state["discard"])))]
        if not choices: zero_next(room); return
        if bot:
            selected = min(choices, key=lambda card: card["value"])
            for card in choices:
                if card is not selected: state["discard"].append(card)
            candidates = [(card["value"], index) for index, card in enumerate(person["board"]) if not card.get("removed") and zero_visible(card)]
            hidden = [index for index, card in enumerate(person["board"]) if not card.get("removed") and not card.get("up")]
            target = max(candidates)[1] if candidates else hidden[0]
            zero_replace(room, seat, target, selected); zero_next(room)
        else: state["pendingAction"] = {"seat": seat, "type": "drawThree", "choices": choices}
    elif action_id == "inspect":
        if bot: zero_next(room)
        else: state["pendingAction"] = {"seat": seat, "type": "inspect", "picks": []}
    elif action_id == "reactivate":
        previous = next((item for item in reversed(state["actionDiscard"][:-1]) if item not in {"reactivate", "defense"}), None)
        if previous: zero_action_effect(room, seat, previous, bot)
        else: zero_next(room)
    elif action_id == "defense":
        state["extraTurns"] += 1; zero_next(room)
    elif action_id == "opponentSwap":
        if bot:
            target = next(index for index in range(len(state["people"])) if index != seat)
            if not zero_consume_defense(room, target):
                own_cards = [(card["value"], index) for index, card in enumerate(person["board"]) if not card.get("removed")]
                other_cards = [(card["value"], index) for index, card in enumerate(state["people"][target]["board"]) if not card.get("removed")]
                if own_cards and other_cards:
                    own_index = max(own_cards)[1]; other_index = min(other_cards)[1]
                    person["board"][own_index], state["people"][target]["board"][other_index] = state["people"][target]["board"][other_index], person["board"][own_index]
                    zero_remove_groups(room, seat); zero_remove_groups(room, target)
            zero_next(room)
        else: state["pendingAction"] = {"seat": seat, "type": "opponentSwap", "picks": []}
    elif action_id == "thief":
        targets = [(len(target["actions"]), index) for index, target in enumerate(state["people"]) if index != seat and target["actions"]]
        if targets:
            target = max(targets)[1]
            if not zero_consume_defense(room, target):
                stolen = state["people"][target]["actions"].pop()
                person["actions"].append({**stolen, "readyAfter": state["turnSerial"] + 1})
        state["extraTurns"] += 1; zero_next(room)
    elif action_id == "meteor":
        for target, opponent in enumerate(state["people"]):
            if target == seat or zero_consume_defense(room, target): continue
            visible_cards = [(card["value"], index) for index, card in enumerate(opponent["board"]) if not card.get("removed") and zero_visible(card)]
            available = [index for index, card in enumerate(opponent["board"]) if not card.get("removed")]
            if available: zero_replace(room, target, max(visible_cards)[1] if visible_cards else available[0], zero_draw(state))
        zero_next(room)
    else: raise ValueError("Action bonus inconnue.")


def zero_bot_turn(room):
    state = room["gameState"]; seat = state["turn"]; person = state["people"][seat]
    ready_action = next((action for action in person["actions"] if action["readyAfter"] <= state["turnSerial"] and action["id"] != "defense"), None)
    if state["bonus"] and ready_action:
        person["actions"].remove(ready_action); state["actionDiscard"].append(ready_action["id"])
        zero_action_effect(room, seat, ready_action["id"], True); return
    if state["bonus"] and state["actionMarket"] and random.Random(f"{state['seed']}:{state['version']}:acquire").random() < .14:
        zero_acquire_action(state, seat, 0, False); zero_next(room); return
    visible = [(card["value"], index) for index, card in enumerate(person["board"]) if zero_visible(card)]
    hidden = [index for index, card in enumerate(person["board"]) if not card.get("up") and not card.get("removed")]
    target = max(visible)[1] if visible else hidden[0]
    top = state["discard"][-1]
    drawn = state["discard"].pop() if top["value"] <= (max(visible)[0] if visible else 8) else zero_draw(state)
    if drawn["value"] <= (max(visible)[0] if visible else 8): zero_replace(room, seat, target, drawn)
    else:
        state["discard"].append(drawn)
        if hidden: zero_reveal(room, seat, hidden[0])
        zero_remove_groups(room, seat)
    zero_next(room)


def zero_schedule_bot(room):
    state = room.get("gameState")
    if not state or room["phase"] != "playing" or state["phase"] != "play" or not color_game_bot_seat(room, state["turn"]):
        if state: state["botDueAt"] = None
        return
    state["botDueAt"] = time.time() + .5


def zero_run_due_bot(room, now=None):
    state = room.get("gameState"); now = now or time.time()
    if not state or not state.get("botDueAt") or state["botDueAt"] > now: return False
    state["botDueAt"] = None; zero_bot_turn(room); state["version"] += 1; zero_schedule_bot(room); return True


def zero_initialize(room):
    count = len(room["seats"])
    room["gameState"] = {"version": 1, "seed": secrets.token_hex(32), "round": 1, "people": [{"score": 0, "board": [], "actions": [], "roundBonus": 0} for _ in range(count)], "deck": [], "discard": [], "actionDeck": [], "actionMarket": [], "actionDiscard": [], "bonus": zero_rule(room, "bonusRules", False), "phase": "setup", "turn": 0, "turnSerial": 0, "pending": None, "pendingAction": None, "peekFor": None, "finisher": None, "extraTurns": 0, "over": False, "winner": None, "message": "", "botDueAt": None}
    zero_start_round(room)


def zero_public_card(card):
    return dict(card) if card.get("up") or card.get("removed") else {"up": False, "removed": False}


def zero_public_state(room, player_id):
    state = room.get("gameState")
    if not state: return None
    seat = color_game_seat(room, player_id); pending = state.get("pending"); pending_action = state.get("pendingAction")
    private_action = None
    if pending_action and pending_action["seat"] == seat:
        private_action = {key: value for key, value in pending_action.items() if key != "seat"}
    peek = state.get("peekFor") if (state.get("peekFor") or {}).get("seat") == seat else None
    people = []
    for person_seat, person in enumerate(state["people"]):
        item = {"score": person["score"], "roundBonus": person.get("roundBonus", 0), "board": [zero_public_card(card) for card in person["board"]], "actionCount": len(person["actions"])}
        if person_seat == seat: item["actions"] = [dict(action) for action in person["actions"]]
        people.append(item)
    return {"version": state["version"], "yourSeat": seat, "round": state["round"], "phase": state["phase"], "initialReveals": state["initialReveals"], "setupCount": state["setupCounts"][seat] if seat is not None else 0, "people": people, "deckCount": len(state["deck"]), "discardTop": state["discard"][-1] if state["discard"] else None, "pending": dict(pending["card"]) if pending and pending["seat"] == seat else None, "pendingFromDiscard": bool(pending and pending["seat"] == seat and pending["fromDiscard"]), "pendingAction": private_action, "peek": dict(peek) if peek else None, "actionDeckCount": len(state["actionDeck"]), "actionMarket": list(state["actionMarket"]), "turnSerial": state["turnSerial"], "turn": state["turn"], "over": state["over"], "winner": state["winner"], "message": state["message"], "bonusSupported": True, "bonus": state["bonus"]}


def zero_action(room, player, action):
    if not isinstance(action, dict): raise ValueError("Action Grille Zéro invalide.")
    state = room.get("gameState"); seat = color_game_seat(room, player["id"])
    if seat is None or state.get("over"): raise ValueError("Aucun siège actif.")
    action_type = action.get("type")
    if action_type == "setup":
        index = int(action.get("index", -1))
        if state["phase"] != "setup" or state["setupCounts"][seat] >= state["initialReveals"] or not 0 <= index < 12 or state["people"][seat]["board"][index]["up"]: raise ValueError("Révélation initiale invalide.")
        zero_reveal(room, seat, index); state["setupCounts"][seat] += 1; zero_try_begin(room)
    else:
        if state["phase"] != "play" or seat != state["turn"]: raise ValueError("Ce n’est pas votre tour.")
        if action_type == "take":
            if state.get("pending") or state.get("pendingAction"): raise ValueError("Une action est déjà en attente.")
            source = action.get("source")
            card = state["discard"].pop() if source == "discard" and state["discard"] else zero_draw(state) if source == "deck" else None
            if card is None: raise ValueError("Source invalide.")
            state["pending"] = {"seat": seat, "card": card, "fromDiscard": source == "discard"}
        elif action_type == "replace":
            pending = state.get("pending")
            if not pending or pending["seat"] != seat: raise ValueError("Aucune carte à placer.")
            zero_replace(room, seat, int(action.get("index", -1)), pending["card"]); zero_next(room)
        elif action_type == "discard-reveal":
            pending = state.get("pending"); index = int(action.get("index", -1))
            if not pending or pending["seat"] != seat or pending["fromDiscard"] or not 0 <= index < 12 or state["people"][seat]["board"][index].get("up"): raise ValueError("Défausse ou révélation invalide.")
            state["discard"].append(pending["card"]); zero_reveal(room, seat, index); zero_remove_groups(room, seat); zero_next(room)
        elif action_type == "acquire-action":
            if not state["bonus"] or state.get("pending") or state.get("pendingAction"): raise ValueError("Acquisition impossible.")
            market_index = action.get("marketIndex")
            market_index = int(market_index) if market_index is not None else None
            if not zero_acquire_action(state, seat, market_index, False): raise ValueError("Cette action n’est plus disponible.")
            zero_next(room)
        elif action_type == "use-action":
            if not state["bonus"] or state.get("pending") or state.get("pendingAction"): raise ValueError("Action indisponible.")
            action_index = int(action.get("actionIndex", -1)); actions = state["people"][seat]["actions"]
            if not 0 <= action_index < len(actions) or actions[action_index]["readyAfter"] > state["turnSerial"]: raise ValueError("Cette action n’est pas encore jouable.")
            selected = actions.pop(action_index); state["actionDiscard"].append(selected["id"])
            zero_action_effect(room, seat, selected["id"], False)
        elif action_type == "action-cell":
            pending_action = state.get("pendingAction"); target = int(action.get("player", -1)); index = int(action.get("index", -1))
            if not pending_action or pending_action["seat"] != seat or not 0 <= target < len(state["people"]) or not 0 <= index < 12: raise ValueError("Sélection bonus invalide.")
            card = state["people"][target]["board"][index]
            if card.get("removed"): raise ValueError("Cette carte est retirée.")
            if pending_action["type"] == "selfSwap":
                if target != seat or index in pending_action["picks"]: raise ValueError("Choisissez deux cartes distinctes de votre grille.")
                pending_action["picks"].append(index)
                if len(pending_action["picks"]) == 2:
                    first, second = pending_action["picks"]
                    state["people"][seat]["board"][first], state["people"][seat]["board"][second] = state["people"][seat]["board"][second], state["people"][seat]["board"][first]
                    zero_remove_groups(room, seat); zero_next(room)
            elif pending_action["type"] == "inspect":
                row = index // 4; indexes = [row * 4 + offset for offset in range(4)]
                state["peekFor"] = {"seat": seat, "player": target, "indexes": indexes, "cards": [dict(state["people"][target]["board"][item]) for item in indexes]}
                pending_action["type"] = "inspectContinue"
            elif pending_action["type"] == "opponentSwap":
                if not pending_action["picks"]:
                    if target != seat: raise ValueError("Choisissez d’abord votre carte.")
                    pending_action["picks"].append({"player": target, "index": index})
                else:
                    if target == seat: raise ValueError("Choisissez ensuite une carte adverse.")
                    if not zero_consume_defense(room, target):
                        own_index = pending_action["picks"][0]["index"]
                        state["people"][seat]["board"][own_index], state["people"][target]["board"][index] = state["people"][target]["board"][index], state["people"][seat]["board"][own_index]
                        zero_remove_groups(room, seat); zero_remove_groups(room, target)
                    zero_next(room)
            elif pending_action["type"] == "revealOwn":
                if target != seat or not zero_reveal(room, seat, index): raise ValueError("Carte à révéler invalide.")
                zero_remove_groups(room, seat); zero_next(room)
            else: raise ValueError("Cette action n’attend pas de carte.")
        elif action_type == "choose-three":
            pending_action = state.get("pendingAction"); choice = int(action.get("choice", -1))
            if not pending_action or pending_action["seat"] != seat or pending_action["type"] != "drawThree": raise ValueError("Aucun choix de trois en attente.")
            choices = pending_action["choices"]
            if choice < -1 or choice >= len(choices): raise ValueError("Choix invalide.")
            if choice == -1:
                state["discard"].extend(choices); state["pendingAction"] = {"seat": seat, "type": "revealOwn", "picks": []}
            else:
                selected = choices[choice]
                state["discard"].extend(card for index, card in enumerate(choices) if index != choice)
                state["pendingAction"] = None; state["pending"] = {"seat": seat, "card": selected, "fromDiscard": True}
        elif action_type == "continue-action":
            if not state.get("pendingAction") or state["pendingAction"]["seat"] != seat or state["pendingAction"]["type"] != "inspectContinue": raise ValueError("Aucune inspection à terminer.")
            zero_next(room)
        else: raise ValueError("Action Grille Zéro inconnue.")
    state["version"] += 1; zero_schedule_bot(room)


def rummy_card_deck(room, seed):
    copies = 2 if len(room["seats"]) > 2 else 1
    cards = [{"id": f"{copy}-{suit}-{value}", "suit": suit, "value": value} for copy in range(copies) for suit in range(4) for value in range(1, 14)]
    if course_rule(room, "jokers", True):
        cards += [{"id": f"joker-{index}", "joker": True, "value": 0} for index in range(copies * 2)]
    random.Random(seed).shuffle(cards)
    return cards


def rummy_card_valid_group(cards):
    if len(cards) < 3: return False
    normal = [card for card in cards if not card.get("joker")]
    if not normal: return False
    is_set = len(cards) <= 4 and all(card["value"] == normal[0]["value"] for card in normal) and len({card["suit"] for card in normal}) == len(normal)
    if is_set: return True
    if len({card["suit"] for card in normal}) != 1: return False
    values = sorted(card["value"] for card in normal)
    if len(set(values)) != len(values): return False
    missing = values[-1] - values[0] + 1 - len(values)
    return missing <= len(cards) - len(normal) and values[-1] - values[0] < len(cards)


def rummy_card_points(card):
    return 0 if card.get("joker") else min(card["value"], 10)


def rummy_card_snapshot(state):
    return {key: json.loads(json.dumps(state[key])) for key in ("stock", "discard", "hands", "groups", "people", "turn", "phase")}


def rummy_card_restore(state):
    backup = state.get("turnBackup")
    if not backup: return False
    for key, value in backup.items(): state[key] = json.loads(json.dumps(value))
    return True


def rummy_card_finish(room, winner):
    state = room["gameState"]
    state["over"] = True; state["winner"] = winner; room["phase"] = "finished"; room["results"] = {}
    for seat, slot in enumerate(room["seats"]):
        remaining = sum(rummy_card_points(card) for card in state["hands"][seat])
        key = slot.get("playerId") or f"bot-{seat}"
        room["results"][key] = {"score": remaining, "scoreLabel": "Main terminée" if seat == winner else f"{remaining} points restants", "lowerIsBetter": True, "won": seat == winner, "bot": not bool(slot.get("playerId")), "seatIndex": seat}


def rummy_card_next(room):
    state = room["gameState"]
    state["turn"] = (state["turn"] + 1) % len(state["hands"]); state["phase"] = "draw"; state["turnBackup"] = rummy_card_snapshot(state)
    state["message"] = f"{pirate_name(room, state['turn'])} doit piocher."
    rummy_card_schedule_bot(room)


def rummy_card_draw(state, source):
    if source == "discard" and state["discard"]: return state["discard"].pop()
    if not state["stock"] and len(state["discard"]) > 1:
        top = state["discard"].pop(); state["stock"] = state["discard"]; state["discard"] = [top]
        random.Random(f"{state['seed']}:{state['version']}:recycle").shuffle(state["stock"])
    return state["stock"].pop() if state["stock"] else None


def rummy_card_take_ids(hand, values):
    if not isinstance(values, list) or len(values) != len(set(map(str, values))): raise ValueError("Sélection de cartes invalide.")
    cards = []
    for card_id in values:
        card = next((item for item in hand if item["id"] == str(card_id)), None)
        if card is None: raise ValueError("Une carte sélectionnée n’est pas dans votre main.")
        cards.append(card)
    return cards


def rummy_card_bot(room):
    state = room["gameState"]; seat = state["turn"]; hand = state["hands"][seat]
    card = rummy_card_draw(state, "stock")
    if card: hand.append(card)
    state["phase"] = "play"
    while True:
        found = None
        for size in range(min(5, len(hand)), 2, -1):
            found = next((list(combo) for combo in itertools.combinations(hand, size) if rummy_card_valid_group(combo) and (state["people"][seat]["opened"] or sum(rummy_card_points(item) for item in combo) >= state["openingMinimum"])), None)
            if found: break
        if not found: break
        for item in found: hand.remove(item)
        state["groups"].append(found); state["people"][seat]["opened"] = True
    if state["people"][seat]["opened"]:
        for item in list(hand):
            group_index = next((index for index, group in enumerate(state["groups"]) if rummy_card_valid_group(group + [item])), None)
            if group_index is not None: hand.remove(item); state["groups"][group_index].append(item)
    if not hand: rummy_card_finish(room, seat); return
    discarded = max(hand, key=rummy_card_points); hand.remove(discarded); state["discard"].append(discarded); rummy_card_next(room)


def rummy_card_schedule_bot(room):
    state = room.get("gameState")
    if not state or room["phase"] != "playing" or not color_game_bot_seat(room, state["turn"]):
        if state: state["botDueAt"] = None
        return
    state["botDueAt"] = time.time() + .5


def rummy_card_run_due_bot(room, now=None):
    state = room.get("gameState"); now = now or time.time()
    if not state or not state.get("botDueAt") or state["botDueAt"] > now: return False
    state["botDueAt"] = None; rummy_card_bot(room); state["version"] += 1; rummy_card_schedule_bot(room); return True


def rummy_card_initialize(room):
    seed = secrets.token_hex(32); count = len(room["seats"]); stock = rummy_card_deck(room, seed); hands = [[] for _ in range(count)]
    for _ in range(10):
        for hand in hands: hand.append(stock.pop())
    room["gameState"] = {"version": 1, "seed": seed, "stock": stock, "discard": [stock.pop()], "hands": hands, "groups": [], "people": [{"opened": False} for _ in range(count)], "turn": 0, "phase": "draw", "openingMinimum": game_option_int(room, "openingMinimum", 30, 0, 100), "turnBackup": None, "over": False, "winner": None, "message": "Piochez dans le paquet ou la défausse.", "botDueAt": None}
    room["gameState"]["turnBackup"] = rummy_card_snapshot(room["gameState"]); rummy_card_schedule_bot(room)


def rummy_card_public_state(room, player_id):
    state = room.get("gameState")
    if not state: return None
    seat = color_game_seat(room, player_id)
    return {"version": state["version"], "yourSeat": seat, "hand": list(state["hands"][seat]) if seat is not None else [], "handCounts": [len(hand) for hand in state["hands"]], "stockCount": len(state["stock"]), "discardTop": state["discard"][-1] if state["discard"] else None, "groups": [list(group) for group in state["groups"]], "opened": [person["opened"] for person in state["people"]], "turn": state["turn"], "phase": state["phase"], "openingMinimum": state["openingMinimum"], "over": state["over"], "winner": state["winner"], "message": state["message"]}


def rummy_card_action(room, player, action):
    if not isinstance(action, dict): raise ValueError("Action Rami Cartes invalide.")
    state = room.get("gameState"); seat = color_game_seat(room, player["id"])
    if seat is None or state.get("over") or seat != state["turn"]: raise ValueError("Ce n’est pas votre tour.")
    action_type = action.get("type"); hand = state["hands"][seat]
    if action_type == "draw":
        if state["phase"] != "draw": raise ValueError("Vous avez déjà pioché.")
        source = action.get("source", "stock"); card = rummy_card_draw(state, source)
        if card is None: raise ValueError("Aucune carte disponible.")
        hand.append(card); state["phase"] = "play"; state["message"] = "Posez des groupes puis défaussez une carte."
    elif action_type == "lay":
        if state["phase"] != "play": raise ValueError("Piochez avant de poser.")
        cards = rummy_card_take_ids(hand, action.get("cardIds"))
        if not rummy_card_valid_group(cards): raise ValueError("Ce groupe ou cette suite est invalide.")
        if not state["people"][seat]["opened"] and sum(rummy_card_points(card) for card in cards) < state["openingMinimum"]: raise ValueError("La pose initiale n’atteint pas le minimum requis.")
        for card in cards: hand.remove(card)
        state["groups"].append(cards); state["people"][seat]["opened"] = True
        if not hand: rummy_card_finish(room, seat)
    elif action_type == "add":
        if state["phase"] != "play" or not state["people"][seat]["opened"]: raise ValueError("Vous devez avoir ouvert avant de compléter la table.")
        index = int(action.get("group", -1)); cards = rummy_card_take_ids(hand, action.get("cardIds"))
        if not 0 <= index < len(state["groups"]) or not cards or not rummy_card_valid_group(state["groups"][index] + cards): raise ValueError("Cet ajout rendrait le groupe invalide.")
        for card in cards: hand.remove(card)
        state["groups"][index] += cards
        if not hand: rummy_card_finish(room, seat)
    elif action_type == "discard":
        if state["phase"] != "play": raise ValueError("Piochez avant de défausser.")
        cards = rummy_card_take_ids(hand, [action.get("cardId")]); hand.remove(cards[0]); state["discard"].append(cards[0])
        if not hand: rummy_card_finish(room, seat)
        else: rummy_card_next(room)
    elif action_type == "undo":
        if not rummy_card_restore(state): raise ValueError("Ce tour ne peut pas être annulé.")
        state["message"] = "Le tour a été restauré."
    else: raise ValueError("Action Rami Cartes inconnue.")
    state["version"] += 1; rummy_card_schedule_bot(room)


RUMMY_TILE_COLORS = ("red", "blue", "black", "orange")


def rummy_tile_pool(seed):
    tiles = []; tile_id = 1
    for color in RUMMY_TILE_COLORS:
        for value in range(1, 14):
            for _ in range(2): tiles.append({"id": tile_id, "color": color, "value": value}); tile_id += 1
    tiles += [{"id": tile_id, "joker": True}, {"id": tile_id + 1, "joker": True}]
    random.Random(seed).shuffle(tiles)
    return tiles


def rummy_tile_valid_group(tiles):
    if len(tiles) < 3: return False
    normal = [tile for tile in tiles if not tile.get("joker")]; jokers = len(tiles) - len(normal)
    if not normal: return False
    if len(tiles) <= 4 and len({tile["value"] for tile in normal}) == 1 and len({tile["color"] for tile in normal}) == len(normal): return True
    if len({tile["color"] for tile in normal}) != 1 or len({tile["value"] for tile in normal}) != len(normal): return False
    values = {tile["value"] for tile in normal}
    return any(values.issubset(set(range(start, start + len(tiles)))) and len(set(range(start, start + len(tiles))) - values) == jokers for start in range(1, 15 - len(tiles)))


def rummy_tile_points(tile):
    return 30 if tile.get("joker") else tile["value"]


def rummy_tile_snapshot(state):
    return {key: json.loads(json.dumps(state[key])) for key in ("pool", "racks", "table", "people", "turn", "changed", "openingPoints", "passes")}


def rummy_tile_restore(state):
    backup = state.get("turnBackup")
    if not backup: return False
    for key, value in backup.items(): state[key] = json.loads(json.dumps(value))
    return True


def rummy_tile_finish(room, winner):
    state = room["gameState"]; state["over"] = True; state["winner"] = winner; room["phase"] = "finished"; room["results"] = {}
    totals = [sum(rummy_tile_points(tile) for tile in rack) for rack in state["racks"]]
    gain = sum(total for seat, total in enumerate(totals) if seat != winner)
    for seat, slot in enumerate(room["seats"]):
        score = gain if seat == winner else -totals[seat]; key = slot.get("playerId") or f"bot-{seat}"
        room["results"][key] = {"score": score, "scoreLabel": f"{score} points", "won": seat == winner, "bot": not bool(slot.get("playerId")), "seatIndex": seat}


def rummy_tile_next(room):
    state = room["gameState"]; state["turn"] = (state["turn"] + 1) % len(state["racks"]); state["changed"] = False; state["openingPoints"] = 0; state["turnBackup"] = rummy_tile_snapshot(state); state["message"] = f"Au tour de {pirate_name(room, state['turn'])}."; rummy_tile_schedule_bot(room)


def rummy_tile_find_meld(rack, opening=False):
    for size in range(min(6, len(rack)), 2, -1):
        for combo in itertools.combinations(rack, size):
            if rummy_tile_valid_group(combo) and (not opening or sum(rummy_tile_points(tile) for tile in combo) >= 30): return list(combo)
    return None


def rummy_tile_bot(room):
    state = room["gameState"]; seat = state["turn"]; rack = state["racks"][seat]; changed = False
    while True:
        meld = rummy_tile_find_meld(rack, not state["people"][seat]["opened"])
        if not meld: break
        for tile in meld: rack.remove(tile)
        state["table"].append(meld); state["people"][seat]["opened"] = True; changed = True
    if state["people"][seat]["opened"]:
        for tile in list(rack):
            target = next((group for group in state["table"] if rummy_tile_valid_group(group + [tile])), None)
            if target is not None: rack.remove(tile); target.append(tile); changed = True
    if not rack: rummy_tile_finish(room, seat); return
    if changed:
        state["passes"] = 0; rummy_tile_next(room); return
    if state["pool"]:
        rack.append(state["pool"].pop()); state["passes"] = 0
    else: state["passes"] += 1
    if not state["pool"] and state["passes"] >= len(state["racks"]):
        winner = min(range(len(state["racks"])), key=lambda index: sum(rummy_tile_points(tile) for tile in state["racks"][index])); rummy_tile_finish(room, winner)
    else: rummy_tile_next(room)


def rummy_tile_schedule_bot(room):
    state = room.get("gameState")
    if not state or room["phase"] != "playing" or not color_game_bot_seat(room, state["turn"]):
        if state: state["botDueAt"] = None
        return
    state["botDueAt"] = time.time() + .55


def rummy_tile_run_due_bot(room, now=None):
    state = room.get("gameState"); now = now or time.time()
    if not state or not state.get("botDueAt") or state["botDueAt"] > now: return False
    state["botDueAt"] = None; rummy_tile_bot(room); state["version"] += 1; rummy_tile_schedule_bot(room); return True


def rummy_tile_initialize(room):
    seed = secrets.token_hex(32); count = len(room["seats"]); pool = rummy_tile_pool(seed); racks = [[] for _ in range(count)]
    for _ in range(14):
        for rack in racks: rack.append(pool.pop())
    room["gameState"] = {"version": 1, "seed": seed, "pool": pool, "racks": racks, "table": [], "people": [{"opened": False} for _ in range(count)], "turn": 0, "changed": False, "openingPoints": 0, "passes": 0, "turnBackup": None, "over": False, "winner": None, "message": "Posez des groupes ou piochez.", "botDueAt": None}
    room["gameState"]["turnBackup"] = rummy_tile_snapshot(room["gameState"]); rummy_tile_schedule_bot(room)


def rummy_tile_public_state(room, player_id):
    state = room.get("gameState")
    if not state: return None
    seat = color_game_seat(room, player_id)
    return {"version": state["version"], "yourSeat": seat, "rack": list(state["racks"][seat]) if seat is not None else [], "rackCounts": [len(rack) for rack in state["racks"]], "poolCount": len(state["pool"]), "table": [list(group) for group in state["table"]], "opened": [person["opened"] for person in state["people"]], "turn": state["turn"], "changed": state["changed"], "openingPoints": state["openingPoints"], "over": state["over"], "winner": state["winner"], "message": state["message"]}


def rummy_tile_rearrange(state, seat, groups):
    if not isinstance(groups, list) or any(not isinstance(group, list) for group in groups): raise ValueError("Table de jeu invalide.")
    identifiers = [int(tile_id) for group in groups for tile_id in group]
    if len(identifiers) != len(set(identifiers)): raise ValueError("Une tuile ne peut apparaître qu’une fois.")
    old_table = [tile for group in state["table"] for tile in group]; rack = state["racks"][seat]; available = {tile["id"]: tile for tile in old_table + rack}
    if any(tile_id not in available for tile_id in identifiers) or not {tile["id"] for tile in old_table}.issubset(identifiers): raise ValueError("La table contient une tuile inaccessible ou en perd une.")
    rebuilt = [[available[int(tile_id)] for tile_id in group] for group in groups]
    if any(not rummy_tile_valid_group(group) for group in rebuilt): raise ValueError("Tous les groupes doivent rester valides.")
    old_ids = {tile["id"] for tile in old_table}; used_from_rack = [available[tile_id] for tile_id in identifiers if tile_id not in old_ids]
    if not state["people"][seat]["opened"]:
        old_signatures = [{tile["id"] for tile in group} for group in state["turnBackup"]["table"]]
        if any(signature not in [{tile["id"] for tile in group} for group in rebuilt] for signature in old_signatures): raise ValueError("La table existante ne peut pas être remaniée avant l’ouverture.")
        initial_ids = {tile["id"] for group in state["turnBackup"]["table"] for tile in group}
        state["openingPoints"] = sum(rummy_tile_points(available[tile_id]) for tile_id in identifiers if tile_id not in initial_ids)
    used_ids = {tile["id"] for tile in used_from_rack}; state["racks"][seat] = [tile for tile in rack if tile["id"] not in used_ids]; state["table"] = rebuilt; state["changed"] = bool(used_from_rack) or rebuilt != state["turnBackup"]["table"]


def rummy_tile_action(room, player, action):
    if not isinstance(action, dict): raise ValueError("Action Rami Tuiles invalide.")
    state = room.get("gameState"); seat = color_game_seat(room, player["id"])
    if seat is None or state.get("over") or seat != state["turn"]: raise ValueError("Ce n’est pas votre tour.")
    action_type = action.get("type")
    if action_type == "rearrange": rummy_tile_rearrange(state, seat, action.get("groups"))
    elif action_type == "end":
        if not state["changed"]: raise ValueError("Aucune tuile n’a été posée.")
        if not state["people"][seat]["opened"]:
            if state["openingPoints"] < 30: raise ValueError("L’ouverture doit atteindre 30 points.")
            state["people"][seat]["opened"] = True
        if not state["racks"][seat]: rummy_tile_finish(room, seat)
        else: state["passes"] = 0; rummy_tile_next(room)
    elif action_type == "draw":
        rummy_tile_restore(state)
        if state["pool"]: state["racks"][seat].append(state["pool"].pop()); state["passes"] = 0
        else: state["passes"] += 1
        if not state["pool"] and state["passes"] >= len(state["racks"]):
            winner = min(range(len(state["racks"])), key=lambda index: sum(rummy_tile_points(tile) for tile in state["racks"][index])); rummy_tile_finish(room, winner)
        else: rummy_tile_next(room)
    elif action_type == "undo":
        if not rummy_tile_restore(state): raise ValueError("Ce tour ne peut pas être annulé.")
    else: raise ValueError("Action Rami Tuiles inconnue.")
    state["version"] += 1; rummy_tile_schedule_bot(room)


PRIVATE_GAME_ENGINES = {
    PRIVATE_COLOR_GAME: {
        "initialize": color_game_initialize,
        "public_state": color_game_public_state,
        "action": color_game_action,
        "run_due": color_game_run_due_bot,
        "on_disconnect": color_game_schedule_bot,
    },
    PRIVATE_SIXTH_GAME: {
        "initialize": sixth_initialize,
        "public_state": sixth_public_state,
        "action": sixth_action,
        "run_due": None,
        "on_disconnect": sixth_bot_choices,
    },
    PRIVATE_PIRATE_GAME: {
        "initialize": pirate_initialize,
        "public_state": pirate_public_state,
        "action": pirate_action,
        "run_due": pirate_run_due_bot,
        "on_disconnect": pirate_schedule_bot,
    },
    PRIVATE_COURSE_GAME: {
        "initialize": course_initialize,
        "public_state": course_public_state,
        "action": course_action,
        "run_due": course_run_due_bot,
        "on_disconnect": course_schedule_bot,
    },
    PRIVATE_CHAT_GAME: {
        "initialize": chat_initialize,
        "public_state": chat_public_state,
        "action": chat_action,
        "run_due": chat_run_due_bot,
        "on_disconnect": chat_schedule_bot,
    },
    PRIVATE_ZERO_GAME: {
        "initialize": zero_initialize,
        "public_state": zero_public_state,
        "action": zero_action,
        "run_due": zero_run_due_bot,
        "on_disconnect": zero_schedule_bot,
    },
    PRIVATE_RUMMY_CARD_GAME: {
        "initialize": rummy_card_initialize,
        "public_state": rummy_card_public_state,
        "action": rummy_card_action,
        "run_due": rummy_card_run_due_bot,
        "on_disconnect": rummy_card_schedule_bot,
    },
    PRIVATE_RUMMY_TILE_GAME: {
        "initialize": rummy_tile_initialize,
        "public_state": rummy_tile_public_state,
        "action": rummy_tile_action,
        "run_due": rummy_tile_run_due_bot,
        "on_disconnect": rummy_tile_schedule_bot,
    },
}


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
                engine = PRIVATE_GAME_ENGINES.get(room["game"])
                if engine and engine.get("run_due") and engine["run_due"](room, now):
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
        if disconnected and room["phase"] == "playing":
            engine = PRIVATE_GAME_ENGINES.get(room["game"])
            if engine and engine.get("on_disconnect"):
                engine["on_disconnect"](room)
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
        if room.get("publicState"):
            result["publicState"] = dict(room["publicState"])
        if room["phase"] != "lobby" and room["game"] in PRIVATE_GAME_ENGINES:
            result["gameState"] = PRIVATE_GAME_ENGINES[room["game"]]["public_state"](room, player_id)
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
                "publicState": {},
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
                room["publicState"] = {}
                room["rematchVotes"].clear()
                room["rematchDeclines"].clear()
                if room["game"] in PRIVATE_GAME_ENGINES:
                    try:
                        PRIVATE_GAME_ENGINES[room["game"]]["initialize"](room)
                    except Exception as error:
                        room["phase"] = "lobby"
                        room["seed"] = None
                        room["startAt"] = None
                        room["paused"] = False
                        room["seats"] = []
                        room["gameState"] = None
                        raise ValueError(f"Impossible d’initialiser cette partie : {error}") from error
                self.emit(room, "start", {"seed": room["seed"], "options": room["options"], "startAt": room["startAt"]}, player["id"])
            elif command == "pause":
                if room["phase"] != "playing":
                    raise ValueError("Aucune partie active à mettre en pause.")
                room["paused"] = bool(payload.get("paused"))
                self.emit(room, "pause", {"paused": room["paused"]}, player["id"])
            elif command == "action":
                if room["phase"] != "playing" or room["paused"]:
                    raise ValueError("La partie n’accepte pas d’action actuellement.")
                if room["game"] in PRIVATE_GAMES:
                    raise ValueError("Ce jeu exige une action privée validée par le serveur.")
                action = validate_public_action(room["game"], payload.get("action"))
                if room["game"] == "games/grid/minesweeper.html" and action["type"] == "minesweeper-start":
                    previous_index = room.get("publicState", {}).get("minesweeperStart")
                    if previous_index is not None:
                        return self.serialize(room, player["id"])
                    room.setdefault("publicState", {})["minesweeperStart"] = action["index"]
                if room["game"] == PUBLIC_BOARD_GAMES:
                    sender_seat = color_game_seat(room, player["id"])
                    controlled_seat = action.get("controlledSeat", sender_seat)
                    if sender_seat is None or controlled_seat != sender_seat and (player["id"] != room["hostId"] or not color_game_bot_seat(room, controlled_seat)):
                        raise PermissionError("Vous ne contrôlez pas ce siège.")
                    action["controlledSeat"] = controlled_seat
                    if action["type"] == "board-roll":
                        dice_count = 1 if room.get("options", {}).get("variant") == "payday" else 2
                        action["dice"] = [secrets.randbelow(6) + 1 for _ in range(dice_count)]
                self.emit(room, "action", {"action": action}, player["id"])
            elif command == "game-action":
                if room["phase"] != "playing" or room["paused"]:
                    raise ValueError("La partie n’accepte pas d’action actuellement.")
                if room["game"] not in PRIVATE_GAMES:
                    raise ValueError("Ce jeu ne possède pas de moteur privé côté serveur.")
                PRIVATE_GAME_ENGINES[room["game"]]["action"](room, player, payload.get("action"))
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
                    room["publicState"] = {}
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
    maximum = GAME_MAX_SEATS.get(game, MAX_PLAYERS)
    if count > maximum:
        raise ValueError(f"Ce jeu LAN accepte au maximum {maximum} places.")
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
