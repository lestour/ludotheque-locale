import importlib.util
import base64
import json
import os
import socket
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
        self.rooms.command(room, host, "action", {"action": {"type": "cell", "index": 4}})
        self.assertEqual(room["events"][-1]["type"], "action")

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
        playable = next((card for card in server_state["hands"][0] if LAN.color_game_can_play(room, server_state, card, 0)), None)
        if playable:
            color = "red" if playable["color"] == "wild" else None
            updated = self.rooms.command(room, alice, "game-action", {"action": {"type": "play", "cardId": playable["id"], "color": color}})
        else:
            updated = self.rooms.command(room, alice, "game-action", {"action": {"type": "draw"}})
        self.assertIn(updated["phase"], {"playing", "finished"})
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

    def test_unknown_origin_is_rejected(self):
        request = urllib.request.Request(f"http://127.0.0.1:{self.port}/api/lan/status", headers={"Origin": "https://example.invalid"})
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(request, timeout=3)
        self.assertEqual(error.exception.code, 403)
        error.exception.close()

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
