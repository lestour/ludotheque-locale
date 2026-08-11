#!/usr/bin/env sh

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PORT=8765

if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' "Python 3 est nécessaire pour héberger les salons LAN." >&2
  exit 1
fi

open_hub() {
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$LOCAL_URL" >/dev/null 2>&1
  elif command -v gio >/dev/null 2>&1; then gio open "$LOCAL_URL" >/dev/null 2>&1
  else printf 'Ouvrez %s dans votre navigateur.\n' "$LOCAL_URL"
  fi
}

if command -v curl >/dev/null 2>&1 && curl --silent --fail "http://127.0.0.1:${PORT}/api/lan/status" >/dev/null 2>&1; then
  LOCAL_URL="http://127.0.0.1:${PORT}/index.html"
  open_hub
  exit 0
fi

cd "$ROOT" || exit 1
PORT=$(python3 server/lan_server.py --find-port --port "$PORT")
LOCAL_URL="http://127.0.0.1:${PORT}/index.html"
(sleep 1; open_hub) &
exec python3 server/lan_server.py --port "$PORT" --root "$ROOT"
