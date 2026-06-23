#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
DEFAULT_SEED_PATH = Path("data/kommunen_seed.json")
def load_seed(seed_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    path = Path(seed_path) if seed_path else DEFAULT_SEED_PATH
    if not path.exists(): return None
    return json.loads(path.read_text(encoding="utf-8"))
def seed_kommunen(seed: Optional[Dict[str, Any]]) -> Optional[List[Dict[str, Any]]]:
    if not seed: return None
    out=[]
    for k in seed.get("kommunen",[]):
        if k.get("active") is False: continue
        center=k.get("center") or {}
        item={"name":k.get("name"),"lk":k.get("landkreis") or k.get("lk"),"ew":k.get("einwohner") or k.get("ew"),"lat":center.get("lat") if center.get("lat") is not None else k.get("lat"),"lng":center.get("lng") if center.get("lng") is not None else k.get("lng")}
        if k.get("ags"): item["ags"]=k.get("ags")
        out.append(item)
    return out
def seed_benchmark_s4(seed: Optional[Dict[str, Any]]) -> Optional[Dict[str, Optional[float]]]:
    if not seed: return None
    return {k.get("name"):((k.get("benchmarks") or {}).get("sicht4_ladeinfrastruktur") or {}).get("ladepunkte_pro_1000_ew") for k in seed.get("kommunen",[])}
def seed_benchmark_s2(seed: Optional[Dict[str, Any]]) -> Tuple[Optional[Dict[str, Optional[float]]], Optional[Dict[str, Optional[int]]]]:
    if not seed: return None, None
    pro,counts={},{}
    for k in seed.get("kommunen",[]):
        b=((k.get("benchmarks") or {}).get("sicht2_virtuelle_touren") or {})
        pro[k.get("name")]=b.get("touren_pro_1000_ew")
        if b.get("touren_count") is not None: counts[k.get("name")]=b.get("touren_count")
    return pro, counts
def seed_benchmark_s10(seed: Optional[Dict[str, Any]]) -> Optional[Dict[str, Dict[str, Any]]]:
    if not seed: return None
    out={}
    for k in seed.get("kommunen",[]):
        b=((k.get("benchmarks") or {}).get("sicht10_daseinsvorsorge") or {})
        out[k.get("name")]={"school_coverage_percent":b.get("school_coverage_percent"),"kita_coverage_percent":b.get("kita_coverage_percent"),"commercial_area_m2_per_1000_ew":b.get("commercial_area_m2_per_1000_ew"),"source":b.get("source") or "kommunen_seed.json"}
    return out
