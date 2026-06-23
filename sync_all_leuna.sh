#!/usr/bin/env bash
set -e
mkdir -p data
python scripts/sync_sicht4.py --kommune Leuna --out data/sicht4_ladeinfrastruktur.json
python scripts/sync_sicht2_osm_pois.py --kommune Leuna --out data/sicht2_pois.json
python scripts/sync_sicht10_daseinsvorsorge.py --kommune Leuna --out data/sicht10_daseinsvorsorge.json
python scripts/check_sicht4_output.py data/sicht4_ladeinfrastruktur.json
python scripts/check_sicht2_output.py data/sicht2_pois.json
python scripts/check_sicht10_output.py data/sicht10_daseinsvorsorge.json
