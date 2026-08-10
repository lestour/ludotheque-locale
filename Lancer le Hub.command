#!/bin/zsh

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT=8765
URL="http://127.0.0.1:${PORT}/index.html"
PID_FILE="$ROOT/.hub-server.pid"

for REQUIRED in "index.html" "games/rhythm/assets/MS-Basic.sf3" "vendor/spessasynth_lib/dist/spessasynth_processor.min.js" "vendor/spessasynth_core/dist/index.js" "vendor/stb-vorbis/dist/index.js"; do
  if [ ! -s "$ROOT/$REQUIRED" ]; then
    osascript -e "display alert \"Ludothèque locale\" message \"Fichier requis absent ou vide : $REQUIRED. Décompressez de nouveau le dossier complet.\" as critical"
    exit 1
  fi
done

if curl --silent --fail "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
  open "$URL"
  exit 0
fi

cd "$ROOT" || exit 1
echo $$ >"$PID_FILE"
(sleep 1; open "$URL") &
printf '%s\n' "Ludothèque locale active sur $URL"
printf '%s\n' "Gardez cette fenêtre ouverte pendant l’utilisation. Ctrl+C arrête le serveur."

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v php >/dev/null 2>&1; then
  exec php -S "127.0.0.1:${PORT}" -t "$ROOT"
elif command -v ruby >/dev/null 2>&1; then
  exec ruby -run -e httpd "$ROOT" -p "$PORT"
else
  osascript -e 'display alert "Ludothèque locale" message "Aucun serveur local compatible trouvé. Installez Python 3 puis relancez." as critical'
  exit 1
fi
