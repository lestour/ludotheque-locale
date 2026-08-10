#!/usr/bin/env sh

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PORT=8765
URL="http://127.0.0.1:${PORT}/index.html"
LOG_FILE="$ROOT/.hub-server.log"

cd "$ROOT" || exit 1
if ! command -v curl >/dev/null 2>&1 || ! curl --silent --fail "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
  if command -v python3 >/dev/null 2>&1; then
    nohup python3 -m http.server "$PORT" --bind 127.0.0.1 >"$LOG_FILE" 2>&1 &
  elif command -v php >/dev/null 2>&1; then
    nohup php -S "127.0.0.1:${PORT}" -t "$ROOT" >"$LOG_FILE" 2>&1 &
  elif command -v ruby >/dev/null 2>&1; then
    nohup ruby -run -e httpd "$ROOT" -p "$PORT" >"$LOG_FILE" 2>&1 &
  else
    printf '%s\n' "Installez Python 3, PHP ou Ruby pour lancer le serveur local." >&2
    exit 1
  fi
  sleep 1
fi

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1
elif command -v gio >/dev/null 2>&1; then
  gio open "$URL" >/dev/null 2>&1
else
  printf 'Ouvrez %s dans votre navigateur.\n' "$URL"
fi
