#!/usr/bin/env python3

import argparse
import json
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def request(url, payload=None, method=None, timeout=5):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"} if data else {}
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers, method=method), timeout=timeout) as response:
            return json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        raise RuntimeError(f"WebDriver HTTP {error.code} : {detail}") from error


def wait(url, timeout=12):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            request(url)
            return
        except (OSError, urllib.error.URLError, json.JSONDecodeError):
            time.sleep(.15)
    raise RuntimeError(f"Service indisponible : {url}")


def main():
    parser = argparse.ArgumentParser(description="Exécute le diagnostic HTML avec Safari WebDriver.")
    parser.add_argument("--server-port", type=int, default=8877)
    parser.add_argument("--driver-port", type=int, default=4444)
    parser.add_argument("--timeout", type=int, default=360)
    parser.add_argument("--campaign", action="store_true", help="Exécute aussi la campagne de générateurs reproductibles.")
    arguments = parser.parse_args()
    driver_binary = shutil.which("safaridriver")
    if not driver_binary:
        print("Safari WebDriver est absent.", file=sys.stderr)
        return 2
    server = subprocess.Popen([sys.executable, str(ROOT / "server/lan_server.py"), "--root", str(ROOT), "--bind", "127.0.0.1", "--port", str(arguments.server_port), "--no-persist"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    driver = subprocess.Popen([driver_binary, "--port", str(arguments.driver_port)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    session_id = None
    endpoint = f"http://127.0.0.1:{arguments.driver_port}"
    try:
        wait(f"http://127.0.0.1:{arguments.server_port}/api/lan/status")
        wait(f"{endpoint}/status")
        created = request(f"{endpoint}/session", {"capabilities": {"alwaysMatch": {"browserName": "safari"}}}, "POST", 30)
        value = created.get("value", created)
        session_id = value.get("sessionId") or created.get("sessionId")
        if not session_id:
            raise RuntimeError(f"Safari refuse la session WebDriver : {created}")
        campaign = "?campaign=1" if arguments.campaign else ""
        request(f"{endpoint}/session/{session_id}/url", {"url": f"http://127.0.0.1:{arguments.server_port}/tests/index.html{campaign}"}, "POST", 30)
        deadline = time.time() + arguments.timeout
        result = None
        script = "return ['passed','failed','pending'].reduce((result,id)=>(result[id]=document.getElementById(id)?.textContent||'',result),{});"
        while time.time() < deadline:
            response = request(f"{endpoint}/session/{session_id}/execute/sync", {"script": script, "args": []}, "POST", 30)
            result = response.get("value") or {}
            if result.get("pending") == "0":
                break
            time.sleep(1)
        if not result or result.get("pending") != "0" or result.get("failed") != "0" or result.get("passed") in {"", "0"}:
            details = request(
                f"{endpoint}/session/{session_id}/execute/sync",
                {"script": "return [...document.querySelectorAll('#results tr')].filter(row=>row.querySelector('.fail')).map(row=>row.innerText).join('\\n');", "args": []},
                "POST",
                30,
            ).get("value")
            suffix = f"\n{details}" if details else ""
            print(f"Diagnostic Safari incomplet : {result}{suffix}", file=sys.stderr)
            return 1
        print(f"Diagnostic Safari réussi : {result['passed']} contrôles.")
        return 0
    except (OSError, RuntimeError, urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as error:
        print(f"Diagnostic Safari impossible : {error}", file=sys.stderr)
        return 2
    finally:
        if session_id:
            try: request(f"{endpoint}/session/{session_id}", method="DELETE")
            except Exception: pass
        driver.terminate(); server.terminate()
        for process in (driver, server):
            try: process.wait(timeout=5)
            except subprocess.TimeoutExpired: process.kill()


if __name__ == "__main__":
    raise SystemExit(main())
