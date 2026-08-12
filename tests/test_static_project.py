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
        for page in [ROOT / "index.html", ROOT / "tests/index.html", *self.game_pages()]:
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


if __name__ == "__main__":
    unittest.main()
