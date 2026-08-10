#!/bin/zsh

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT=8765
URL="http://127.0.0.1:${PORT}/index.html"
PID_FILE="$ROOT/.hub-server.pid"
LOG_FILE="$ROOT/.hub-server.log"

for REQUIRED in "index.html" "games/rhythm/assets/MS-Basic.sf3" "vendor/spessasynth_lib/dist/spessasynth_processor.min.js" "vendor/spessasynth_core/dist/index.js" "vendor/stb-vorbis/dist/index.js"; do
  if [ ! -s "$ROOT/$REQUIRED" ]; then
    osascript -e "display alert \"Ludothèque locale\" message \"Fichier requis absent ou vide : $REQUIRED. Décompressez de nouveau le dossier complet.\" as critical"
    exit 1
  fi
done

if ! curl --silent --fail "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
  cd "$ROOT" || exit 1
  if command -v python3 >/dev/null 2>&1; then
    nohup python3 -m http.server "$PORT" --bind 127.0.0.1 >"$LOG_FILE" 2>&1 &
  elif command -v php >/dev/null 2>&1; then
    nohup php -S "127.0.0.1:${PORT}" -t "$ROOT" >"$LOG_FILE" 2>&1 &
  elif command -v ruby >/dev/null 2>&1; then
    nohup ruby -run -e httpd "$ROOT" -p "$PORT" >"$LOG_FILE" 2>&1 &
  else
    osascript -e 'display alert "Ludothèque locale" message "Aucun serveur local compatible trouvé. Installez Python 3 puis relancez." as critical'
    exit 1
  fi
  echo $! >"$PID_FILE"
  sleep 1
fi

open "$URL"
