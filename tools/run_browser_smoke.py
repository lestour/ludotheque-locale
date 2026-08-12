#!/usr/bin/env python3

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def browser_path(explicit=None):
    candidates = [
        explicit,
        os.environ.get("CHROME_BIN"),
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ]
    return next((str(path) for path in candidates if path and Path(path).is_file()), None)


def wait_for_server(url, timeout=8):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(0.1)
    raise RuntimeError("Le serveur de diagnostic ne répond pas.")


def text_for_id(html, element_id):
    match = re.search(rf'<[^>]+id=["\']{re.escape(element_id)}["\'][^>]*>([^<]*)<', html, re.IGNORECASE)
    return match.group(1).strip() if match else None


def main():
    parser = argparse.ArgumentParser(description="Exécute le diagnostic HTML dans Chrome/Chromium headless.")
    parser.add_argument("--browser")
    parser.add_argument("--port", type=int, default=8876)
    parser.add_argument("--budget-ms", type=int, default=240000)
    arguments = parser.parse_args()
    browser = browser_path(arguments.browser)
    if not browser:
        print("Chrome ou Chromium est requis pour le smoke test navigateur.", file=sys.stderr)
        return 2
    server = subprocess.Popen(
        [sys.executable, str(ROOT / "server/lan_server.py"), "--root", str(ROOT), "--bind", "127.0.0.1", "--port", str(arguments.port), "--no-persist"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        url = f"http://127.0.0.1:{arguments.port}/tests/index.html"
        wait_for_server(f"http://127.0.0.1:{arguments.port}/api/lan/status")
        with tempfile.TemporaryDirectory() as profile:
            command = [
                browser,
                "--headless=new",
                "--no-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                f"--user-data-dir={profile}",
                f"--virtual-time-budget={max(30000, arguments.budget_ms)}",
                "--dump-dom",
                url,
            ]
            result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=max(90, arguments.budget_ms // 1000 + 90))
        if result.returncode:
            print(result.stderr[-4000:], file=sys.stderr)
            return result.returncode
        failed = text_for_id(result.stdout, "failed")
        pending = text_for_id(result.stdout, "pending")
        passed = text_for_id(result.stdout, "passed")
        if failed != "0" or pending != "0" or not passed or passed == "0":
            output = ROOT / "browser-smoke-failure.html"
            output.write_text(result.stdout, encoding="utf-8")
            print(f"Diagnostic navigateur incomplet : réussis={passed}, échecs={failed}, restants={pending}. DOM : {output}", file=sys.stderr)
            return 1
        print(f"Diagnostic navigateur réussi : {passed} contrôles.")
        return 0
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    raise SystemExit(main())

