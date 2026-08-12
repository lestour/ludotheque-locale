import importlib.util
import base64
import json
import os
import socket
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("lan_server", ROOT / "server" / "lan_server.py")
LAN = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(LAN)


class LanRoomsTests(unittest.TestCase):
    def setUp(self):
        self.rooms = LAN.LanRooms()

    def test_private_room_lifecycle(self):
        host_room, host_token = self.rooms.create("Hôte", "games/grid/sudoku.html", "private", {"difficulty": "hard"})
        self.assertRegex(host_room["code"], LAN.ROOM_CODE_PATTERN)
        self.assertIsNone(host_room["seed"])
        guest_room, guest_token = self.rooms.join(host_room["code"], "Invité", "games/grid/sudoku.html")
        self.assertEqual(len(guest_room["players"]), 2)

        room, host = self.rooms.authenticate(host_room["code"], host_token)
        _, guest = self.rooms.authenticate(host_room["code"], guest_token)
        self.rooms.command(room, host, "set-options", {"options": {"difficulty": "expert", "showErrors": True}})
        self.rooms.command(room, host, "ready", {"ready": True})
        self.rooms.command(room, guest, "ready", {"ready": True})
        started = self.rooms.command(room, host, "start", {})
        self.assertEqual(started["phase"], "playing")
        self.assertTrue(started["seed"])
        self.assertGreater(started["startAt"], 0)

        paused = self.rooms.command(room, guest, "pause", {"paused": True})
        self.assertTrue(paused["paused"])
        self.rooms.command(room, host, "pause", {"paused": False})
        with self.assertRaises(ValueError):
            self.rooms.command(room, host, "action", {"action": {"type": "cell", "index": 4}})

        self.rooms.command(room, host, "finish", {"result": {"score": 12}})
        finished = self.rooms.command(room, guest, "finish", {"result": {"score": 9}})
        self.assertEqual(finished["phase"], "finished")
        self.rooms.command(room, host, "rematch", {"accept": True})
        reset = self.rooms.command(room, guest, "rematch", {"accept": True})
        self.assertEqual(reset["phase"], "lobby")
        self.assertTrue(all(not player["ready"] for player in reset["players"]))
        self.assertEqual(reset["rematchDeclines"], [])

    def test_public_matchmaking_and_permissions(self):
        first, token = self.rooms.random_join("Alice", "games/board/go.html")
        second, _ = self.rooms.random_join("Bob", "games/board/go.html")
        self.assertEqual(first["code"], second["code"])
        room, player = self.rooms.authenticate(first["code"], token)
        with self.assertRaises(ValueError):
            self.rooms.command(room, player, "start", {})
        with self.assertRaises(PermissionError):
            self.rooms.authenticate(first["code"], "x" * 40)

    def test_two_player_board_games_reject_extra_seats_and_share_winner(self):
        with self.assertRaises(ValueError):
            self.rooms.create("Alice", "games/board/chess.html", "private", {}, 3)
        first, first_token = self.rooms.create("Alice", "games/board/go.html", "private", {}, 2)
        _, second_token = self.rooms.join(first["code"], "Bob", "games/board/go.html")
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        self.rooms.command(room, alice, "start", {})
        self.rooms.command(room, alice, "action", {"action": {"type": "go-move", "index": 40}})
        self.assertEqual(room["events"][-1]["payload"]["action"]["index"], 40)
        self.rooms.command(room, alice, "finish", {"result": {"score": 0, "winnerSeat": 1, "won": False}})
        finished = self.rooms.command(room, bob, "finish", {"result": {"score": 1, "winnerSeat": 1, "won": True}})
        self.assertEqual(finished["phase"], "finished")
        self.assertFalse(finished["results"][alice["id"]]["won"])
        self.assertTrue(finished["results"][bob["id"]]["won"])

    def test_game_specific_seat_limits_are_enforced(self):
        for game, maximum in LAN.GAME_MAX_SEATS.items():
            with self.subTest(game=game):
                self.rooms.create("Alice", game, "private", {}, maximum)
                with self.assertRaises(ValueError):
                    self.rooms.create("Alice", game, "private", {}, maximum + 1)

    def test_private_start_normalizes_options_and_rolls_back_on_engine_failure(self):
        first, token = self.rooms.create("Alice", LAN.PRIVATE_ZERO_GAME, "private", {"initialReveals": "incorrect", "limit": "incorrect", "bonusRules": True}, 2)
        room, alice = self.rooms.authenticate(first["code"], token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        started = self.rooms.command(room, alice, "start", {})
        self.assertEqual(started["gameState"]["initialReveals"], 2)
        self.assertTrue(started["options"]["bonusRules"])
        self.assertTrue(started["gameState"]["bonus"])

        second, token = self.rooms.create("Alice", LAN.PRIVATE_RUMMY_CARD_GAME, "private", {}, 2)
        broken_room, host = self.rooms.authenticate(second["code"], token)
        self.rooms.command(broken_room, host, "ready", {"ready": True})
        engine = LAN.PRIVATE_GAME_ENGINES[LAN.PRIVATE_RUMMY_CARD_GAME]
        initialize = engine["initialize"]
        engine["initialize"] = lambda _: (_ for _ in ()).throw(RuntimeError("échec simulé"))
        try:
            with self.assertRaises(ValueError):
                self.rooms.command(broken_room, host, "start", {})
        finally:
            engine["initialize"] = initialize
        self.assertEqual(broken_room["phase"], "lobby")
        self.assertIsNone(broken_room["gameState"])
        self.assertEqual(broken_room["seats"], [])

    def test_public_actions_are_sanitized_per_game(self):
        first, first_token = self.rooms.create("Alice", "games/board/chess.html", "private", {}, 2)
        _, second_token = self.rooms.join(first["code"], "Bob", "games/board/chess.html")
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        self.rooms.command(room, alice, "start", {})
        with self.assertRaises(ValueError):
            self.rooms.command(room, alice, "action", {"action": {"type": "board-move", "from": [-1, 0], "to": [0, 0]}})
        self.rooms.command(room, alice, "action", {"action": {"type": "board-move", "from": [6, 0], "to": [5, 0], "promotion": "x", "ignored": "secret"}})
        action = room["events"][-1]["payload"]["action"]
        self.assertEqual(action, {"type": "board-move", "from": [6, 0], "to": [5, 0]})
        with self.assertRaises(ValueError):
            LAN.validate_public_action("games/grid/sudoku.html", {"type": "cell", "index": 4})
        self.assertEqual(
            LAN.validate_public_action("games/cards/classic/bataille-corse.html", {"type": "corse-slap", "controlledSeat": 2, "extra": True}),
            {"type": "corse-slap", "controlledSeat": 2},
        )
        self.assertEqual(LAN.validate_public_action("games/cards/modern/totem-reflexe.html", {"type": "totem-draw"}), {"type": "totem-draw"})
        self.assertEqual(
            LAN.validate_public_action("games/cards/modern/symbole-unique.html", {"type": "symbol-claim", "symbol": "🐝", "target": 1, "extra": "discarded"}),
            {"type": "symbol-claim", "symbol": "🐝", "target": 1},
        )
        self.assertEqual(
            LAN.validate_public_action("games/grid/minesweeper.html", {"type": "minesweeper-start", "index": 3839, "extra": "discarded"}),
            {"type": "minesweeper-start", "index": 3839},
        )
        with self.assertRaises(ValueError):
            LAN.validate_public_action("games/grid/minesweeper.html", {"type": "minesweeper-start", "index": -1})
        with self.assertRaises(ValueError):
            LAN.validate_public_action("games/cards/modern/symbole-unique.html", {"type": "symbol-claim", "symbol": ""})

    def test_board_game_rolls_are_generated_by_server_and_bot_control_is_host_only(self):
        first, first_token = self.rooms.create("Alice", LAN.PUBLIC_BOARD_GAMES, "private", {"variant": "estate", "playerCount": 3}, 3)
        _, second_token = self.rooms.join(first["code"], "Bob", LAN.PUBLIC_BOARD_GAMES)
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        self.rooms.command(room, alice, "start", {})
        rolled = self.rooms.command(room, alice, "action", {"action": {"type": "board-roll", "controlledSeat": 0, "dice": [6, 6]}})
        action = rolled["events"][-1]["payload"]["action"]
        self.assertEqual(len(action["dice"]), 2)
        self.assertTrue(all(1 <= value <= 6 for value in action["dice"]))
        with self.assertRaises(PermissionError):
            self.rooms.command(room, bob, "action", {"action": {"type": "board-roll", "controlledSeat": 2}})
        controlled = self.rooms.command(room, alice, "action", {"action": {"type": "board-roll", "controlledSeat": 2}})
        self.assertEqual(controlled["events"][-1]["payload"]["action"]["controlledSeat"], 2)

    def test_mismatched_assets_block_start(self):
        first, first_token = self.rooms.create("Alice", "games/rhythm/rhythm.html", "private", {})
        _, second_token = self.rooms.join(first["code"], "Bob", "games/rhythm/rhythm.html")
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True, "asset": {"name": "a.mscz", "hash": "a" * 64, "size": 10}})
        self.rooms.command(room, bob, "ready", {"ready": True, "asset": {"name": "b.mscz", "hash": "b" * 64, "size": 10}})
        with self.assertRaises(ValueError):
            self.rooms.command(room, alice, "start", {})

    def test_race_finishes_for_every_player_on_first_winner(self):
        first, first_token = self.rooms.create("Alice", "games/grid/minesweeper.html", "private", {}, 3)
        _, second_token = self.rooms.join(first["code"], "Bob", "games/grid/minesweeper.html")
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        self.rooms.command(room, alice, "start", {})

        finished = self.rooms.command(room, bob, "finish", {"result": {"score": 1, "scoreLabel": "Grille terminée", "won": True, "raceWinner": True}})

        self.assertEqual(finished["phase"], "finished")
        self.assertTrue(finished["results"][bob["id"]]["won"])
        self.assertFalse(finished["results"][alice["id"]]["won"])
        self.assertFalse(finished["results"]["bot-2"]["won"])
        self.assertEqual(finished["events"][-1]["type"], "finished")

    def test_minesweeper_first_opening_is_persisted_and_unique(self):
        first, first_token = self.rooms.create("Alice", "games/grid/minesweeper.html", "private", {}, 2)
        _, second_token = self.rooms.join(first["code"], "Bob", "games/grid/minesweeper.html")
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        self.rooms.command(room, alice, "start", {})

        self.rooms.command(room, alice, "action", {"action": {"type": "minesweeper-start", "index": 42}})
        sequence = room["sequence"]
        duplicate = self.rooms.command(room, bob, "action", {"action": {"type": "minesweeper-start", "index": 0}})

        self.assertEqual(room["publicState"], {"minesweeperStart": 42})
        self.assertEqual(room["sequence"], sequence)
        self.assertEqual(duplicate["publicState"], {"minesweeperStart": 42})

    def test_empty_seats_and_disconnects_use_bots(self):
        first, first_token = self.rooms.create("Alice", "games/cards/classic/bataille.html", "private", {"playerCount": 4}, 4)
        _, second_token = self.rooms.join(first["code"], "Bob", "games/cards/classic/bataille.html")
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        started = self.rooms.command(room, alice, "start", {})
        self.assertEqual(started["seatCount"], 4)
        self.assertEqual(len(started["seats"]), 4)
        self.assertEqual(sum(seat["controller"] == "bot" for seat in started["seats"]), 2)
        with self.assertRaises(ValueError):
            self.rooms.join(first["code"], "Charlie", "games/cards/classic/bataille.html")

        bob["lastSeen"] -= LAN.PRESENCE_TIMEOUT_SECONDS + 1
        self.rooms.refresh_presence(room)
        disconnected = self.rooms.serialize(room, alice["id"])
        bob_seat = next(seat for seat in disconnected["seats"] if seat["playerId"] == bob["id"])
        self.assertEqual(bob_seat["controller"], "bot")
        self.assertIn("Bob", bob_seat["label"])
        _, reconnected = self.rooms.authenticate(first["code"], second_token)
        self.assertTrue(reconnected["connected"])
        restored = self.rooms.serialize(room, reconnected["id"])
        self.assertEqual(next(seat for seat in restored["seats"] if seat["playerId"] == bob["id"])["controller"], "human")
        reconnected["lastSeen"] -= LAN.PRESENCE_TIMEOUT_SECONDS + 1
        self.rooms.refresh_presence(room)
        finished = self.rooms.command(room, alice, "finish", {"result": {"score": 0, "winnerSeat": 1, "won": False}})
        self.assertEqual(finished["phase"], "finished")
        self.assertTrue(finished["results"][bob["id"]]["won"])
        self.assertTrue(finished["results"][bob["id"]]["bot"])

    def test_host_transfer_and_empty_room_expiry(self):
        first, first_token = self.rooms.create("Alice", "games/grid/sudoku.html", "private", {}, 3)
        _, second_token = self.rooms.join(first["code"], "Bob", "games/grid/sudoku.html")
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        alice["lastSeen"] -= LAN.PRESENCE_TIMEOUT_SECONDS + 1
        self.rooms.refresh_presence(room)
        self.assertEqual(room["hostId"], bob["id"])
        _, alice = self.rooms.authenticate(first["code"], first_token)
        state = self.rooms.command(room, alice, "leave", {})
        self.assertEqual(state["hostId"], bob["id"])
        bob["lastSeen"] -= LAN.PRESENCE_TIMEOUT_SECONDS + 1
        self.rooms.refresh_presence(room)
        room["emptySince"] -= LAN.EMPTY_ROOM_GRACE_SECONDS + 1
        self.rooms.cleanup()
        self.assertNotIn(first["code"], self.rooms.rooms)

    def test_rooms_resume_after_server_restart_without_plain_tokens(self):
        with tempfile.TemporaryDirectory() as directory:
            state_file = Path(directory) / "lan-rooms.json"
            rooms = LAN.LanRooms(state_file)
            created, token = rooms.create("Alice", "games/grid/sudoku.html", "private", {"difficulty": "hard"}, 2)
            code = created["code"]
            persisted = state_file.read_text(encoding="utf-8")
            self.assertNotIn(token, persisted)
            restarted = LAN.LanRooms(state_file)
            room, player = restarted.authenticate(code, token)
            self.assertTrue(player["connected"])
            self.assertEqual(room["options"]["difficulty"], "hard")

    def test_private_game_state_resumes_after_server_restart_without_leak(self):
        with tempfile.TemporaryDirectory() as directory:
            state_file = Path(directory) / "lan-rooms.json"
            rooms = LAN.LanRooms(state_file)
            created, alice_token = rooms.create("Alice", LAN.PRIVATE_RUMMY_CARD_GAME, "private", {"openingMinimum": 30}, 2)
            _, bob_token = rooms.join(created["code"], "Bob", LAN.PRIVATE_RUMMY_CARD_GAME)
            room, alice = rooms.authenticate(created["code"], alice_token)
            _, bob = rooms.authenticate(created["code"], bob_token)
            rooms.command(room, alice, "ready", {"ready": True})
            rooms.command(room, bob, "ready", {"ready": True})
            before = rooms.command(room, alice, "start", {})
            hand_ids = [card["id"] for card in before["gameState"]["hand"]]
            restarted = LAN.LanRooms(state_file)
            resumed_room, resumed_alice = restarted.authenticate(created["code"], alice_token)
            resumed = restarted.serialize(resumed_room, resumed_alice["id"])
            self.assertEqual([card["id"] for card in resumed["gameState"]["hand"]], hand_ids)
            self.assertNotIn("hands", resumed["gameState"])
            self.assertNotIn(resumed_room["gameState"]["seed"], json.dumps(resumed))

    def test_validation_rejects_paths_and_markup(self):
        with self.assertRaises(ValueError):
            LAN.validate_game("../index.html")
        with self.assertRaises(ValueError):
            LAN.validate_name("<script>")
        self.assertEqual(LAN.validate_options({"difficulty": "hard", "bad key": "x"}), {"difficulty": "hard"})
        self.assertEqual(LAN.validate_asset({"name": "score.mscz", "hash": "a" * 64, "size": 100})["size"], 100)

    def test_private_color_game_hides_other_hands_and_validates_actions(self):
        first, first_token = self.rooms.create("Alice", LAN.PRIVATE_COLOR_GAME, "private", {"strictFour": True}, 2)
        _, second_token = self.rooms.join(first["code"], "Bob", LAN.PRIVATE_COLOR_GAME)
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        alice_state = self.rooms.command(room, alice, "start", {})
        bob_state = self.rooms.serialize(room, bob["id"])
        self.assertEqual(len(alice_state["gameState"]["hand"]), 7)
        self.assertEqual(len(bob_state["gameState"]["hand"]), 7)
        self.assertNotEqual(
            {card["id"] for card in alice_state["gameState"]["hand"]},
            {card["id"] for card in bob_state["gameState"]["hand"]},
        )
        self.assertNotIn("hands", alice_state["gameState"])
        self.assertNotIn("deck", alice_state["gameState"])
        self.assertNotIn(room["gameState"]["seed"], json.dumps(alice_state))
        with self.assertRaises(ValueError):
            self.rooms.command(room, alice, "action", {"action": {"type": "play"}})
        with self.assertRaises(ValueError):
            self.rooms.command(room, bob, "game-action", {"action": {"type": "draw"}})
        server_state = room["gameState"]
        initial_version = server_state["version"]
        playable = next((card for card in server_state["hands"][0] if LAN.color_game_can_play(room, server_state, card, 0)), None)
        if playable:
            color = "red" if playable["color"] == "wild" else None
            updated = self.rooms.command(room, alice, "game-action", {"action": {"type": "play", "cardId": playable["id"], "color": color}})
        else:
            updated = self.rooms.command(room, alice, "game-action", {"action": {"type": "draw"}})
        self.assertIn(updated["phase"], {"playing", "finished"})
        self.assertGreater(room["gameState"]["version"], initial_version)
        self.assertGreater(room["sequence"], alice_state["sequence"])
        actors = [alice, bob]
        for _ in range(80):
            state = room["gameState"]
            cards = state["deck"] + state["discard"] + [card for hand in state["hands"] for card in hand]
            self.assertEqual(len(cards), 108)
            self.assertEqual(len({card["id"] for card in cards}), 108)
            if room["phase"] == "finished":
                break
            seat = state["current"]
            playable = next((card for card in state["hands"][seat] if LAN.color_game_can_play(room, state, card, seat)), None)
            action = {"type": "draw"} if not playable else {"type": "play", "cardId": playable["id"], "color": "red" if playable["color"] == "wild" else None}
            self.rooms.command(room, actors[seat], "game-action", {"action": action})

    def test_private_sixth_game_keeps_choices_secret_and_resolves_turn(self):
        first, first_token = self.rooms.create("Alice", LAN.PRIVATE_SIXTH_GAME, "private", {"limit": 66}, 2)
        _, second_token = self.rooms.join(first["code"], "Bob", LAN.PRIVATE_SIXTH_GAME)
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        alice_state = self.rooms.command(room, alice, "start", {})
        bob_state = self.rooms.serialize(room, bob["id"])
        self.assertEqual(len(alice_state["gameState"]["hand"]), 10)
        self.assertEqual(len(bob_state["gameState"]["hand"]), 10)
        self.assertNotEqual(set(alice_state["gameState"]["hand"]), set(bob_state["gameState"]["hand"]))
        self.assertNotIn("hands", alice_state["gameState"])
        self.assertNotIn(room["gameState"]["seed"], json.dumps(alice_state))
        alice_card = room["gameState"]["hands"][0][0]
        bob_card = room["gameState"]["hands"][1][0]
        waiting = self.rooms.command(room, alice, "game-action", {"action": {"type": "choose", "card": alice_card}})
        self.assertTrue(waiting["gameState"]["chosen"])
        self.assertNotIn(alice_card, self.rooms.serialize(room, bob["id"])["gameState"]["hand"])
        self.rooms.command(room, bob, "game-action", {"action": {"type": "choose", "card": bob_card}})
        pending = room["gameState"].get("pendingRow")
        while pending:
            actor = [alice, bob][pending["seat"]]
            self.rooms.command(room, actor, "game-action", {"action": {"type": "row", "row": 0}})
            pending = room["gameState"].get("pendingRow")
        total_cards = sum(len(row) for row in room["gameState"]["rows"]) + sum(len(hand) for hand in room["gameState"]["hands"]) + sum(len(cards) for cards in room["gameState"]["captured"])
        self.assertEqual(total_cards, 24)
        self.assertEqual(room["gameState"]["turn"], 1)

    def test_private_sixth_game_serializes_simultaneous_choices(self):
        first, first_token = self.rooms.create("Alice", LAN.PRIVATE_SIXTH_GAME, "private", {"limit": 100}, 2)
        _, second_token = self.rooms.join(first["code"], "Bob", LAN.PRIVATE_SIXTH_GAME)
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        self.rooms.command(room, alice, "start", {})
        cards = [room["gameState"]["hands"][0][0], room["gameState"]["hands"][1][0]]
        barrier = threading.Barrier(2)
        failures = []

        def choose(actor, card):
            try:
                barrier.wait(timeout=2)
                self.rooms.command(room, actor, "game-action", {"action": {"type": "choose", "card": card}})
            except Exception as error:
                failures.append(error)

        threads = [threading.Thread(target=choose, args=(alice, cards[0])), threading.Thread(target=choose, args=(bob, cards[1]))]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=3)
        self.assertFalse(failures)
        pending = room["gameState"].get("pendingRow")
        while pending:
            self.rooms.command(room, [alice, bob][pending["seat"]], "game-action", {"action": {"type": "row", "row": 0}})
            pending = room["gameState"].get("pendingRow")
        self.assertEqual(room["gameState"]["turn"], 1)
        self.assertEqual(sum(len(hand) for hand in room["gameState"]["hands"]), 18)

    def test_private_pirate_game_keeps_hands_and_bids_secret(self):
        first, first_token = self.rooms.create("Alice", LAN.PRIVATE_PIRATE_GAME, "private", {"pirateRounds": 2}, 2)
        _, second_token = self.rooms.join(first["code"], "Bob", LAN.PRIVATE_PIRATE_GAME)
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        alice_state = self.rooms.command(room, alice, "start", {})
        bob_state = self.rooms.serialize(room, bob["id"])
        self.assertEqual(len(alice_state["gameState"]["hand"]), 1)
        self.assertEqual(len(bob_state["gameState"]["hand"]), 1)
        self.assertNotEqual(alice_state["gameState"]["hand"][0]["id"], bob_state["gameState"]["hand"][0]["id"])
        self.assertNotIn("hands", alice_state["gameState"])
        self.assertNotIn("deck", alice_state["gameState"])
        self.assertNotIn(room["gameState"]["seed"], json.dumps(alice_state))

        self.rooms.command(room, alice, "game-action", {"action": {"type": "bid", "value": 0}})
        hidden = self.rooms.serialize(room, bob["id"])["gameState"]
        self.assertTrue(hidden["bidSubmitted"][0])
        self.assertIsNone(hidden["bids"][0])
        revealed = self.rooms.command(room, bob, "game-action", {"action": {"type": "bid", "value": 1}})["gameState"]
        self.assertEqual(revealed["bids"], [0, 1])
        self.assertEqual(revealed["phase"], "play")

        alice_card = room["gameState"]["hands"][0][0]
        after_alice = self.rooms.command(room, alice, "game-action", {"action": {"type": "play", "cardId": alice_card["id"]}})
        bob_view = self.rooms.serialize(room, bob["id"])["gameState"]
        self.assertEqual(after_alice["gameState"]["handCounts"][0], 0)
        self.assertEqual(len(bob_view["hand"]), 1)
        self.assertNotIn("hands", bob_view)
        bob_card = room["gameState"]["hands"][1][0]
        self.rooms.command(room, bob, "game-action", {"action": {"type": "play", "cardId": bob_card["id"]}})
        self.assertEqual(room["gameState"]["round"], 2)

    def test_private_pirate_game_replaces_disconnected_bidder_with_bot(self):
        first, first_token = self.rooms.create("Alice", LAN.PRIVATE_PIRATE_GAME, "private", {"pirateRounds": 2}, 2)
        _, second_token = self.rooms.join(first["code"], "Bob", LAN.PRIVATE_PIRATE_GAME)
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        self.rooms.command(room, alice, "start", {})
        bob["lastSeen"] -= LAN.PRESENCE_TIMEOUT_SECONDS + 1
        self.rooms.refresh_presence(room)
        self.rooms.command(room, alice, "game-action", {"action": {"type": "bid", "value": 0}})
        self.assertTrue(all(value is not None for value in room["gameState"]["bids"]))
        self.assertEqual(room["gameState"]["phase"], "play")

    def test_private_course_game_hides_hands_and_validates_draw_discard(self):
        first, first_token = self.rooms.create("Alice", LAN.PRIVATE_COURSE_GAME, "private", {"targetDistance": 700, "exactDistance": True}, 2)
        _, second_token = self.rooms.join(first["code"], "Bob", LAN.PRIVATE_COURSE_GAME)
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        alice_state = self.rooms.command(room, alice, "start", {})
        bob_state = self.rooms.serialize(room, bob["id"])
        self.assertEqual(len(alice_state["gameState"]["hand"]), 6)
        self.assertEqual(len(bob_state["gameState"]["hand"]), 6)
        self.assertNotEqual({card["id"] for card in alice_state["gameState"]["hand"]}, {card["id"] for card in bob_state["gameState"]["hand"]})
        self.assertNotIn("hands", alice_state["gameState"])
        self.assertNotIn("deck", alice_state["gameState"])
        self.assertNotIn(room["gameState"]["seed"], json.dumps(alice_state))
        with self.assertRaises(ValueError):
            self.rooms.command(room, alice, "game-action", {"action": {"type": "discard", "cardId": room["gameState"]["hands"][0][0]["id"]}})
        drawn = self.rooms.command(room, alice, "game-action", {"action": {"type": "draw"}})
        self.assertEqual(len(drawn["gameState"]["hand"]), 7)
        discard_id = room["gameState"]["hands"][0][0]["id"]
        after = self.rooms.command(room, alice, "game-action", {"action": {"type": "discard", "cardId": discard_id}})
        self.assertEqual(after["gameState"]["handCounts"][0], 6)
        self.assertEqual(room["gameState"]["turn"], 1)
        self.assertEqual(after["gameState"]["discardTop"]["id"], discard_id)

    def test_private_chat_game_hides_hands_and_private_future(self):
        first, first_token = self.rooms.create("Alice", LAN.PRIVATE_CHAT_GAME, "private", {"catastropheRecipe": "classic"}, 2)
        _, second_token = self.rooms.join(first["code"], "Bob", LAN.PRIVATE_CHAT_GAME)
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        alice_state = self.rooms.command(room, alice, "start", {})
        bob_state = self.rooms.serialize(room, bob["id"])
        self.assertEqual(len(alice_state["gameState"]["hand"]), 8)
        self.assertEqual(len(bob_state["gameState"]["hand"]), 8)
        self.assertTrue(all(card["type"] not in {"kitten", "imploding"} for card in alice_state["gameState"]["hand"]))
        self.assertEqual(sum(card["type"] == "defuse" for card in alice_state["gameState"]["hand"]), 1)
        self.assertNotIn("hands", alice_state["gameState"])
        self.assertNotIn("deck", alice_state["gameState"])
        self.assertNotIn(room["gameState"]["seed"], json.dumps(alice_state))

        future = next((card for card in room["gameState"]["hands"][0] if card["type"] == "future"), None)
        if future is None:
            future = next(card for card in room["gameState"]["deck"] if card["type"] == "future")
            room["gameState"]["deck"].remove(future)
            room["gameState"]["hands"][0].append(future)
        private_view = self.rooms.command(room, alice, "game-action", {"action": {"type": "play", "cardId": future["id"]}})["gameState"]
        other_view = self.rooms.serialize(room, bob["id"])["gameState"]
        self.assertGreater(len(private_view["future"]), 0)
        self.assertEqual(other_view["future"], [])

    def test_private_zero_game_hides_face_down_cards_and_runs_a_turn(self):
        first, first_token = self.rooms.create("Alice", LAN.PRIVATE_ZERO_GAME, "private", {"initialReveals": 2, "columns": True}, 2)
        _, second_token = self.rooms.join(first["code"], "Bob", LAN.PRIVATE_ZERO_GAME)
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        alice_state = self.rooms.command(room, alice, "start", {})
        hidden = next(card for card in alice_state["gameState"]["people"][0]["board"] if not card["up"])
        self.assertNotIn("value", hidden)
        self.assertNotIn("deck", alice_state["gameState"])
        self.assertNotIn(room["gameState"]["seed"], json.dumps(alice_state))
        for actor, seat in ((alice, 0), (bob, 1)):
            indexes = [index for index, card in enumerate(room["gameState"]["people"][seat]["board"]) if not card["up"]][:2]
            for index in indexes:
                self.rooms.command(room, actor, "game-action", {"action": {"type": "setup", "index": index}})
        self.assertEqual(room["gameState"]["phase"], "play")
        actors = [alice, bob]
        seat = room["gameState"]["turn"]
        taken = self.rooms.command(room, actors[seat], "game-action", {"action": {"type": "take", "source": "deck"}})["gameState"]
        self.assertIsNotNone(taken["pending"])
        target = next(index for index, card in enumerate(room["gameState"]["people"][seat]["board"]) if not card["removed"])
        self.rooms.command(room, actors[seat], "game-action", {"action": {"type": "replace", "index": target}})
        self.assertNotEqual(room["gameState"]["turn"], seat)

    def test_private_zero_bonus_actions_and_inspection_stay_private(self):
        first, first_token = self.rooms.create("Alice", LAN.PRIVATE_ZERO_GAME, "private", {"initialReveals": 2, "columns": True, "bonusRules": True}, 2)
        _, second_token = self.rooms.join(first["code"], "Bob", LAN.PRIVATE_ZERO_GAME)
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        self.rooms.command(room, alice, "start", {})
        state = room["gameState"]
        self.assertTrue(state["bonus"])
        inspect_location = next(((collection, index) for collection in (state["actionMarket"], state["actionDeck"]) for index, action in enumerate(collection) if action == "inspect"))
        collection, inspect_index = inspect_location
        collection[inspect_index], state["actionMarket"][0] = state["actionMarket"][0], collection[inspect_index]
        star_index = next(index for index, card in enumerate(state["deck"]) if card["kind"] == "star")
        board_index = next(index for index, card in enumerate(state["people"][0]["board"]) if not card["up"])
        star = state["deck"][star_index]
        previous = state["people"][0]["board"][board_index]
        state["deck"][star_index] = {key: previous[key] for key in ("id", "kind", "value")}
        state["people"][0]["board"][board_index] = {**star, "up": False, "removed": False}
        self.rooms.command(room, alice, "game-action", {"action": {"type": "setup", "index": board_index}})
        second_alice = next(index for index, card in enumerate(state["people"][0]["board"]) if not card["up"])
        self.rooms.command(room, alice, "game-action", {"action": {"type": "setup", "index": second_alice}})
        for index in [index for index, card in enumerate(state["people"][1]["board"]) if not card["up"]][:2]:
            self.rooms.command(room, bob, "game-action", {"action": {"type": "setup", "index": index}})
        state["turn"] = 0
        alice_view = self.rooms.serialize(room, alice["id"])["gameState"]
        bob_view = self.rooms.serialize(room, bob["id"])["gameState"]
        self.assertEqual(alice_view["people"][0]["actions"][0]["id"], "inspect")
        self.assertNotIn("actions", bob_view["people"][0])
        self.assertEqual(bob_view["people"][0]["actionCount"], 1)
        self.rooms.command(room, alice, "game-action", {"action": {"type": "use-action", "actionIndex": 0}})
        hidden_bob = next(index for index, card in enumerate(state["people"][1]["board"]) if not card["up"])
        private_view = self.rooms.command(room, alice, "game-action", {"action": {"type": "action-cell", "player": 1, "index": hidden_bob}})["gameState"]
        other_view = self.rooms.serialize(room, bob["id"])["gameState"]
        self.assertEqual(len(private_view["peek"]["cards"]), 4)
        self.assertIsNone(other_view["peek"])
        number_cards = len(state["deck"]) + len(state["discard"]) + sum(len(person["board"]) for person in state["people"])
        action_cards = len(state["actionDeck"]) + len(state["actionMarket"]) + len(state["actionDiscard"]) + sum(len(person["actions"]) for person in state["people"])
        self.assertEqual(number_cards, 158)
        self.assertEqual(action_cards, sum(LAN.ZERO_ACTION_COUNTS.values()))
        self.rooms.command(room, alice, "game-action", {"action": {"type": "continue-action"}})

    def test_private_rummy_cards_hides_hands_and_validates_melds(self):
        first, first_token = self.rooms.create("Alice", LAN.PRIVATE_RUMMY_CARD_GAME, "private", {"openingMinimum": 0, "jokers": True}, 2)
        _, second_token = self.rooms.join(first["code"], "Bob", LAN.PRIVATE_RUMMY_CARD_GAME)
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        alice_state = self.rooms.command(room, alice, "start", {})
        bob_state = self.rooms.serialize(room, bob["id"])
        self.assertEqual(len(alice_state["gameState"]["hand"]), 10)
        self.assertEqual(len(bob_state["gameState"]["hand"]), 10)
        self.assertNotEqual({card["id"] for card in alice_state["gameState"]["hand"]}, {card["id"] for card in bob_state["gameState"]["hand"]})
        self.assertNotIn("hands", alice_state["gameState"])
        self.assertNotIn("stock", alice_state["gameState"])
        self.assertNotIn(room["gameState"]["seed"], json.dumps(alice_state))
        self.rooms.command(room, alice, "game-action", {"action": {"type": "draw", "source": "stock"}})
        available = room["gameState"]["hands"][0] + room["gameState"]["stock"]
        meld = next(list(cards) for cards in __import__("itertools").combinations(available, 3) if LAN.rummy_card_valid_group(cards))
        for card in meld:
            if card not in room["gameState"]["hands"][0]:
                room["gameState"]["stock"].remove(card)
                room["gameState"]["hands"][0].append(card)
        laid = self.rooms.command(room, alice, "game-action", {"action": {"type": "lay", "cardIds": [card["id"] for card in meld]}})
        self.assertEqual(len(laid["gameState"]["groups"]), 1)
        self.assertTrue(laid["gameState"]["opened"][0])
        undone = self.rooms.command(room, alice, "game-action", {"action": {"type": "undo"}})
        self.assertEqual(undone["gameState"]["phase"], "draw")
        self.assertEqual(len(undone["gameState"]["groups"]), 0)

    def test_private_rummy_tiles_hides_racks_and_validates_table(self):
        first, first_token = self.rooms.create("Alice", LAN.PRIVATE_RUMMY_TILE_GAME, "private", {}, 2)
        _, second_token = self.rooms.join(first["code"], "Bob", LAN.PRIVATE_RUMMY_TILE_GAME)
        room, alice = self.rooms.authenticate(first["code"], first_token)
        _, bob = self.rooms.authenticate(first["code"], second_token)
        self.rooms.command(room, alice, "ready", {"ready": True})
        self.rooms.command(room, bob, "ready", {"ready": True})
        alice_state = self.rooms.command(room, alice, "start", {})
        bob_state = self.rooms.serialize(room, bob["id"])
        self.assertEqual(len(alice_state["gameState"]["rack"]), 14)
        self.assertEqual(len(bob_state["gameState"]["rack"]), 14)
        self.assertNotEqual({tile["id"] for tile in alice_state["gameState"]["rack"]}, {tile["id"] for tile in bob_state["gameState"]["rack"]})
        self.assertNotIn("racks", alice_state["gameState"])
        self.assertNotIn("pool", alice_state["gameState"])
        self.assertNotIn(room["gameState"]["seed"], json.dumps(alice_state))
        with self.assertRaises(ValueError):
            self.rooms.command(room, alice, "game-action", {"action": {"type": "rearrange", "groups": [[9991, 9992, 9993]]}})
        available = room["gameState"]["racks"][0] + room["gameState"]["pool"]
        meld = next(list(tiles) for tiles in __import__("itertools").combinations(available, 3) if LAN.rummy_tile_valid_group(tiles) and sum(LAN.rummy_tile_points(tile) for tile in tiles) >= 30)
        for tile in meld:
            if tile not in room["gameState"]["racks"][0]:
                room["gameState"]["pool"].remove(tile)
                room["gameState"]["racks"][0].append(tile)
        staged = self.rooms.command(room, alice, "game-action", {"action": {"type": "rearrange", "groups": [[tile["id"] for tile in meld]]}})
        self.assertTrue(staged["gameState"]["changed"])
        self.assertGreaterEqual(staged["gameState"]["openingPoints"], 30)
        ended = self.rooms.command(room, alice, "game-action", {"action": {"type": "end"}})
        self.assertTrue(ended["gameState"]["opened"][0])
        self.assertEqual(room["gameState"]["turn"], 1)

    def test_every_private_engine_survives_disconnect_and_reconnect(self):
        self.assertEqual(set(LAN.PRIVATE_GAME_ENGINES), LAN.PRIVATE_GAMES)
        options = {
            LAN.PRIVATE_COLOR_GAME: {}, LAN.PRIVATE_SIXTH_GAME: {}, LAN.PRIVATE_PIRATE_GAME: {"pirateRounds": 2},
            LAN.PRIVATE_COURSE_GAME: {}, LAN.PRIVATE_CHAT_GAME: {}, LAN.PRIVATE_ZERO_GAME: {"initialReveals": 2},
            LAN.PRIVATE_RUMMY_CARD_GAME: {"openingMinimum": 0}, LAN.PRIVATE_RUMMY_TILE_GAME: {},
        }
        for game in sorted(LAN.PRIVATE_GAMES):
            with self.subTest(game=game):
                first, first_token = self.rooms.create("Alice", game, "private", options[game], 2)
                _, second_token = self.rooms.join(first["code"], "Bob", game)
                room, alice = self.rooms.authenticate(first["code"], first_token)
                _, bob = self.rooms.authenticate(first["code"], second_token)
                self.rooms.command(room, alice, "ready", {"ready": True})
                self.rooms.command(room, bob, "ready", {"ready": True})
                self.rooms.command(room, alice, "start", {})
                bob["lastSeen"] -= LAN.PRESENCE_TIMEOUT_SECONDS + 1
                self.rooms.refresh_presence(room)
                disconnected = self.rooms.serialize(room, alice["id"])
                bob_seat = next(seat for seat in disconnected["seats"] if seat["playerId"] == bob["id"])
                self.assertEqual(bob_seat["controller"], "bot")
                self.assertNotIn("seed", disconnected["gameState"])
                self.assertFalse({"hands", "racks", "deck", "stock", "pool"} & set(disconnected["gameState"]))
                _, reconnected = self.rooms.authenticate(first["code"], second_token)
                restored = self.rooms.serialize(room, reconnected["id"])
                restored_seat = next(seat for seat in restored["seats"] if seat["playerId"] == bob["id"])
                self.assertEqual(restored_seat["controller"], "human")
                self.assertIsNotNone(restored["gameState"])


class LanHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = LAN.build_server(ROOT, 0, bind_host="127.0.0.1")
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def request(self, path, payload=None, token=None, method=None):
        headers = {"Origin": f"http://127.0.0.1:{self.port}"}
        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(f"http://127.0.0.1:{self.port}{path}", data=data, headers=headers, method=method)
        with urllib.request.urlopen(request, timeout=3) as response:
            return response.status, json.loads(response.read())

    def test_status_create_and_authenticated_read(self):
        status, payload = self.request("/api/lan/status")
        self.assertEqual(status, 200)
        self.assertTrue(payload["lan"])
        status, created = self.request("/api/rooms/create", {"name": "Test", "game": "games/grid/nonogram.html", "visibility": "private", "options": {}})
        self.assertEqual(status, 201)
        room = created["room"]
        status, state = self.request(f"/api/rooms/{room['code']}?since=0", token=created["token"])
        self.assertEqual(status, 200)
        self.assertEqual(state["playerId"], room["playerId"])

    def test_two_http_clients_start_finish_and_vote_for_rematch(self):
        _, created = self.request("/api/rooms/create", {"name": "Alice", "game": "games/board/mahjong.html", "visibility": "private", "options": {"tileCount": 72}, "seatCount": 2})
        code = created["room"]["code"]
        _, joined = self.request("/api/rooms/join", {"code": code, "name": "Bob", "game": "games/board/mahjong.html"})
        alice_token = created["token"]
        bob_token = joined["token"]

        def command(token, name, payload=None):
            return self.request(f"/api/rooms/{code}/command", {"command": name, "payload": payload or {}}, token=token)[1]["room"]

        command(alice_token, "ready", {"ready": True})
        command(bob_token, "ready", {"ready": True})
        playing = command(alice_token, "start")
        self.assertEqual(playing["phase"], "playing")
        finished = command(bob_token, "finish", {"result": {"score": 36, "scoreLabel": "36 paires", "won": True, "raceWinner": True}})
        self.assertEqual(finished["phase"], "finished")
        self.assertEqual(finished["results"][joined["room"]["playerId"]]["score"], 36)
        command(alice_token, "rematch", {"accept": True})
        lobby = command(bob_token, "rematch", {"accept": True})
        self.assertEqual(lobby["phase"], "lobby")
        self.assertIsNone(lobby["seed"])

    def test_two_http_clients_keep_sixth_hands_private(self):
        _, created = self.request("/api/rooms/create", {"name": "Alice", "game": LAN.PRIVATE_SIXTH_GAME, "visibility": "private", "options": {"limit": 66}, "seatCount": 2})
        code = created["room"]["code"]
        _, joined = self.request("/api/rooms/join", {"code": code, "name": "Bob", "game": LAN.PRIVATE_SIXTH_GAME})

        def command(token, name, payload=None):
            return self.request(f"/api/rooms/{code}/command", {"command": name, "payload": payload or {}}, token=token)[1]["room"]

        command(created["token"], "ready", {"ready": True})
        command(joined["token"], "ready", {"ready": True})
        alice = command(created["token"], "start")
        bob = self.request(f"/api/rooms/{code}?since=0", token=joined["token"])[1]
        self.assertEqual(len(alice["gameState"]["hand"]), 10)
        self.assertEqual(len(bob["gameState"]["hand"]), 10)
        self.assertNotEqual(set(alice["gameState"]["hand"]), set(bob["gameState"]["hand"]))
        self.assertNotIn("hands", alice["gameState"])
        self.assertNotIn("hands", bob["gameState"])

    def test_http_contract_hides_internal_state_for_every_private_engine(self):
        game_options = {
            LAN.PRIVATE_COLOR_GAME: {}, LAN.PRIVATE_SIXTH_GAME: {}, LAN.PRIVATE_PIRATE_GAME: {"pirateRounds": 2},
            LAN.PRIVATE_COURSE_GAME: {}, LAN.PRIVATE_CHAT_GAME: {}, LAN.PRIVATE_ZERO_GAME: {"initialReveals": 2},
            LAN.PRIVATE_RUMMY_CARD_GAME: {"openingMinimum": 0}, LAN.PRIVATE_RUMMY_TILE_GAME: {},
        }
        for game, options in game_options.items():
            with self.subTest(game=game):
                _, created = self.request("/api/rooms/create", {"name": "Alice", "game": game, "visibility": "private", "options": options, "seatCount": 2})
                code = created["room"]["code"]
                _, joined = self.request("/api/rooms/join", {"code": code, "name": "Bob", "game": game})
                def command(token, name, payload=None):
                    return self.request(f"/api/rooms/{code}/command", {"command": name, "payload": payload or {}}, token=token)[1]["room"]
                command(created["token"], "ready", {"ready": True})
                command(joined["token"], "ready", {"ready": True})
                command(created["token"], "start")
                bob = self.request(f"/api/rooms/{code}?since=0", token=joined["token"])[1]
                self.assertIsNotNone(bob["gameState"])
                self.assertNotIn("seed", bob["gameState"])
                self.assertFalse({"hands", "racks", "deck", "stock", "pool"} & set(bob["gameState"]))

    def test_unknown_origin_is_rejected(self):
        request = urllib.request.Request(f"http://127.0.0.1:{self.port}/api/lan/status", headers={"Origin": "https://example.invalid"})
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(request, timeout=3)
        self.assertEqual(error.exception.code, 403)
        error.exception.close()

    def test_same_origin_diagnostics_can_embed_game_pages(self):
        request = urllib.request.Request(f"http://127.0.0.1:{self.port}/games/grid/sudoku.html")
        with urllib.request.urlopen(request, timeout=3) as response:
            policy = response.headers.get("Content-Security-Policy", "")
        self.assertIn("frame-ancestors 'self'", policy)
        self.assertNotIn("frame-ancestors 'none'", policy)

    def test_websocket_room_stream_uses_subprotocol_token(self):
        _, created = self.request("/api/rooms/create", {"name": "Socket", "game": "games/grid/sudoku.html", "visibility": "private", "options": {}})
        room = created["room"]
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        client = socket.create_connection(("127.0.0.1", self.port), timeout=3)
        request = (
            f"GET /api/rooms/{room['code']}/socket HTTP/1.1\r\n"
            f"Host: 127.0.0.1:{self.port}\r\n"
            f"Origin: http://127.0.0.1:{self.port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            f"Sec-WebSocket-Protocol: ludotheque-v1, {created['token']}\r\n\r\n"
        )
        client.sendall(request.encode("ascii"))
        response = client.recv(4096)
        client.close()
        self.assertIn(b"HTTP/1.1 101 Switching Protocols", response)
        self.assertIn(b"Sec-WebSocket-Protocol: ludotheque-v1", response)


if __name__ == "__main__":
    unittest.main()
