"""
sync_sicht6_mobilfunk.py - KommunalSpiegel Sicht 6
Mobilfunkabdeckung, automatisiert über das amtliche BNetzA Mobilfunk-Monitoring
(WMS-Dienst, gehostet vom BKG: https://sgx.geodatenzentrum.de/wms_bnetza_mobilfunk).

Methode (Analog zum Poster, aber automatisiert statt cellmapper-Handauswertung):
1. 500-m-Raster über die echte Gemeindegrenze legen (wie beim Poster: ein
   Messpunkt je Quadrat, hier: Zentrum jedes Rasterquadrats).
2. Für jeden Punkt per WMS GetFeatureInfo (1x1-Pixel-Anfrage) abfragen, ob die
   Zelle in der jeweiligen Technologie (5G / 4G / 2G) abgedeckt ist.
3. Je Punkt die beste verfügbare Technologie nehmen → eine der 4 Klassen
   (Stark/Gut-mittel/Schwach/Keine Angabe), exakt wie auf dem Poster.
4. Kennzahl = Mittelwert über alle Messpunkte (Anteil der Fläche je Klasse,
   bzw. % der Fläche mit ≥4G).

Ehrlicher Hinweis (gehört in die Erläuterungen/Beobachtungen):
Die amtliche Quelle liefert "abgedeckt/nicht abgedeckt" je Technologie und ist
anbieterneutral (sie sagt nicht WELCHER Betreiber). Echte dBm-Werte je
Netzbetreiber – wie im Poster per cellmapper händisch erhoben – sind über keine
offizielle, automatisierbare Schnittstelle verfügbar; dafür verlinkt das
Dashboard direkt auf cellmapper je Betreiber (siehe index.html Sicht 6).
"""

import os
import sys
import time
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '') or os.environ.get('SUPABASE_SERVICE_KEY', '')

WMS_BASE = 'https://sgx.geodatenzentrum.de/wms_bnetza_mobilfunk'
WMS_LAYERS = {'2G': 'gsm', '4G': 'lte', '5G': '5g'}
GRID_STEP_M = 500.0
USER_AGENT = 'KommunalSpiegel-Hochschule-Merseburg/1.0'
TIMEOUT = 30
NOMINATIM_DELAY = 1.1

GEO_CACHE = Path(__file__).parent / 'data' / 'cache' / 'geo_boundaries_sicht6.json'

COMMUNES = [
    {'name': 'Leuna',          'kommune_id': 1, 'ags': '15083090', 'lat': 51.3286, 'lng': 12.0032, 'lk': 'Saalekreis'},
    {'name': 'Querfurt',       'kommune_id': 2, 'ags': '15083260', 'lat': 51.3803, 'lng': 11.5897, 'lk': 'Saalekreis'},
    {'name': 'Bad Dürrenberg', 'kommune_id': 3, 'ags': '15083020', 'lat': 51.2965, 'lng': 12.0645, 'lk': 'Saalekreis'},
]

KLASSEN = [
    {'label': 'Stark',        'dbm': '−40 bis −95 dBm',   'color': '#349a2c', 'min_tech': '5G'},
    {'label': 'Gut/mittel',   'dbm': '−96 bis −115 dBm',  'color': '#344a2c', 'min_tech': '4G'},
    {'label': 'Schwach',      'dbm': '−116 bis −140 dBm', 'color': '#e31a1c', 'min_tech': '2G'},
    {'label': 'Keine Angabe', 'dbm': '—',                 'color': '#ffffff', 'min_tech': None},
]


def log_step(msg: str) -> None:
    log.info(msg)


# ── Gemeindegrenze laden (wiederverwendete, bewährte Logik aus sync_sicht4.py) ──

def normalize_geojson(obj: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not obj:
        return None
    if obj.get('type') == 'FeatureCollection':
        feats = obj.get('features') or []
        if feats:
            return normalize_geojson(feats[0])
    if obj.get('type') == 'Feature':
        return normalize_geojson(obj.get('geometry'))
    if obj.get('type') in {'Polygon', 'MultiPolygon'}:
        return {'type': obj['type'], 'coordinates': obj['coordinates']}
    return None


def geom_bbox(geom: Dict[str, Any]) -> List[float]:
    xs, ys = [], []
    def walk(c):
        if isinstance(c, list) and c and isinstance(c[0], (int, float)):
            xs.append(float(c[0])); ys.append(float(c[1]))
        elif isinstance(c, list):
            for x in c:
                walk(x)
    walk(geom.get('coordinates', []))
    return [min(xs), min(ys), max(xs), max(ys)] if xs and ys else [0, 0, 0, 0]


def bbox_contains(bbox: List[float], lng: float, lat: float, pad: float = 0.0) -> bool:
    w, s, e, n = bbox
    return w - pad <= lng <= e + pad and s - pad <= lat <= n + pad


def point_in_ring(lng: float, lat: float, ring: List[List[float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat):
            xint = (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
            if lng < xint:
                inside = not inside
        j = i
    return inside


def point_in_polygon(lng: float, lat: float, poly: List[Any]) -> bool:
    return bool(poly) and point_in_ring(lng, lat, poly[0]) and not any(point_in_ring(lng, lat, h) for h in poly[1:])


def point_in_geom(lng: float, lat: float, geo: Dict[str, Any]) -> bool:
    if geo['type'] == 'Polygon':
        return point_in_polygon(lng, lat, geo['coordinates'])
    return any(point_in_polygon(lng, lat, poly) for poly in geo['coordinates'])


def load_geo_cache() -> Dict[str, Any]:
    if GEO_CACHE.exists():
        try:
            return json.loads(GEO_CACHE.read_text(encoding='utf-8'))
        except Exception:
            return {}
    return {}


def save_geo_cache(cache: Dict[str, Any]) -> None:
    GEO_CACHE.parent.mkdir(parents=True, exist_ok=True)
    GEO_CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding='utf-8')


def fetch_boundary_overpass_ags(ags: str) -> Optional[Dict[str, Any]]:
    if not ags:
        return None
    q = f'''[out:json][timeout:60];
relation["boundary"="administrative"]["admin_level"="8"]["de:amtlicher_gemeindeschluessel"="{ags}"];
out tags;'''
    r = requests.post('https://overpass-api.de/api/interpreter', data={'data': q}, headers={'User-Agent': USER_AGENT}, timeout=TIMEOUT)
    r.raise_for_status()
    data = r.json()
    rels = [e for e in data.get('elements', []) if e.get('type') == 'relation' and e.get('id')]
    if not rels:
        return None
    rel_id = rels[0]['id']
    time.sleep(NOMINATIM_DELAY)
    lookup = requests.get('https://nominatim.openstreetmap.org/lookup',
                           params={'format': 'jsonv2', 'polygon_geojson': 1, 'osm_ids': f'R{rel_id}'},
                           headers={'User-Agent': USER_AGENT}, timeout=TIMEOUT)
    lookup.raise_for_status()
    items = lookup.json()
    if not items:
        return None
    geo = normalize_geojson(items[0].get('geojson'))
    if not geo:
        return None
    return {'geometry': geo, 'bbox': geom_bbox(geo), 'source': 'OSM Relation via Overpass AGS + Nominatim',
            'display_name': items[0].get('display_name')}


def fetch_boundary_nominatim(k: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    queries = []
    if k.get('ags'):
        queries.append(k['ags'])
    queries += [f'{k["name"]}, {k.get("lk", "")}, Sachsen-Anhalt, Deutschland',
                f'Stadt {k["name"]}, Sachsen-Anhalt, Deutschland', f'{k["name"]}, Sachsen-Anhalt']
    for q in queries:
        r = requests.get('https://nominatim.openstreetmap.org/search',
                          params={'format': 'jsonv2', 'polygon_geojson': 1, 'addressdetails': 1, 'limit': 10, 'q': q, 'countrycodes': 'de'},
                          headers={'User-Agent': USER_AGENT}, timeout=TIMEOUT)
        r.raise_for_status()
        items = r.json()
        for item in items:
            addr = item.get('address') or {}
            if addr.get('country_code') != 'de':
                continue
            geo = normalize_geojson(item.get('geojson'))
            if not geo:
                continue
            bb = geom_bbox(geo)
            if bbox_contains(bb, k['lng'], k['lat'], pad=0.02):
                return {'geometry': geo, 'bbox': bb, 'source': 'Nominatim OSM Polygon', 'display_name': item.get('display_name')}
        time.sleep(NOMINATIM_DELAY)
    return None


def fetch_boundary(k: Dict[str, Any], cache: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    key = f'{k["name"]}|{k.get("ags", "")}'
    if key in cache and cache[key]:
        return cache[key]
    log_step(f"{k['name']}: Gemeindegrenze laden …")
    try:
        res = fetch_boundary_overpass_ags(k.get('ags')) if k.get('ags') else None
        if res and bbox_contains(res['bbox'], k['lng'], k['lat'], pad=0.02):
            cache[key] = res; save_geo_cache(cache)
            log_step(f"  ✓ Grenze via AGS/OSM: {res.get('display_name')}")
            return res
    except Exception as e:
        log_step(f"  WARN Overpass/AGS: {e}")
    try:
        res = fetch_boundary_nominatim(k)
        if res:
            cache[key] = res; save_geo_cache(cache)
            log_step(f"  ✓ Grenze via Nominatim: {res.get('display_name')}")
            return res
    except Exception as e:
        log_step(f"  WARN Nominatim: {e}")
    cache[key] = None; save_geo_cache(cache)
    log_step('  ✗ keine belastbare Gemeindegrenze')
    return None


# ── 500-m-Raster erzeugen (innerhalb der echten Gemeindegrenze) ──

def lonlat_to_webmercator(lng: float, lat: float) -> Tuple[float, float]:
    import math
    R = 6378137.0
    x = R * math.radians(lng)
    y = R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def webmercator_to_lonlat(x: float, y: float) -> Tuple[float, float]:
    import math
    R = 6378137.0
    lng = math.degrees(x / R)
    lat = math.degrees(2 * math.atan(math.exp(y / R)) - math.pi / 2)
    return lng, lat


# ── Einmaliges Karten-Bild abrufen und Pixel auswerten (statt tausender ──
# ── Einzelabfragen) — schneller und zuverlässiger als GetFeatureInfo,    ──
# ── das laut OGC-Spezifikation auch das NÄCHSTGELEGENE Feature liefern   ──
# ── kann, selbst wenn der angefragte Punkt außerhalb davon liegt.        ──

IMG_SIZE = 1024  # Pixel je Seite; bei einer Kommune von ~6-8 km Breite
                 # entspricht das einer Auflösung von ~6-8 m/Pixel, fein
                 # genug für das amtliche 100-m-Raster.

# Echte, per Legende bestätigte "abgedeckt"-Farben je Layer (RGB).
# Wichtig: jeder Layer hat eine eigene, unterschiedliche Farbe — eine
# einheitliche "grün=abgedeckt"-Annahme war falsch und führte zu 0% bei
# gsm und 5g. Diese Werte stammen direkt aus GetLegendGraphic-Antworten.
COVERED_COLOR_BY_LAYER = {
    'gsm': (32, 55, 100),     # 2G: dunkles Marineblau
    'lte': (102, 153, 255),   # 4G: helles Blau
    '5g': (255, 130, 0),      # 5G: Orange (5G Standalone-Bereich)
}
COLOR_TOLERANCE = 60  # Toleranz je Kanal für Anti-Aliasing/Kompression


def classify_pixel(rgba: Tuple[int, int, int, int], layer: str) -> Optional[str]:
    r, g, b, a = rgba
    if a < 10:
        return None  # transparent → außerhalb der erfassten Fläche / keine Angabe
    if (r, g, b) == (255, 255, 255):
        return None  # reines Weiß = Hintergrund/keine Angabe, nicht "nicht abgedeckt"
    target = COVERED_COLOR_BY_LAYER.get(layer)
    if target is None:
        return None
    tr, tg, tb = target
    if abs(r - tr) <= COLOR_TOLERANCE and abs(g - tg) <= COLOR_TOLERANCE and abs(b - tb) <= COLOR_TOLERANCE:
        return 'covered'
    return 'not_covered'


def fetch_coverage_image(boundary: Dict[str, Any], layer: str) -> Optional[Tuple[Any, List[float]]]:
    """Holt ein einziges GetMap-Bild für die gesamte BBOX der Kommune und
    liefert (PIL.Image, bbox_3857) zurück."""
    from PIL import Image
    import io

    w, s, e, n = boundary['bbox']
    x0, y0 = lonlat_to_webmercator(w, s)
    x1, y1 = lonlat_to_webmercator(e, n)
    # Etwas Rand (10%) hinzufügen, damit Randpixel der Kommune nicht abgeschnitten werden.
    pad_x = (x1 - x0) * 0.1
    pad_y = (y1 - y0) * 0.1
    bbox3857 = [x0 - pad_x, y0 - pad_y, x1 + pad_x, y1 + pad_y]

    params = {
        'SERVICE': 'WMS', 'VERSION': '1.3.0', 'REQUEST': 'GetMap',
        'LAYERS': layer, 'CRS': 'EPSG:3857',
        'BBOX': ','.join(str(v) for v in bbox3857),
        'WIDTH': IMG_SIZE, 'HEIGHT': IMG_SIZE,
        'FORMAT': 'image/png', 'TRANSPARENT': 'true',
    }
    try:
        r = requests.get(WMS_BASE, params=params, headers={'User-Agent': USER_AGENT}, timeout=60)
        if r.status_code != 200 or 'image' not in r.headers.get('Content-Type', ''):
            log_step(f"  WARN GetMap fehlgeschlagen: HTTP {r.status_code}, Content-Type={r.headers.get('Content-Type')}")
            return None
        img = Image.open(io.BytesIO(r.content)).convert('RGBA')
        return img, bbox3857
    except Exception as e:
        log_step(f"  WARN GetMap-Fehler: {e}")
        return None


def analyze_coverage_image(img: Any, bbox3857: List[float], boundary: Dict[str, Any], layer: str) -> Tuple[int, int, int]:
    """Zählt Pixel innerhalb der echten Gemeindegrenze (Punkt-in-Polygon je
    Pixelzentrum) als covered / not_covered / unbekannt.
    Gibt (n_covered, n_not_covered, n_total_in_boundary) zurück."""
    px = img.load()
    width, height = img.size
    x0, y0, x1, y1 = bbox3857
    span_x = x1 - x0
    span_y = y1 - y0

    # Stichprobenraster über die Pixel, um Rechenzeit zu sparen: bei 1024x1024
    # jeden Pixel zu prüfen ist unnötig fein; wir nehmen jeden 4. Pixel
    # (entspricht weiterhin ca. 25-30 m Auflösung — feiner als die 100-m-Zellen).
    step = 4
    n_covered = 0
    n_not_covered = 0
    n_total = 0

    for py in range(0, height, step):
        # Web-Mercator-Y läuft umgekehrt zur Bild-Pixel-Y-Achse (Bild: oben=0, Mercator: oben=max-Y)
        merc_y = y1 - (py / height) * span_y
        for pxi in range(0, width, step):
            merc_x = x0 + (pxi / width) * span_x
            lng, lat = webmercator_to_lonlat(merc_x, merc_y)
            if not point_in_geom(lng, lat, boundary['geometry']):
                continue
            n_total += 1
            cls = classify_pixel(px[pxi, py], layer)
            if cls == 'covered':
                n_covered += 1
            elif cls == 'not_covered':
                n_not_covered += 1
            # cls is None → weder klar gruen noch klar rot, wird nicht gezaehlt
            # (z. B. Grenzlinien, Beschriftungen) - faellt unter "unbekannt"

    return n_covered, n_not_covered, n_total


# ── Hauptablauf je Kommune ──

def process_commune(k: Dict[str, Any], cache: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    name = k['name']
    boundary = fetch_boundary(k, cache)
    if not boundary:
        log_step(f"{name}: keine Gemeindegrenze — überspringe")
        return None

    pct_by_tech: Dict[str, float] = {}
    counts_by_tech: Dict[str, Tuple[int, int, int]] = {}

    for tech in ('5G', '4G', '2G'):
        layer = WMS_LAYERS[tech]
        log_step(f"{name}: lade Kartenbild für {tech} ({layer}) …")
        result = fetch_coverage_image(boundary, layer)
        if not result:
            pct_by_tech[tech] = 0.0
            continue
        img, bbox3857 = result
        n_cov, n_notcov, n_total = analyze_coverage_image(img, bbox3857, boundary, layer)
        counts_by_tech[tech] = (n_cov, n_notcov, n_total)
        pct = round(n_cov / n_total * 100, 1) if n_total else 0.0
        pct_by_tech[tech] = pct
        log_step(f"{name}: {tech} → {n_cov}/{n_total} Pixel abgedeckt ({pct}%)")
        time.sleep(1)  # Server schonen zwischen den 3 Anfragen

    pct_5g = pct_by_tech.get('5G', 0.0)
    pct_4g = pct_by_tech.get('4G', 0.0)
    pct_2g = pct_by_tech.get('2G', 0.0)
    # "mindestens diese Technologie" ist nicht exakt aus Einzelwerten ableitbar,
    # da die Schichten unabhängig voneinander gerendert werden — als Näherung
    # wird der Maximalwert der drei als "≥2G" verwendet (jede Abdeckung zählt),
    # und "≥4G" als Maximum aus 4G und 5G.
    pct_4g_plus = max(pct_4g, pct_5g)
    pct_2g_plus = max(pct_2g, pct_4g, pct_5g)
    pct_keine = round(100 - pct_2g_plus, 1)

    log_step(f"{name}: 5G={pct_5g}% · ≥4G={pct_4g_plus}% · ≥2G={pct_2g_plus}% · keine Angabe={pct_keine}%")

    return {
        'kommune': name, 'kommune_id': k['kommune_id'],
        'pct_5g': pct_5g, 'pct_4g_plus': pct_4g_plus,
        'pct_2g_plus': pct_2g_plus, 'pct_keine_angabe': pct_keine,
        'punkte': [],  # keine Einzelpunkte mehr in diesem Ansatz — Flächenanteil aus Pixelanalyse
    }


def push_to_supabase(all_results: List[Dict[str, Any]]) -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        log_step('Supabase nicht konfiguriert (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY fehlen) — kein Push.')
        return
    try:
        from supabase import create_client
    except ImportError:
        log_step("Python-Paket 'supabase' nicht installiert — kein Push. (pip install supabase)")
        return

    base_url = SUPABASE_URL.split('/rest/')[0] if '/rest/' in SUPABASE_URL else SUPABASE_URL
    sb = create_client(base_url, SUPABASE_KEY)
    jahr = datetime.now().year

    for res in all_results:
        name = res['kommune']
        kommune_id = res['kommune_id']

        try:
            sb.table('benchmark').upsert({
                'kommune_id': kommune_id, 'sicht_nr': 6,
                'kennzahl': 'Mobilfunk Anteil Fläche ≥4G (%)',
                'wert_num': res['pct_4g_plus'], 'score_normiert': None,
                'erhebungsjahr': jahr,
                'quelle': 'BNetzA Mobilfunk-Monitoring (WMS, BKG-gehostet, anbieterneutral)',
                'quelle_typ': 'automatisch',
                'letzter_abruf': datetime.now(timezone.utc).isoformat(),
            }, on_conflict='kommune_id,sicht_nr,kennzahl,erhebungsjahr').execute()

            sb.table('benchmark').upsert({
                'kommune_id': kommune_id, 'sicht_nr': 6,
                'kennzahl': 'Mobilfunk Anteil Fläche 5G (%)',
                'wert_num': res['pct_5g'], 'score_normiert': None,
                'erhebungsjahr': jahr,
                'quelle': 'BNetzA Mobilfunk-Monitoring (WMS, BKG-gehostet, anbieterneutral)',
                'quelle_typ': 'automatisch',
                'letzter_abruf': datetime.now(timezone.utc).isoformat(),
            }, on_conflict='kommune_id,sicht_nr,kennzahl,erhebungsjahr').execute()

            log_step(f"  ✓ {name}: ≥4G={res['pct_4g_plus']}%, 5G={res['pct_5g']}% → Supabase (benchmark)")
        except Exception as e:
            log_step(f"  ✗ {name}: Supabase-Fehler (benchmark): {e}")

        try:
            sb.table('mobilfunk_raster').delete().eq('kommune_id', kommune_id).eq('erhebungsjahr', jahr).execute()
        except Exception as e:
            log_step(f"  ⚠ {name}: Löschen alter mobilfunk_raster fehlgeschlagen: {e}")

        punkte = res.get('punkte', [])
        if not punkte:
            continue
        rows = [{
            'kommune_id': kommune_id, 'lat': p['lat'], 'lng': p['lng'],
            'technologie': p['tech'], 'klasse': p['klasse'], 'erhebungsjahr': jahr,
        } for p in punkte]
        batch_size = 500
        gespeichert = 0
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            try:
                sb.table('mobilfunk_raster').insert(batch).execute()
                gespeichert += len(batch)
            except Exception as e:
                log_step(f"  ✗ {name}: Fehler beim Speichern von mobilfunk_raster (Batch {i}): {e}")
        log_step(f"  {name}: {gespeichert}/{len(rows)} Rasterpunkte gespeichert")


def main() -> int:
    cache = load_geo_cache()
    all_results = []
    for k in COMMUNES:
        try:
            res = process_commune(k, cache)
            if res:
                all_results.append(res)
        except Exception as e:
            log.error(f"{k['name']}: {e}")
        time.sleep(2)

    log_step('══ Résumé final ══')
    for res in all_results:
        log_step(f"  {res['kommune']}: ≥4G={res['pct_4g_plus']}% · 5G={res['pct_5g']}% · ≥2G={res['pct_2g_plus']}%")

    push_to_supabase(all_results)
    return 0


if __name__ == '__main__':
    sys.exit(main())
