#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KommunalSpiegel · Sicht 2 Virtuelle Touren · Backend v7.3

Fachliche Korrektur:
Eine virtuelle Tour ist NICHT einfach jeder OSM-POI. Gezählt werden nur Orte,
für die mindestens 3 unterschiedliche Aufnahmen / Blickpunkte nachweisbar sind.

Ablauf:
1) Benchmark laden
2) Gemeindegrenze laden
3) OSM nur als Kandidatenquelle für touristisch relevante Orte nutzen
4) Kandidaten gegen Gemeindegrenze filtern
5) Optional Mapillary-Bilder je Kandidat prüfen: mindestens 3 Bilder im Radius
6) Nur verifizierte Touren zählen; OSM-Kandidaten separat als Hinweise speichern
7) Benchmark-Vergleich + Statuslogik
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests
from kommunen_seed_loader import load_seed, seed_kommunen, seed_benchmark_s4, seed_benchmark_s2, seed_benchmark_s10

try:
    from supabase import create_client
except ImportError:
    create_client = None

VERSION = "7.6.0"
SCHEMA = "kommunalspiegel.sicht2_virtuelle_touren.v7_6_top3_overpassfix"

# ── Supabase: feste kommune_id-Zuordnung für die 3 Pilotkommunen ────
KOMMUNE_IDS = {
    "Leuna": 1,
    "Querfurt": 2,
    "Bad Dürrenberg": 3,
}
USER_AGENT = "KommunalSpiegel/7.4 Hochschulprojekt Sicht2 VirtuelleTouren"
TIMEOUT = 25
DATA_DIR = Path("data")
CACHE_DIR = DATA_DIR / "cache"
OUT_FILE = DATA_DIR / "sicht2_pois.json"
BOUNDARY_CACHE = CACHE_DIR / "sicht2_boundaries.json"
SHARED_BOUNDARY_CACHE = CACHE_DIR / "boundaries_shared.json"

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
MAPILLARY_IMAGES_URL = "https://graph.mapillary.com/images"

KOMMUNEN: List[Dict[str, Any]] = [
    {"name":"Aken", "lk":"Anhalt-Bitterfeld", "ew":7200, "lat":51.8533, "lng":12.0446},
    {"name":"Köthen", "lk":"Anhalt-Bitterfeld", "ew":26500, "lat":51.7510, "lng":11.9729},
    {"name":"Muldestausee", "lk":"Anhalt-Bitterfeld", "ew":7800, "lat":51.6895, "lng":12.3165},
    {"name":"Osternienburger Land", "lk":"Anhalt-Bitterfeld", "ew":8700, "lat":51.7203, "lng":12.1472},
    {"name":"Raguhn-Jeßnitz", "lk":"Anhalt-Bitterfeld", "ew":8200, "lat":51.7131, "lng":12.2861},
    {"name":"Sandersdorf-Brehna", "lk":"Anhalt-Bitterfeld", "ew":14200, "lat":51.6124, "lng":12.2280},
    {"name":"Südliches Anhalt", "lk":"Anhalt-Bitterfeld", "ew":16100, "lat":51.6580, "lng":11.9055},
    {"name":"Zerbst/Anhalt", "lk":"Anhalt-Bitterfeld", "ew":20700, "lat":51.9679, "lng":12.0898},
    {"name":"Zörbig", "lk":"Anhalt-Bitterfeld", "ew":8600, "lat":51.6249, "lng":12.1249},
    {"name":"Hohenmölsen", "lk":"Burgenlandkreis", "ew":9200, "lat":51.1588, "lng":12.0944},
    {"name":"Lützen", "lk":"Burgenlandkreis", "ew":8100, "lat":51.2566, "lng":12.1407},
    {"name":"Teuchern", "lk":"Burgenlandkreis", "ew":7100, "lat":51.1508, "lng":12.0175},
    {"name":"Allstedt", "lk":"Mansfeld-Südharz", "ew":8300, "lat":51.3979, "lng":11.4119},
    {"name":"Arnstein", "lk":"Mansfeld-Südharz", "ew":7900, "lat":51.5588, "lng":11.3758},
    {"name":"Eisleben", "lk":"Mansfeld-Südharz", "ew":23800, "lat":51.5294, "lng":11.5492},
    {"name":"Gerbstedt", "lk":"Mansfeld-Südharz", "ew":7300, "lat":51.6252, "lng":11.6141},
    {"name":"Hettstedt", "lk":"Mansfeld-Südharz", "ew":13400, "lat":51.6488, "lng":11.5022},
    {"name":"Mansfeld", "lk":"Mansfeld-Südharz", "ew":7700, "lat":51.5968, "lng":11.4632},
    {"name":"Seegebiet Mansfelder Land", "lk":"Mansfeld-Südharz", "ew":8400, "lat":51.5699, "lng":11.7044},
    {"name":"Südharz", "lk":"Mansfeld-Südharz", "ew":8600, "lat":51.5117, "lng":10.9705},
    {"name":"Bad Dürrenberg", "lk":"Saalekreis", "ew":9800, "lat":51.2965, "lng":12.0645},
    {"name":"Bad Lauchstädt", "lk":"Saalekreis", "ew":9100, "lat":51.3875, "lng":11.8714},
    {"name":"Braunsbedra", "lk":"Saalekreis", "ew":10600, "lat":51.2872, "lng":11.8843},
    {"name":"Kabelsketal", "lk":"Saalekreis", "ew":11200, "lat":51.4522, "lng":12.0089},
    {"name":"Landsberg", "lk":"Saalekreis", "ew":9700, "lat":51.5219, "lng":11.9877, "ags":"15088195"},
    {"name":"Leuna", "lk":"Saalekreis", "ew":14500, "lat":51.3286, "lng":12.0032, "ags":"15088205"},
    {"name":"Mücheln (Geiseltal)", "lk":"Saalekreis", "ew":8600, "lat":51.2994, "lng":11.7996},
    {"name":"Petersberg", "lk":"Saalekreis", "ew":13100, "lat":51.5428, "lng":11.9875},
    {"name":"Querfurt", "lk":"Saalekreis", "ew":12800, "lat":51.3803, "lng":11.5897},
    {"name":"Salzatal", "lk":"Saalekreis", "ew":8800, "lat":51.4610, "lng":11.7783},
    {"name":"Schkopau", "lk":"Saalekreis", "ew":9300, "lat":51.3860, "lng":12.0049},
    {"name":"Teutschenthal", "lk":"Saalekreis", "ew":8900, "lat":51.4589, "lng":11.7875},
    {"name":"Wettin-Löbejün", "lk":"Saalekreis", "ew":11800, "lat":51.5490, "lng":11.8855},
]

BENCHMARK_PRO_TAUSEND: Dict[str, Optional[float]] = {
    "Köthen":0.00, "Muldestausee":0.13, "Osternienburger Land":0.13, "Südliches Anhalt":0.00,
    "Allstedt":0.00, "Eisleben":0.22, "Gerbstedt":0.00, "Seegebiet Mansfelder Land":0.00,
    "Bad Dürrenberg":0.61, "Bad Lauchstädt":0.11, "Braunsbedra":0.58, "Kabelsketal":0.00,
    "Landsberg":0.00, "Leuna":0.41, "Mücheln (Geiseltal)":0.32, "Querfurt":0.40,
    "Salzatal":0.02, "Wettin-Löbejün":0.00,
}
BENCHMARK_COUNTS: Dict[str, Optional[int]] = {"Leuna": 8}

# Strenger als v7.2: OSM ist nur Kandidatenquelle, nicht finaler Zähler.
# Bewusst keine building=church-Massenabfrage und kein tourism=information pauschal.
POI_CATEGORIES = [
    {"id":"attraction", "label":"Sehenswürdigkeiten", "filters":[('["tourism"="attraction"]', 'tourism=attraction')]},
    {"id":"viewpoint", "label":"Aussichtspunkte", "filters":[('["tourism"="viewpoint"]', 'tourism=viewpoint')]},
    {"id":"museum", "label":"Museen / Ausstellungen", "filters":[('["tourism"="museum"]', 'tourism=museum'), ('["amenity"="museum"]', 'amenity=museum')]},
    {"id":"monument", "label":"Denkmale / Monumente", "filters":[('["historic"="monument"]', 'historic=monument'), ('["historic"="castle"]', 'historic=castle')]},
    {"id":"memorial_named", "label":"Benannte Gedenkorte", "filters":[('["historic"="memorial"]["name"]', 'historic=memorial+name')]},
    {"id":"info_core", "label":"Touristische Info-Kernpunkte", "filters":[('["tourism"="information"]["name"]["information"~"^(office|visitor_centre|board|map)$"]', 'tourism=information+core')]},
]

@dataclass
class Candidate:
    id: str
    osm_type: str
    osm_id: int
    name: str
    category: str
    category_label: str
    tag_match: str
    lat: float
    lng: float
    source: str
    tags: Dict[str, Any]
    osm_evidence_count: int = 0
    mapillary_image_count: Optional[int] = None
    verified_virtual_tour: bool = False
    verification_method: str = "unverified"
    evidence: List[str] = None


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def norm_key(s: Any) -> str:
    s = str(s or "").strip().lower()
    for a,b in {"ä":"ae","ö":"oe","ü":"ue","ß":"ss","é":"e","è":"e"}.items():
        s = s.replace(a,b)
    return re.sub(r"[^a-z0-9]+", "", s)


def kommune_by_name(name: str) -> Optional[Dict[str, Any]]:
    nk = norm_key(name)
    for k in KOMMUNEN:
        if norm_key(k["name"]) == nk:
            return k
    aliases = {"muecheln":"Mücheln (Geiseltal)", "kothen":"Köthen", "koethen":"Köthen"}
    ali = aliases.get(nk)
    return kommune_by_name(ali) if ali else None


def load_json(path: Path, default: Any) -> Any:
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def extract_polygons(geojson: Dict[str, Any]) -> List[List[Tuple[float,float]]]:
    geom = geojson.get("geometry", geojson)
    typ = geom.get("type")
    coords = geom.get("coordinates")
    polys: List[List[Tuple[float,float]]] = []
    if not coords:
        return polys
    if typ == "Polygon":
        for ring in coords[:1]:
            polys.append([(float(y), float(x)) for x,y in ring if x is not None and y is not None])
    elif typ == "MultiPolygon":
        for poly in coords:
            if poly and poly[0]:
                polys.append([(float(y), float(x)) for x,y in poly[0] if x is not None and y is not None])
    return [p for p in polys if len(p) >= 4]


def point_in_ring(lat: float, lng: float, ring: List[Tuple[float,float]]) -> bool:
    inside = False
    j = len(ring) - 1
    x, y = lng, lat
    for i in range(len(ring)):
        yi, xi = ring[i]
        yj, xj = ring[j]
        intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi)
        if intersect:
            inside = not inside
        j = i
    return inside


def point_in_polygons(lat: float, lng: float, polygons: List[List[Tuple[float,float]]]) -> bool:
    return any(point_in_ring(lat, lng, p) for p in polygons)


def nominatim_get_with_retry(params: Dict[str, Any], retries: int = 4) -> requests.Response:
    """Nominatim blockiert schnelle Serienabfragen. Bei 429 wird gewartet statt abgebrochen."""
    headers = {"User-Agent": USER_AGENT}
    wait = 8.0  # SAFE_NOMINATIM: Batchläufe brauchen echte Pausen
    last_exc = None
    for attempt in range(retries):
        try:
            r = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=TIMEOUT)
            if r.status_code == 429:
                retry_after = r.headers.get('Retry-After')
                sleep_s = max(20.0, float(retry_after)) if retry_after and str(retry_after).isdigit() else wait * (attempt + 1)
                log(f"WARN: Nominatim 429 Too many requests – warte {sleep_s:.1f}s und versuche erneut")
                time.sleep(sleep_s)
                continue
            r.raise_for_status()
            time.sleep(2.2)
            return r
        except requests.HTTPError as e:
            last_exc = e
            if getattr(e.response, 'status_code', None) in {429, 502, 503, 504}:
                sleep_s = wait * (attempt + 1)
                log(f"WARN: Nominatim HTTP {e.response.status_code} – warte {sleep_s:.1f}s")
                time.sleep(sleep_s)
                continue
            raise
        except Exception as e:
            last_exc = e
            sleep_s = wait * (attempt + 1)
            log(f"WARN: Nominatim Fehler: {e} – warte {sleep_s:.1f}s")
            time.sleep(sleep_s)
    if last_exc:
        raise last_exc
    raise RuntimeError('Nominatim konnte nach mehreren Versuchen nicht erreicht werden')


def _boundary_keys(kommune: Dict[str, Any]) -> List[str]:
    keys = []
    if kommune.get('ags'):
        keys.append(str(kommune.get('ags')))
    keys.append(kommune['name'])
    keys.append(f"{kommune['name']}|{kommune.get('lk','')}")
    return keys


def _read_boundary_from_cache(cache: Dict[str, Any], kommune: Dict[str, Any]) -> Tuple[List[List[Tuple[float,float]]], Dict[str, Any]]:
    for key in _boundary_keys(kommune):
        if key in cache and cache[key]:
            polys = [[(float(a),float(b)) for a,b in ring] for ring in cache[key].get("polygons", [])]
            if polys:
                return polys, {**cache[key].get("meta", {}), "cache": True, "cache_key": key}
    return [], {}


def _write_boundary_to_caches(kommune: Dict[str, Any], polys: List[List[Tuple[float,float]]], meta: Dict[str, Any]) -> None:
    local_cache = load_json(BOUNDARY_CACHE,{})
    shared_cache = load_json(SHARED_BOUNDARY_CACHE,{})
    payload={"meta":meta,"polygons":polys,"saved_at":datetime.now(timezone.utc).isoformat()}
    for key in _boundary_keys(kommune):
        local_cache[key]=payload
        shared_cache[key]=payload
    save_json(BOUNDARY_CACHE, local_cache)
    save_json(SHARED_BOUNDARY_CACHE, shared_cache)


def load_boundary(kommune: Dict[str, Any], force: bool=False) -> Tuple[List[List[Tuple[float,float]]], Dict[str, Any]]:
    if not force:
        for cache_path in [SHARED_BOUNDARY_CACHE, BOUNDARY_CACHE]:
            cache = load_json(cache_path, {})
            polys, meta = _read_boundary_from_cache(cache, kommune)
            if polys:
                return polys, meta
    q = f"{kommune['name']}, {kommune.get('lk','')}, Sachsen-Anhalt, Deutschland"
    params = {"q": q, "format": "jsonv2", "polygon_geojson": 1, "limit": 5, "addressdetails": 1, "countrycodes":"de"}
    try:
        r = nominatim_get_with_retry(params)
        hits = r.json()
        best = None
        for h in hits:
            typ = (h.get("type") or "").lower(); cls = (h.get("class") or "").lower(); display = (h.get("display_name") or "").lower()
            if h.get("geojson") and "sachsen-anhalt" in display and (cls == "boundary" or typ in {"administrative","city","town","village","municipality"}):
                best = h; break
        if best is None:
            for h in hits:
                if h.get("geojson"):
                    best = h; break
        if not best:
            return [], {"ok": False, "source": "nominatim", "error": "keine boundary mit polygon_geojson gefunden", "query": q}
        polys = extract_polygons(best["geojson"])
        meta = {"ok": bool(polys), "source": "nominatim_polygon_geojson", "display_name": best.get("display_name"), "osm_type": best.get("osm_type"), "osm_id": best.get("osm_id"), "query": q}
        if polys:
            _write_boundary_to_caches(kommune, polys, meta)
        return polys, meta
    except Exception as e:
        return [], {"ok": False, "source": "nominatim", "error": str(e), "query": q, "rate_limited": "429" in str(e)}

def build_category_query(kommune: Dict[str, Any], filters: List[Tuple[str,str]]) -> str:
    """
    V7.5 Fix: keine undefinierte make_area_header()-Logik mehr.
    Wir fragen OSM in einem ausreichend großen Radius um den Kommunenmittelpunkt ab
    und filtern danach streng per Point-in-Polygon gegen die echte Gemeindegrenze.
    Das ist für die TOP3-Demo stabiler als Overpass-area-Auflösung.
    """
    lat = float(kommune.get("lat"))
    lng = float(kommune.get("lng"))
    # 18 km reichen für Leuna/Querfurt/Bad Dürrenberg als Demo.
    # PiP entfernt danach Fremdpunkte außerhalb der Gemeinde.
    radius_m = int(kommune.get("overpass_radius_m") or 18000)
    body = []
    for flt, _label in filters:
        body += [
            f"node{flt}(around:{radius_m},{lat},{lng});",
            f"way{flt}(around:{radius_m},{lat},{lng});",
            f"relation{flt}(around:{radius_m},{lat},{lng});"
        ]
    return f"""[out:json][timeout:25];
(
  {' '.join(body)}
);
out center tags;
"""



def overpass_query(query: str) -> Dict[str, Any]:
    """Robuste Overpass-Abfrage mit mehreren Endpunkten.

    Fix v7.6: Die Funktion hatte in v7.5 gefehlt, dadurch wurden alle
    Sicht-2-Kategorien mit `name 'overpass_query' is not defined` abgebrochen.
    """
    last_err: Optional[Exception] = None
    headers = {"User-Agent": USER_AGENT}
    for idx, endpoint in enumerate(OVERPASS_ENDPOINTS, start=1):
        try:
            log(f"Overpass → {endpoint.replace('/api/interpreter','').replace('https://','')}")
            # POST ist stabiler für längere Queries; manche Instanzen bevorzugen data=...
            r = requests.post(endpoint, data={"data": query}, headers=headers, timeout=TIMEOUT)
            if r.status_code in {429, 502, 503, 504}:
                wait_s = min(10.0 * idx, 30.0)
                log(f"WARN: Overpass HTTP {r.status_code} – warte {wait_s:.1f}s")
                time.sleep(wait_s)
                last_err = requests.HTTPError(f"HTTP {r.status_code} from {endpoint}", response=r)
                continue
            r.raise_for_status()
            data = r.json()
            if not isinstance(data, dict):
                raise RuntimeError("Overpass Antwort ist kein JSON-Objekt")
            return data
        except Exception as e:
            last_err = e
            log(f"WARN: Overpass fehlgeschlagen: {e}")
            time.sleep(1.5 * idx)
            continue
    raise RuntimeError(f"Alle Overpass-Endpunkte fehlgeschlagen. Letzter Fehler: {last_err}")

def element_coord(el: Dict[str, Any]) -> Optional[Tuple[float,float]]:
    if "lat" in el and "lon" in el:
        return float(el["lat"]), float(el["lon"])
    c = el.get("center") or {}
    if "lat" in c and "lon" in c:
        return float(c["lat"]), float(c["lon"])
    return None


def poi_name(tags: Dict[str, Any], category_label: str, osm_type: str, osm_id: int) -> str:
    for k in ["name", "name:de", "official_name", "alt_name"]:
        v = tags.get(k)
        if v:
            return str(v)
    return f"{category_label} ({osm_type}/{osm_id})"


def evidence_from_osm_tags(tags: Dict[str, Any]) -> Tuple[int, List[str]]:
    evidence = []
    for key in ["image", "image:0", "image:1", "image:2", "wikimedia_commons", "wikipedia", "mapillary", "website", "contact:website", "url"]:
        if tags.get(key):
            evidence.append(f"OSM:{key}")
    # einzelne wikimedia_commons-Kategorie kann viele Bilder bedeuten, zählt hier aber nur als 1 Hinweis,
    # weil sie keine drei Tour-Aufnahmen beweist.
    return len(set(evidence)), sorted(set(evidence))


def normalize_candidates(raw_elements: Iterable[Dict[str, Any]], category_id: str, category_label: str, tag_match: str, polygons: List[List[Tuple[float,float]]]) -> List[Candidate]:
    out: List[Candidate] = []
    for el in raw_elements:
        coord = element_coord(el)
        if not coord:
            continue
        lat, lng = coord
        if not (47.0 <= lat <= 55.5 and 5.0 <= lng <= 16.0):
            continue
        if polygons and not point_in_polygons(lat, lng, polygons):
            continue
        tags = el.get("tags") or {}
        # Ohne Namen ist das i.d.R. kein sauberer virtueller Tour-Standort.
        if not any(tags.get(k) for k in ["name", "name:de", "official_name", "alt_name"]):
            continue
        osm_type = str(el.get("type") or "")
        osm_id = int(el.get("id") or 0)
        ev_count, ev = evidence_from_osm_tags(tags)
        out.append(Candidate(
            id=f"{osm_type}/{osm_id}", osm_type=osm_type, osm_id=osm_id,
            name=poi_name(tags, category_label, osm_type, osm_id), category=category_id,
            category_label=category_label, tag_match=tag_match, lat=lat, lng=lng,
            source="OpenStreetMap Overpass API", tags=tags,
            osm_evidence_count=ev_count, mapillary_image_count=None,
            verified_virtual_tour=False, verification_method="candidate_only", evidence=ev,
        ))
    return out


def dedupe_candidates(cands: List[Candidate]) -> List[Candidate]:
    seen_ids = set(); seen_soft = set(); out: List[Candidate] = []
    priority = {"museum":0, "attraction":1, "viewpoint":2, "monument":3, "memorial_named":4, "info_core":5}
    for p in sorted(cands, key=lambda x: (priority.get(x.category, 99), x.name)):
        if p.id in seen_ids:
            continue
        soft = (norm_key(p.name), round(p.lat, 5), round(p.lng, 5))
        if soft in seen_soft:
            continue
        seen_ids.add(p.id); seen_soft.add(soft); out.append(p)
    return out


def bbox_for_radius(lat: float, lng: float, radius_m: int) -> Tuple[float, float, float, float]:
    dlat = radius_m / 111320.0
    dlng = radius_m / (111320.0 * max(0.2, math.cos(math.radians(lat))))
    return (lng - dlng, lat - dlat, lng + dlng, lat + dlat)


def mapillary_count_images(lat: float, lng: float, token: str, radius_m: int = 90, limit: int = 10) -> Tuple[int, List[str]]:
    # Mapillary Graph API v4 images endpoint. Requires access token.
    # is_pano=true: nur echte 360°-Panoramen zählen (Definition laut Spezifikation:
    # "mindestens drei 360° Bilder miteinander zu einer Tour verbunden" — eine
    # normale Flachaufnahme zählt NICHT als 360°-Bild).
    west, south, east, north = bbox_for_radius(lat, lng, radius_m)
    params = {
        "access_token": token,
        "fields": "id,computed_geometry,captured_at,is_pano,thumb_256_url",
        "bbox": f"{west},{south},{east},{north}",
        "is_pano": "true",
        "limit": limit,
    }
    r = requests.get(MAPILLARY_IMAGES_URL, params=params, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
    r.raise_for_status()
    data = r.json()
    ids = []
    for item in data.get("data", []):
        if not item.get("is_pano"):
            continue  # serverseitiger Filter sollte das bereits ausschließen, sicherheitshalber doppelt prüfen
        iid = item.get("id")
        if iid:
            ids.append(str(iid))
    return len(set(ids)), ids[:5]


def verify_virtual_tours(cands: List[Candidate], token: Optional[str], min_images: int, radius_m: int, allow_osm_evidence: bool, debug: bool=False) -> Tuple[List[Candidate], List[Dict[str,str]]]:
    errors: List[Dict[str,str]] = []
    if not token and not allow_osm_evidence:
        return cands, errors
    for idx, c in enumerate(cands, start=1):
        if token:
            try:
                count, image_ids = mapillary_count_images(c.lat, c.lng, token, radius_m=radius_m)
                c.mapillary_image_count = count
                if count >= min_images:
                    c.verified_virtual_tour = True
                    c.verification_method = "mapillary_min_3_pano_images"
                    c.evidence = (c.evidence or []) + [f"Mapillary:{iid}" for iid in image_ids[:min_images]]
                else:
                    c.verification_method = "mapillary_less_than_3_pano_images"
                if debug:
                    log(f"  Mapillary {idx}/{len(cands)}: {c.name} → {count} 360°-Aufnahme(n)")
                time.sleep(0.15)
                continue
            except Exception as e:
                errors.append({"candidate": c.name, "error": str(e)})
                c.verification_method = "mapillary_error"
        if allow_osm_evidence and c.osm_evidence_count >= min_images:
            c.verified_virtual_tour = True
            c.verification_method = "osm_evidence_min_3_tags"
    return cands, errors


def benchmark_count_for(kommune: Dict[str, Any]) -> Optional[int]:
    name = kommune["name"]
    if name in BENCHMARK_COUNTS:
        return BENCHMARK_COUNTS[name]
    val = BENCHMARK_PRO_TAUSEND.get(name)
    if val is None:
        return None
    return int(round(val * kommune["ew"] / 1000.0))


def status_for(verified_count: int, candidate_count: int, bench_count: Optional[int], boundary_ok: bool, verification_available: bool, category_errors: List[Dict[str, str]]) -> Tuple[str, str, Optional[float]]:
    if not boundary_ok:
        return "benchmark", "Keine echte Gemeindegrenze; Live-Zählung gestoppt", None
    if not verification_available:
        return "benchmark", f"OSM liefert {candidate_count} Kandidaten, aber keine 3-Aufnahmen-Prüfung verfügbar; Benchmark anzeigen", None
    if bench_count is None:
        if verified_count > 0:
            return "api_live", f"{verified_count} verifizierte virtuelle Tour(en); kein Benchmark-Vergleich vorhanden", None
        return "benchmark", "Keine verifizierten Touren und kein Benchmark vorhanden", None
    if bench_count <= 0:
        if verified_count > 0:
            return "pruefen", f"API findet {verified_count} verifizierte Tour(en), Benchmark war 0; manuell prüfen", None
        return "benchmark", "API und Benchmark ohne Treffer", 1.0
    ratio = verified_count / bench_count
    suffix = f"; {len(category_errors)} Kategorie(n) mit Timeout/Fehler" if category_errors else ""
    if ratio > 2.0:
        return "api_live_pruefen", f"API deutlich über Benchmark ({ratio:.0%}); Übererfassung prüfen{suffix}", ratio
    if ratio >= 0.80:
        return "api_live", f"API vollständig genug ({ratio:.0%}); verifizierte Touren können Benchmark ersetzen{suffix}", ratio
    if ratio >= 0.40:
        return "gemischt", f"API teilweise ({ratio:.0%}); API + Benchmark gemeinsam anzeigen{suffix}", ratio
    return "benchmark", f"API unvollständig ({ratio:.0%}); Benchmark anzeigen, API als Hinweis{suffix}", ratio


def sync_kommune(kommune: Dict[str, Any], force_boundary: bool=False, debug: bool=False, mapillary_token: Optional[str]=None, min_images: int=3, radius_m: int=90, allow_osm_evidence: bool=False) -> Dict[str, Any]:
    name = kommune["name"]
    log(f"{name}: Grenze laden")
    polygons, bmeta = load_boundary(kommune, force=force_boundary)
    boundary_ok = bool(polygons)
    if not boundary_ok:
        return build_result(kommune, [], False, bmeta, [{"category":"boundary", "label":"Gemeindegrenze", "error":"keine_boundary"}], [], False)

    all_cands: List[Candidate] = []
    category_errors: List[Dict[str, str]] = []
    for cat in POI_CATEGORIES:
        try:
            log(f"{name}: OSM Kandidaten · {cat['label']}")
            q = build_category_query(kommune, cat["filters"])
            data = overpass_query(q)
            raw = data.get("elements") or []
            if debug:
                log(f"  Roh: {len(raw)} Elemente")
            label = cat["filters"][0][1] if cat.get("filters") else cat["id"]
            subset = normalize_candidates(raw, cat["id"], cat["label"], label, polygons)
            all_cands.extend(subset)
            time.sleep(0.25)
        except Exception as e:
            err = str(e)
            category_errors.append({"category": cat["id"], "label": cat["label"], "error": err})
            log(f"WARN {name}/{cat['id']}: {err}")
            continue
    candidates = dedupe_candidates(all_cands)
    verification_available = bool(mapillary_token) or allow_osm_evidence
    if mapillary_token:
        log(f"{name}: Mapillary-Prüfung ≥{min_images} 360°-Aufnahmen je Standort")
    elif allow_osm_evidence:
        log(f"{name}: OSM-Evidence-Prüfung ≥{min_images} Hinweise je Standort")
    else:
        log(f"{name}: Keine Bild-API aktiv; OSM bleibt Kandidatenliste, Benchmark bleibt maßgeblich")
    candidates, verification_errors = verify_virtual_tours(candidates, mapillary_token, min_images, radius_m, allow_osm_evidence, debug=debug)
    return build_result(kommune, candidates, boundary_ok, bmeta, category_errors, verification_errors, verification_available)


def build_result(kommune: Dict[str, Any], candidates: List[Candidate], boundary_ok: bool, boundary_meta: Dict[str, Any], category_errors: List[Dict[str, str]], verification_errors: List[Dict[str,str]], verification_available: bool) -> Dict[str, Any]:
    bench_count = benchmark_count_for(kommune)
    bench_per1000 = BENCHMARK_PRO_TAUSEND.get(kommune["name"])
    candidate_count = len(candidates) if boundary_ok else 0
    verified = [c for c in candidates if c.verified_virtual_tour]
    verified_count = len(verified) if boundary_ok else 0
    verified_per1000 = round(verified_count / (kommune["ew"] / 1000.0), 3) if kommune.get("ew") else None
    status, msg, ratio = status_for(verified_count, candidate_count, bench_count, boundary_ok, verification_available, category_errors)
    cats: Dict[str, int] = {}
    verified_cats: Dict[str, int] = {}
    for p in candidates:
        cats[p.category_label] = cats.get(p.category_label, 0) + 1
        if p.verified_virtual_tour:
            verified_cats[p.category_label] = verified_cats.get(p.category_label, 0) + 1
    return {
        "kommune": kommune["name"], "lk": kommune.get("lk"), "ags": kommune.get("ags"), "einwohner": kommune.get("ew"),
        "status": status, "status_message": msg, "boundary_ok": boundary_ok, "boundary_source": boundary_meta.get("source"),
        "verification_available": verification_available,
        "virtual_tour_definition": "Ein Standort zählt nur als virtuelle Tour, wenn mindestens 3 unterschiedliche Aufnahmen/Blickpunkte nachweisbar sind.",
        "candidate_count": candidate_count,
        "verified_tour_count": verified_count,
        "api_count": verified_count,
        "api_pois_pro_1000_ew": verified_per1000,
        "benchmark_count": bench_count, "benchmark_pois_pro_1000_ew": bench_per1000, "quality_ratio": ratio,
        "categories_candidates": cats,
        "categories_verified": verified_cats,
        "category_errors": category_errors, "partial_error_count": len(category_errors),
        "verification_errors": verification_errors[:25], "verification_error_count": len(verification_errors),
        "points": [asdict(p) for p in verified],
        "candidates": [asdict(p) for p in candidates],
    }


def push_to_supabase(results: List[Dict[str, Any]]) -> None:
    """Schreibt die Sicht-2-Ergebnisse für die 3 Pilotkommunen nach Supabase:
    - 'benchmark': verifizierte Touren pro 1000 EW (quelle_typ='automatisch')
    - 'touren_punkte': jeder einzelne Kandidat/verifizierte Standort, für die Karte
    Bestehende manuelle Zeilen bleiben unverändert.
    """
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        log("Supabase nicht konfiguriert (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY fehlen) — kein Push.")
        return
    if create_client is None:
        log("Python-Paket 'supabase' nicht installiert — kein Push. (pip install supabase)")
        return

    sb = create_client(url, key)
    jahr = datetime.now().year

    for res in results:
        name = res.get("kommune")
        kommune_id = KOMMUNE_IDS.get(name)
        if kommune_id is None:
            continue  # nicht eine unserer 3 Pilotkommunen

        per1000 = res.get("api_pois_pro_1000_ew")
        if per1000 is None:
            log(f"  ⚠ {name}: kein Live-Wert (Status={res.get('status')}) — überspringe Benchmark-Push")
        else:
            try:
                sb.table("benchmark").upsert({
                    "kommune_id": kommune_id,
                    "sicht_nr": 2,
                    "kennzahl": "Anzahl Touren pro Tsd. Einwohner",
                    "wert_num": per1000,
                    "score_normiert": None,
                    "erhebungsjahr": jahr,
                    "quelle": "OpenStreetMap Overpass API + Mapillary (≥3 echte 360°-Aufnahmen je Standort)",
                    "quelle_typ": "automatisch",
                    "letzter_abruf": datetime.now(timezone.utc).isoformat(),
                }, on_conflict="kommune_id,sicht_nr,kennzahl,erhebungsjahr").execute()
                log(f"  ✓ {name}: {per1000} Touren/1000 EW → Supabase")
            except Exception as e:
                log(f"  ✗ {name}: Supabase-Fehler (benchmark): {e}")

        candidates = res.get("candidates", [])
        try:
            sb.table("touren_punkte").delete().eq("kommune_id", kommune_id).eq("erhebungsjahr", jahr).execute()
        except Exception as e:
            log(f"  ⚠ {name}: Löschen alter touren_punkte fehlgeschlagen: {e}")

        if not candidates:
            continue

        rows = [{
            "kommune_id": kommune_id,
            "osm_type": c.get("osm_type"),
            "osm_id": c.get("osm_id"),
            "name": c.get("name") or None,
            "category": c.get("category"),
            "category_label": c.get("category_label"),
            "lat": c.get("lat"),
            "lng": c.get("lng"),
            "verified": bool(c.get("verified_virtual_tour")),
            "verification_method": c.get("verification_method"),
            "mapillary_image_count": c.get("mapillary_image_count"),
            "erhebungsjahr": jahr,
        } for c in candidates]

        batch_size = 500
        gespeichert = 0
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            try:
                sb.table("touren_punkte").insert(batch).execute()
                gespeichert += len(batch)
            except Exception as e:
                log(f"  ✗ {name}: Fehler beim Speichern von touren_punkte (Batch {i}): {e}")
        log(f"  {name}: {gespeichert}/{len(rows)} Tour-Kandidaten gespeichert")


def main() -> int:
    global KOMMUNEN, BENCHMARK_PRO_TAUSEND, BENCHMARK_COUNTS
    ap = argparse.ArgumentParser(description="KommunalSpiegel Sicht 2: Virtuelle Touren mit Mindest-3-Aufnahmen-Regel")
    ap.add_argument("--seed", default="data/kommunen_seed.json", help="zentrale Kommunen-/Benchmark-Datei")
    ap.add_argument("--kommune", action="append", help="Kommune, mehrfach möglich. Ohne Angabe: Leuna")
    ap.add_argument("--alle", action="store_true", help="alle Projektkommunen synchronisieren")
    ap.add_argument("--out", default=str(OUT_FILE), help="Ausgabe-JSON")
    ap.add_argument("--force-boundary", action="store_true", help="Grenzcache neu laden")
    ap.add_argument("--debug", action="store_true", help="mehr Ausgaben")
    ap.add_argument("--mapillary-token", default=os.getenv("MAPILLARY_TOKEN"), help="Mapillary Access Token für Bildprüfung; alternativ ENV MAPILLARY_TOKEN")
    ap.add_argument("--min-images", type=int, default=3, help="Mindestanzahl Aufnahmen je Tour-Standort")
    ap.add_argument("--radius-m", type=int, default=90, help="Suchradius für Aufnahmen um Kandidaten")
    ap.add_argument("--allow-osm-evidence", action="store_true", help="OSM-Bild-/Web-Tags als Ersatz-Evidence zulassen, falls kein Mapillary-Token vorhanden")
    args = ap.parse_args()

    DATA_DIR.mkdir(exist_ok=True); CACHE_DIR.mkdir(parents=True, exist_ok=True)
    seed = load_seed(args.seed);
    if seed:
        loaded_kommunen = seed_kommunen(seed)
        loaded_pro, loaded_counts = seed_benchmark_s2(seed)
        if loaded_kommunen: KOMMUNEN = loaded_kommunen
        if loaded_pro is not None: BENCHMARK_PRO_TAUSEND = loaded_pro
        if loaded_counts is not None: BENCHMARK_COUNTS = loaded_counts
        log(f"Seed geladen: {len(KOMMUNEN)} Kommunen aus {args.seed}")
    targets = KOMMUNEN if args.alle else []
    if not args.alle:
        for n in (args.kommune or ["Leuna"]):
            k = kommune_by_name(n)
            if not k:
                raise SystemExit(f"Kommune nicht gefunden: {n}")
            targets.append(k)

    log(f"KommunalSpiegel Sicht 2 · Backend v{VERSION}")
    log(f"Ziel: {len(targets)} Kommune(n)")
    log("-"*72)

    results = []
    api_status = "ok"
    for k in targets:
        try:
            res = sync_kommune(k, force_boundary=args.force_boundary, debug=args.debug, mapillary_token=args.mapillary_token, min_images=args.min_images, radius_m=args.radius_m, allow_osm_evidence=args.allow_osm_evidence)
            results.append(res)
            log(f"{k['name']}: status={res['status']} | boundary={res['boundary_ok']} | Kandidaten={res['candidate_count']} | Touren={res['verified_tour_count']} | Benchmark={res['benchmark_count']} | {res['status_message']}")
        except Exception as e:
            api_status = "teilweise_fehler"
            log(f"FEHLER {k['name']}: {e}")
            results.append(build_result(k, [], False, {"source":"error"}, [{"category":"run", "label":"Run", "error":str(e)}], [], False))

    out = {
        "schema": SCHEMA,
        "version": VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "OpenStreetMap Overpass API + optionale Mapillary API",
        "api_status": api_status,
        "method": "Benchmark → OSM-Kandidaten → Gemeindegrenze → Point-in-Polygon → Mindest-3-Aufnahmen-Prüfung → Benchmark-Vergleich",
        "status_rules": {
            "definition": "Gezählt wird nur eine virtuelle Tour mit mindestens 3 unterschiedlichen Aufnahmen/Blickpunkten.",
            ">=80% and <=200%": "api_live",
            ">200%": "api_live_pruefen",
            "40-79%": "gemischt",
            "<40%": "benchmark",
            "no_image_verification": "benchmark; OSM-Kandidaten nur als Hinweis",
        },
        "kommunen": results,
    }
    save_json(Path(args.out), out)
    log(f"✓ geschrieben: {args.out}")

    log("-"*72)
    log("[Supabase] Push der Sicht-2-Ergebnisse für die 3 Pilotkommunen …")
    push_to_supabase(results)

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
