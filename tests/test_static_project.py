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


if __name__ == "__main__":
    unittest.main()
