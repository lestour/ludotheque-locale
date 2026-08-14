import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class StaticProjectTests(unittest.TestCase):
    def game_pages(self):
        return [path for path in ROOT.glob("games/**/*.html") if path.name != "index.html"]

    def test_game_pages_are_mobile_and_use_runtime(self):
        for page in self.game_pages():
            content = page.read_text(encoding="utf-8")
            with self.subTest(page=page.relative_to(ROOT)):
                self.assertIn('name="viewport"', content)
                self.assertIn("shared/game-runtime.js", content)

    def test_local_page_scripts_exist(self):
        pattern = re.compile(r'<script[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)
        for page in [ROOT / "index.html", ROOT / "replay.html", ROOT / "tests/index.html", *self.game_pages()]:
            content = page.read_text(encoding="utf-8")
            for source in pattern.findall(content):
                if source.startswith(("http://", "https://", "//")):
                    continue
                script = (page.parent / source.split("?", 1)[0]).resolve()
                with self.subTest(page=page.relative_to(ROOT), source=source):
                    self.assertTrue(script.is_file(), f"Script local absent : {script}")

    def test_publishable_legal_files_and_audio_assets_exist(self):
        required = [
            "LICENSE",
            "LEGAL.md",
            "THIRD_PARTY_NOTICES.md",
            "games/rhythm/assets/MS-Basic.sf3",
            "games/rhythm/assets/MS-Basic-LICENSE.md",
            "vendor/spessasynth_core/LICENSE",
            "vendor/spessasynth_lib/LICENSE",
            "vendor/stb-vorbis/LICENSE",
        ]
        for name in required:
            with self.subTest(path=name):
                self.assertTrue((ROOT / name).is_file())

    def test_shared_floating_controls_use_opposite_corners(self):
        lan = (ROOT / "shared/lan-multiplayer.js").read_text(encoding="utf-8")
        records = (ROOT / "shared/records.js").read_text(encoding="utf-8")
        self.assertRegex(lan, r"#lanButton\{[^}]*left:14px;right:auto")
        self.assertRegex(records, r"\.game-record-badge\{[^}]*right:max\(14px")

    def test_accessibility_and_portable_backup_are_available(self):
        runtime = (ROOT / "shared/game-runtime.js").read_text(encoding="utf-8")
        hub = (ROOT / "hub.js").read_text(encoding="utf-8")
        self.assertIn("installAccessibilityPreferences", runtime)
        self.assertIn("app-reduce-motion", runtime)
        self.assertIn("portableStoragePrefixes", hub)
        self.assertNotIn("ludotheque:lan", re.search(r"portableStoragePrefixes\s*=\s*\[([^]]+)", hub).group(1))
        self.assertIn("createAutosave", runtime)
        self.assertIn("profileKey", runtime)
        self.assertIn("listAutosaves", runtime)
        self.assertIn("manageSaves", hub)

    def test_every_game_gets_option_help(self):
        runtime = (ROOT / "shared/game-runtime.js").read_text(encoding="utf-8")
        help_script = (ROOT / "shared/options-help.js").read_text(encoding="utf-8")
        self.assertIn("data-options-help", runtime)
        self.assertIn("GameOptionsHelp", help_script)

    def test_replay_reader_is_packaged_and_accepts_lan_exports(self):
        replay_page = (ROOT / "replay.html").read_text(encoding="utf-8")
        replay_script = (ROOT / "replay.js").read_text(encoding="utf-8")
        lan = (ROOT / "shared/lan-multiplayer.js").read_text(encoding="utf-8")
        self.assertIn("replay.js", replay_page)
        self.assertIn("ludotheque-lan-replay", replay_script)
        self.assertIn("version: 2", lan)

    def test_ci_and_universal_packager_exist(self):
        self.assertTrue((ROOT / ".github/workflows/validate.yml").is_file())
        self.assertTrue((ROOT / "tools/run_browser_smoke.py").is_file())
        self.assertTrue((ROOT / "tools/create_lan_certificate.py").is_file())
        self.assertTrue((ROOT / "tools/check_javascript.py").is_file())
        self.assertTrue((ROOT / "tools/run_safari_smoke.py").is_file())
        packager = (ROOT / "tools/package_release.py").read_text(encoding="utf-8")
        self.assertIn("Ludotheque-locale.zip", packager)
        self.assertIn("MS-Basic.sf3", packager)
        release_guide = (ROOT / "docs/RELEASE.md").read_text(encoding="utf-8")
        self.assertIn("package_release.py", release_guide)
        self.assertIn("run_browser_smoke.py", release_guide)

    def test_runtime_state_is_excluded_from_publication(self):
        ignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
        packager = (ROOT / "tools/package_release.py").read_text(encoding="utf-8")
        self.assertIn(".runtime/", ignore)
        self.assertIn('".runtime"', packager)
        server = (ROOT / "server/lan_server.py").read_text(encoding="utf-8")
        self.assertIn('part.startswith(".")', server)

    def test_expected_race_and_turn_games_are_exposed_in_lan(self):
        client = (ROOT / "shared/lan-multiplayer.js").read_text(encoding="utf-8")
        for route in [
            "games/grid/sudoku.html",
            "games/grid/nonogram.html",
            "games/grid/minesweeper.html",
            "games/grid/logic-puzzles.html",
            "games/arcade/arcade.html",
            "games/arcade/stellar-assault.html",
            "games/arcade/vector-drift.html",
            "games/arcade/pocket-platformer.html",
            "games/arcade/pinball.html",
            "games/arcade/labyrinthe-glouton.html",
            "games/arcade/traversee-turbo.html",
            "games/arcade/asteria.html",
            "games/arcade/eclipse-depths.html",
            "games/grid/fusion-2048.html",
            "games/cards/classic/memory.html",
            "games/rhythm/rhythm-echo.html",
            "games/board/mahjong.html",
            "games/cards/classic/klondike.html",
            "games/cards/classic/bataille-corse.html",
            "games/cards/modern/totem-reflexe.html",
            "games/cards/modern/symbole-unique.html",
            "games/cards/modern/sixieme-carte.html",
            "games/cards/modern/roi-pirate.html",
            "games/cards/modern/course-1000.html",
            "games/cards/modern/chatastrophe.html",
            "games/cards/modern/grille-zero.html",
            "games/cards/classic/rami-cartes.html",
            "games/board/rami-tuiles.html",
            "games/board/board-games.html",
            "games/board/chess.html",
            "games/board/go.html",
        ]:
            with self.subTest(route=route):
                self.assertIn(f"'{route}'", client)

    def test_lan_exposes_coop_race_and_team_profiles(self):
        client = (ROOT / "shared/lan-multiplayer.js").read_text(encoding="utf-8")
        for profile in ["coop", "race", "versus", "coopScore", "teams"]:
            with self.subTest(profile=profile):
                self.assertIn(f"id: '{profile}'", client)
        self.assertIn("receivesActionFrom", client)
        self.assertIn("teamCount", client)
        self.assertIn("lanMyTeam", client)
        self.assertIn("set-team", (ROOT / "server" / "lan_server.py").read_text(encoding="utf-8"))

    def test_score_challenges_use_reproducible_lan_seeds(self):
        for path in ["games/grid/fusion-2048.js", "games/cards/classic/memory.js", "games/rhythm/rhythm-echo.js"]:
            script = (ROOT / path).read_text(encoding="utf-8")
            with self.subTest(path=path):
                self.assertIn("URLSearchParams(location.search).get('seed')", script)
                self.assertIn("createRandom", script)
                self.assertIn("lan:start", script)

    def test_race_games_render_interpolated_lan_ghosts(self):
        client = (ROOT / "shared/lan-multiplayer.js").read_text(encoding="utf-8")
        server = (ROOT / "server" / "lan_server.py").read_text(encoding="utf-8")
        self.assertIn("sendGhost", client)
        self.assertIn("lan:ghost", client)
        self.assertIn("validate_ghost_snapshot", server)
        for path in ["games/arcade/stellar-assault.js", "games/arcade/vector-drift.js", "games/arcade/pocket-platformer.js", "games/arcade/pinball.js"]:
            script = (ROOT / path).read_text(encoding="utf-8")
            with self.subTest(path=path):
                self.assertIn("sendGhost", script)
                self.assertIn("lan:ghost", script)
                self.assertIn("displayX", script)

    def test_pinball_exposes_advanced_table_mechanics(self):
        page = (ROOT / "games/arcade/pinball.html").read_text(encoding="utf-8")
        script = (ROOT / "games/arcade/pinball.js").read_text(encoding="utf-8")
        for mechanic in ["hitSpinner", "captureSaucer", "startMultiball", "kickbackLit", "skillShotChecked", "PinballTestAPI"]:
            with self.subTest(mechanic=mechanic):
                self.assertIn(mechanic, script)
        self.assertIn("startOverdrive", script)
        self.assertIn("SUPER JACKPOT", script)
        for control in ["flipperStyle", "effects", "haptics"]:
            with self.subTest(control=control):
                self.assertIn(f'id="{control}"', page)

    def test_new_arcade_games_expose_procedural_mechanics(self):
        glouton = (ROOT / "games/arcade/labyrinthe-glouton.js").read_text(encoding="utf-8")
        crossing = (ROOT / "games/arcade/traversee-turbo.js").read_text(encoding="utf-8")
        for feature in ["generateMaze", "reachableCount", "chooseGhostDirection", "GloutonTestAPI"]:
            with self.subTest(feature=feature):
                self.assertIn(feature, glouton)
        for feature in ["createLane", "requestMove", "TraverseeTestAPI"]:
            with self.subTest(feature=feature):
                self.assertIn(feature, crossing)

    def test_asteria_exposes_progressive_world_and_dungeons(self):
        world = (ROOT / "games/arcade/asteria-world.js").read_text(encoding="utf-8")
        game = (ROOT / "games/arcade/asteria.js").read_text(encoding="utf-8")
        client = (ROOT / "shared/lan-multiplayer.js").read_text(encoding="utf-8")
        for feature in ["generateWorld", "generateDungeon", "validateWorld", "validateDungeon", "guaranteeProgressionAccess", "progressionRoutes", "elevationAt", "itemBacktracking", "MAIN_DUNGEONS", "coopPlates"]:
            with self.subTest(feature=feature):
                self.assertIn(feature, world)
        for feature in ["enterDungeon", "completeBoss", "openMerchant", "saveGame", "bombLevel", "mapRevealed", "saveMigration", "bossAttack", "puzzleSequence", "maintainWorldEncounters", "fullWorldRoute", "enemy-damage", "AsteriaTestAPI"]:
            with self.subTest(feature=feature):
                self.assertIn(feature, game)
        self.assertIn("games/arcade/asteria.html", client)
        self.assertIn("Coopération · monde partagé", client)

    def test_eclipse_depths_exposes_validated_metroid_progression(self):
        world = (ROOT / "games/arcade/eclipse-depths-world.js").read_text(encoding="utf-8")
        game = (ROOT / "games/arcade/eclipse-depths.js").read_text(encoding="utf-8")
        client = (ROOT / "shared/lan-multiplayer.js").read_text(encoding="utf-8")
        for feature in ["MAIN_UPGRADES", "BONUS_UPGRADES", "JUMP_PHYSICS", "platformReachability", "generateWorld", "generateRoomLayout", "validateRoomLayout", "validateWorld", "movingBounds", "progressionGate", "returnShortcut"]:
            with self.subTest(feature=feature):
                self.assertIn(feature, world)
        for feature in ["activateAbility", "updateMasteryChallenge", "grantMasteryReward", "masterySolved", "bossAttack", "collectPickup", "saveGame", "eclipse-enemy-damage", "EclipseDepthsTestAPI"]:
            with self.subTest(feature=feature):
                self.assertIn(feature, game)
        self.assertIn("games/arcade/eclipse-depths.html", client)

    def test_pocket_platformer_validates_physical_jump_routes(self):
        script = (ROOT / "games/arcade/pocket-platformer.js").read_text(encoding="utf-8")
        for feature in ["PLATFORM_PHYSICS", "maximumJumpGap", "canJumpBetween", "validateLevel", "safeSecrets"]:
            with self.subTest(feature=feature):
                self.assertIn(feature, script)

    def test_logic_puzzles_use_rule_engines(self):
        page = (ROOT / "games/grid/logic-puzzles.html").read_text(encoding="utf-8")
        interface = (ROOT / "games/grid/logic-puzzles.js").read_text(encoding="utf-8")
        engine = (ROOT / "games/grid/logic-puzzles-engine.js").read_text(encoding="utf-8")
        self.assertIn("logic-puzzles-engine.js", page)
        self.assertNotIn("createElement('input')", interface)
        for validator in ["validFutoshiki", "validKakuro", "validHidato", "validHitori", "validNurikabe", "validAkari", "validSlitherlink", "validNumberlink"]:
            with self.subTest(validator=validator):
                self.assertIn(f"function {validator}", engine)
        self.assertNotIn("Ce solveur spécifique reste à terminer", interface)


if __name__ == "__main__":
    unittest.main()
