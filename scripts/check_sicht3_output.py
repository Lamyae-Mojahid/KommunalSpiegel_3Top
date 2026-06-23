#!/usr/bin/env python3
import json, sys
from pathlib import Path
p=Path(sys.argv[1] if len(sys.argv)>1 else "data/sicht3_streetview.json")
d=json.load(open(p,encoding="utf-8"))
print(f"Datei: {p}")
print(f"Schema: {d.get('schema')}")
print(f"Version: {d.get('version')}")
print(f"Quelle: {d.get('source')}")
print(f"API-Status: {d.get('api_status')}")
for k in d.get('kommunen',[]):
    blue=k.get('blue_lines') or []
    roads=k.get('road_lines') or []
    print(f"\n{k.get('kommune')}: status={k.get('status')} | boundary={k.get('boundary_ok')} | live_proxy={k.get('coverage_of_checked_percent')} | hochrechnung={k.get('extrapolated_percent')} | konservativ={k.get('covered_percent')} | proxy={k.get('coverage_is_proxy')} | öffentliche_straßen={k.get('roads_total')} | geprüft={k.get('roads_checked')} | road_lines={len(roads)} | blue_lines={len(blue)} | samples={k.get('metadata_samples')} hitrate={k.get('metadata_hit_rate_percent')} | ok={k.get('metadata_ok')} | benchmark={k.get('benchmark_percent')}")
    if k.get('error'):
        print('  FEHLER:', k.get('error'))
    if k.get('status_message'):
        print(' ', k.get('status_message'))
