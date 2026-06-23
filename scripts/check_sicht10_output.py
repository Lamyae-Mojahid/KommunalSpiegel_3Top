#!/usr/bin/env python3
import json, sys
from pathlib import Path
p=Path(sys.argv[1] if len(sys.argv)>1 else 'data/sicht10_daseinsvorsorge.json')
d=json.loads(p.read_text(encoding='utf-8'))
print(f"Datei: {p}")
print(f"Schema: {d.get('schema')}")
print(f"Version: {d.get('version')}")
print(f"Quelle: {d.get('source')}")
print(f"API-Status: {d.get('api_status')}\n")
for k in d.get('kommunen',[]):
    mi=k.get('main_indicators') or {}; opt=k.get('optional_layers') or {}; mc=k.get('main_counts') or {}
    print(f"{k.get('kommune')}: status={k.get('status')} | boundary={k.get('boundary_ok')} | {k.get('status_message')}")
    print(f"  Hauptindikatoren:")
    print(f"    Schulabdeckung 10min: {mi.get('school_coverage_percent')}% | Schulen={mc.get('schools')}")
    print(f"    Kita-Abdeckung 10min: {mi.get('kita_coverage_percent')}% | Kitas={mc.get('kitas')}")
    print(f"    Gewerbefläche: {mi.get('commercial_area_m2_per_1000_ew')} m²/1.000 EW | gesamt={mi.get('commercial_area_m2_total')} m² | Objekte={mc.get('commercial_area_objects')}")
    print(f"  Optionale Layer:")
    print(f"    Gesundheit={opt.get('health_count')} | Nahversorgung={opt.get('retail_count')} | ÖPNV={opt.get('mobility_count')}")
    print(f"    Gesundheit 10min={opt.get('health_10min_proxy_percent')}% | Nahversorgung 10min={opt.get('retail_10min_proxy_percent')}% | ÖPNV 600m={opt.get('mobility_600m_proxy_percent')}%")
    if k.get('category_errors'):
        print(f"  WARN: {len(k.get('category_errors'))} Teilfehler")
