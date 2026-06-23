#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, sys
from pathlib import Path

path = Path(sys.argv[1] if len(sys.argv) > 1 else "data/sicht2_pois.json")
obj = json.loads(path.read_text(encoding="utf-8"))
print(f"Datei: {path}")
print(f"Schema: {obj.get('schema')}")
print(f"Version: {obj.get('version')}")
print(f"Quelle: {obj.get('source')}")
print(f"API-Status: {obj.get('api_status')}\n")
for k in obj.get("kommunen", []):
    ratio = k.get("quality_ratio")
    ratio_s = "None" if ratio is None else f"{ratio:.2f}"
    print(f"{k.get('kommune')}: status={k.get('status')} | boundary={k.get('boundary_ok')} | Kandidaten={k.get('candidate_count')} | verifizierte Touren={k.get('verified_tour_count')} | Benchmark={k.get('benchmark_count')} | ratio={ratio_s} | {k.get('status_message')}")
    cats = k.get("categories_candidates") or {}
    if cats:
        print("  Kandidaten-Kategorien: " + ", ".join(f"{a}={b}" for a,b in sorted(cats.items())))
    vcats = k.get("categories_verified") or {}
    if vcats:
        print("  Verifizierte Kategorien: " + ", ".join(f"{a}={b}" for a,b in sorted(vcats.items())))
    if not k.get("verification_available"):
        print("  Hinweis: Keine Bildprüfung aktiv. Für echten API-Ersatz MAPILLARY_TOKEN setzen oder --mapillary-token übergeben.")
