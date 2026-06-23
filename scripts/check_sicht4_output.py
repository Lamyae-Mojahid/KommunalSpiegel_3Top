#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, sys
from pathlib import Path
p = Path(sys.argv[1] if len(sys.argv)>1 else 'data/sicht4_ladeinfrastruktur.json')
obj = json.loads(p.read_text(encoding='utf-8'))
print('Datei:', p)
print('Schema:', obj.get('schema'))
print('Version:', obj.get('version'))
print('Quelle:', obj.get('source',{}).get('name'))
print('API-Status:', obj.get('source',{}).get('api_status'))
print('Verwertbare BNetzA-Punkte gesamt:', obj.get('statistik',{}).get('verwertbare_ladepunkte'))
print('Live-Ladepunkte gesamt nach Grenzen:', obj.get('statistik',{}).get('ladepunkte_api_gesamt'))
print()
for k in obj.get('kommunen', []):
    print(f"{k.get('kommune')}: status={k.get('status')} | boundary={k.get('boundary_ok')} | LP={k.get('ladepunkte_gesamt')} | pro1000={k.get('ladepunkte_pro_1000_ew')} | Benchmark={k.get('benchmark_ladepunkte_pro_1000_ew')} | {k.get('status_message')}")
