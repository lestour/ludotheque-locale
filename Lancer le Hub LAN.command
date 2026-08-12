#!/bin/zsh

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT=8765
PROTOCOL=http
TLS_ARGS=()
if [[ -f "$ROOT/.runtime/tls/lan.crt" && -f "$ROOT/.runtime/tls/lan.key" ]]; then
  PROTOCOL=https
  TLS_ARGS=(--cert "$ROOT/.runtime/tls/lan.crt" --key "$ROOT/.runtime/tls/lan.key")
fi

if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display alert "Ludothèque LAN" message "Python 3 est nécessaire pour héberger les salons LAN." as critical'
  exit 1
fi

if curl --insecure --silent --fail "${PROTOCOL}://127.0.0.1:${PORT}/api/lan/status" >/dev/null 2>&1; then
  open "${PROTOCOL}://127.0.0.1:${PORT}/index.html"
  exit 0
fi

cd "$ROOT" || exit 1
PORT=$(python3 server/lan_server.py --find-port --port "$PORT")
LOCAL_URL="${PROTOCOL}://127.0.0.1:${PORT}/index.html"
(sleep 1; open "$LOCAL_URL") &
exec python3 server/lan_server.py --port "$PORT" --root "$ROOT" "${TLS_ARGS[@]}"
