#!/usr/bin/env bash
# Usage: devtools/boot.sh <api_port> <vite_port> [name]
# Starts an isolated backend (own temp DB, demo family seeded, PIN 1234) + a Vite dev server.
# Prints PARENT_TOKEN. Logs go to $SCRATCH/<name>-api.log and -vite.log. Stop with: pkill -f "port $1" ; pkill -f "--port $2"
set -e
API=$1; WEB=$2; NAME=${3:-dev}
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRATCH=/tmp/claude-0/-home-claude/72bbd66f-71e0-5c1d-8b40-64a75bf7cba7/scratchpad
PY=$SCRATCH/venv/bin/python
DB=$SCRATCH/$NAME.db; rm -f $DB
cd "$ROOT/backend"
NANI_DB_PATH=$DB VOICE_ONLINE_ENABLED=0 MALLOW_PORT=$API nohup $PY run.py > $SCRATCH/$NAME-api.log 2>&1 &
for i in $(seq 1 40); do curl -s localhost:$API/api/health >/dev/null && break; sleep 0.5; done
curl -s -X POST localhost:$API/api/auth/consent >/dev/null
TOKEN=$(curl -s -X POST localhost:$API/api/auth/setup-pin -H 'content-type: application/json' -d '{"pin":"1234"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -s -X POST localhost:$API/api/demo/seed -H "X-Parent-Token: $TOKEN" >/dev/null
cd "$ROOT/frontend"
MALLOW_API=http://127.0.0.1:$API nohup npx vite --port $WEB --strictPort > $SCRATCH/$NAME-vite.log 2>&1 &
sleep 3
echo "API http://127.0.0.1:$API  WEB http://localhost:$WEB  PARENT_TOKEN=$TOKEN"
echo "Child ids: $(curl -s localhost:$API/api/children | python3 -c 'import sys,json;print([(c["id"],c["nickname"],c["age_band"]) for c in json.load(sys.stdin)])')"
