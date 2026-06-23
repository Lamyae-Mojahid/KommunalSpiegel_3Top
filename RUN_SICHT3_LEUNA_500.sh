#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
  echo "FEHLER: Bitte zuerst export GOOGLE_MAPS_API_KEY="AIza..." setzen"
  exit 1
fi
python scripts/sync_sicht3_streetview_google.py --kommune Leuna --out data/sicht3_streetview.json --debug --max-api-roads 500 --google-timeout 8
python scripts/check_sicht3_output.py data/sicht3_streetview.json
