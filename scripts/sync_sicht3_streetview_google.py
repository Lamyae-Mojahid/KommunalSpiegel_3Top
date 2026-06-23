#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KommunalSpiegel · Sicht 3 Streetview-Abdeckung · v2.7
Kernfix: strict_pct wurde gegen total_len ALLER Straßen berechnet,
obwohl nur max_api_roads geprüft wurden → systematische Unterschätzung.

v2.7-Änderungen:
- Neue Kennzahl: coverage_of_checked_percent (nur geprüfte Straßen im Nenner)
- Stratifizierte Stichprobe: Hauptstraßen bevorzugt, Längengewichtung
- extrapolated_percent: hochgerechnete Gesamtabdeckung (transparent gekennzeichnet)
- covered_percent bleibt als konservative Kennzahl, aber UI zeigt jetzt den richtigen Wert
"""
import argparse, json, math, os, time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT / 'data' / 'kommunen_seed.json'
OUT_DEFAULT = ROOT / 'data' / 'sicht3_streetview.json'
CACHE_DIR = ROOT / 'data' / 'cache'
CACHE_DIR.mkdir(parents=True, exist_ok=True)
BOUNDARY_CACHE = CACHE_DIR / 'boundaries_shared.json'

OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter',
]
BENCHMARK_S3 = {
    'Leuna': 93.01,
    'Querfurt': 87.27,
    'Bad Dürrenberg': 85.66,
}

def log(msg):
    print(time.strftime('[%H:%M:%S]'), msg, flush=True)

def load_seed():
    with open(SEED_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('kommunen', data if isinstance(data, list) else [])

def get_name(k): return k.get('name') or k.get('kommune')
def get_lat(k):
    v = k.get('lat') or k.get('latitude') or k.get('center',{}).get('lat') or k.get('center',{}).get('latitude')
    if v is None: raise ValueError(f"Keine Latitude für {get_name(k)}")
    return float(v)
def get_lon(k):
    v = k.get('lon') or k.get('lng') or k.get('longitude') or k.get('center',{}).get('lon') or k.get('center',{}).get('lng') or k.get('center',{}).get('longitude')
    if v is None: raise ValueError(f"Keine Longitude für {get_name(k)}")
    return float(v)

def load_boundary_cache():
    if BOUNDARY_CACHE.exists():
        try: return json.loads(BOUNDARY_CACHE.read_text(encoding='utf-8'))
        except Exception: return {}
    return {}

def save_boundary_cache(c):
    BOUNDARY_CACHE.write_text(json.dumps(c, ensure_ascii=False), encoding='utf-8')

def nominatim_boundary(k):
    name = get_name(k); landkreis = k.get('landkreis','')
    q = f"{name}, {landkreis}, Sachsen-Anhalt, Deutschland"
    params = {'q': q, 'format':'jsonv2', 'polygon_geojson':1, 'limit':5, 'addressdetails':1}
    headers = {'User-Agent': 'KommunalSpiegel-Hochschulprojekt/1.0'}
    for attempt in range(3):
        r = requests.get('https://nominatim.openstreetmap.org/search', params=params, headers=headers, timeout=30)
        if r.status_code == 429:
            wait = max(20, int(r.headers.get('Retry-After','20') or '20'))
            log(f"WARN: Nominatim 429 – warte {wait}s"); time.sleep(wait); continue
        r.raise_for_status()
        for h in r.json():
            gj = h.get('geojson')
            if gj and gj.get('type') in ('Polygon','MultiPolygon'):
                return {'display_name': h.get('display_name'), 'geojson': gj}
        break
    return None

def load_boundary(k):
    cache = load_boundary_cache(); name = get_name(k)
    if name in cache and cache[name].get('geojson'): return cache[name]
    b = nominatim_boundary(k)
    if b: cache[name] = b; save_boundary_cache(cache)
    return b

def bbox_from_boundary_or_center(boundary, lat, lon, pad=0.08):
    xs=[]; ys=[]
    def walk(coords):
        if isinstance(coords[0], (int,float)): xs.append(coords[0]); ys.append(coords[1])
        else:
            for c in coords: walk(c)
    if boundary and boundary.get('geojson'): walk(boundary['geojson']['coordinates'])
    if xs and ys: return min(ys), min(xs), max(ys), max(xs)
    return lat-pad, lon-pad, lat+pad, lon+pad

def overpass(query):
    last=None
    headers = {'User-Agent': 'KommunalSpiegel-Hochschulprojekt/1.0 Sicht3'}
    query = "\n".join(line.strip() for line in query.splitlines() if line.strip())
    for ep in OVERPASS_ENDPOINTS:
        host = ep.split('/')[2]
        for method in ('GET', 'POST'):
            try:
                log(f"Overpass {method} → {host}")
                if method == 'GET':
                    r = requests.get(ep, params={'data': query}, headers=headers, timeout=35)
                else:
                    r = requests.post(ep, data={'data': query}, headers=headers, timeout=35)
                if r.status_code == 429:
                    wait = max(20, int(r.headers.get('Retry-After','20') or '20'))
                    log(f"WARN: Overpass 429 – warte {wait}s"); time.sleep(wait); continue
                r.raise_for_status()
                return r.json()
            except Exception as e:
                last=e; log(f"WARN: Overpass {method} fehlgeschlagen: {e}")
    raise RuntimeError(str(last))

def point_in_ring(pt, ring):
    lat, lon = pt; x, y = lon, lat; inside = False
    if not ring or len(ring) < 3: return False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]; xj, yj = ring[j][0], ring[j][1]
        intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi)
        if intersect: inside = not inside
        j = i
    return inside

def point_in_polygon(pt, polygon_coords):
    if not polygon_coords: return False
    if not point_in_ring(pt, polygon_coords[0]): return False
    for hole in polygon_coords[1:]:
        if point_in_ring(pt, hole): return False
    return True

def point_in_boundary(pt, boundary):
    gj = (boundary or {}).get('geojson') or {}
    typ = gj.get('type'); coords = gj.get('coordinates') or []
    if typ == 'Polygon': return point_in_polygon(pt, coords)
    if typ == 'MultiPolygon': return any(point_in_polygon(pt, poly) for poly in coords)
    return False

def split_inside_fragments(coords, boundary):
    frags=[]; cur=[]
    for pt in coords:
        if point_in_boundary(pt, boundary): cur.append(pt)
        else:
            if len(cur) >= 2: frags.append(cur)
            cur=[]
    if len(cur) >= 2: frags.append(cur)
    return frags

def hav_m(a,b):
    R=6371000; lat1,lon1=map(math.radians,a); lat2,lon2=map(math.radians,b)
    dlat=lat2-lat1; dlon=lon2-lon1
    h=math.sin(dlat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2*R*math.asin(math.sqrt(h))

def line_length(coords):
    return sum(hav_m(coords[i],coords[i+1]) for i in range(len(coords)-1))

def load_roads(k, boundary):
    lat, lon = get_lat(k), get_lon(k)
    if not (boundary and boundary.get('geojson')):
        raise RuntimeError('Keine echte Gemeindegrenze vorhanden.')
    s,w,n,e = bbox_from_boundary_or_center(boundary, lat, lon, pad=0.0)
    pad=0.002; s,w,n,e = s-pad, w-pad, n+pad, e+pad
    q = f"""
    [out:json][timeout:35];
    way["highway"]({s},{w},{n},{e});
    out tags geom;
    """
    data = overpass(q)
    roads=[]
    exclude = {'footway','path','cycleway','bridleway','steps','pedestrian','construction','proposed','platform','raceway','corridor'}
    include = {'motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','unclassified','residential','living_street','service','road'}
    private_access = {'private','no','customers','permit','delivery','destination'}
    for el in data.get('elements',[]):
        tags = el.get('tags',{}) or {}
        hw = tags.get('highway')
        if not hw or hw in exclude or hw not in include: continue
        if (tags.get('access') in private_access) or (tags.get('vehicle') in private_access): continue
        if hw == 'service' and tags.get('service') in {'driveway','parking_aisle','private','drive-through'}: continue
        geom = el.get('geometry') or []
        coords=[]
        for pnt in geom:
            try: coords.append([float(pnt.get('lat')), float(pnt.get('lon'))])
            except: continue
        if len(coords) < 2: continue
        for idx, frag in enumerate(split_inside_fragments(coords, boundary)):
            if len(frag) >= 2 and line_length(frag) >= 20:
                roads.append({'id': f"{el.get('id')}_{idx}", 'osm_id': el.get('id'),
                              'name': tags.get('name') or 'Straße', 'highway': hw,
                              'coords': frag, 'length_m': round(line_length(frag), 1)})
    return roads

def stratified_sample(roads, n):
    """
    v2.7: Stratifizierte Stichprobe statt blinder Reihenfolge.
    Ohne diese Funktion hängt covered_percent davon ab, welche Straßen
    alphabetisch/zufällig zuerst kommen — nicht von der echten Abdeckung.
    Tier 3 (Haupt-/Bundesstraßen): 60% der Stichprobe
    Tier 2 (Wohn-/Nebenstraßen):   30%
    Tier 1 (Service/Rest):          10%
    Innerhalb jedes Tiers: längste Straßen zuerst (maximale Längenabdeckung).
    """
    if not n or len(roads) <= n:
        return roads  # alle prüfen

    tier_map = {
        'motorway':3,'motorway_link':3,'trunk':3,'trunk_link':3,
        'primary':3,'primary_link':3,'secondary':3,'secondary_link':3,
        'tertiary':2,'tertiary_link':2,'unclassified':2,'residential':2,
        'living_street':1,'service':1,'road':1
    }
    buckets = {3:[], 2:[], 1:[]}
    for r in roads:
        t = tier_map.get(r['highway'], 1)
        buckets[t].append(r)

    targets = {3: max(1, int(n*0.60)), 2: max(1, int(n*0.30)), 1: max(1, int(n*0.10))}
    # Sicherstellen dass n nicht überschritten wird
    total_target = sum(targets.values())
    if total_target > n:
        targets[1] = max(0, n - targets[3] - targets[2])

    sampled = []
    for t in [3, 2, 1]:
        pool = sorted(buckets[t], key=lambda r: r.get('length_m', 0), reverse=True)
        sampled.extend(pool[:targets[t]])

    log(f"  Stratifizierte Stichprobe: {len(sampled)}/{len(roads)} Straßen "
        f"(Tier3={min(len(buckets[3]),targets[3])}, "
        f"Tier2={min(len(buckets[2]),targets[2])}, "
        f"Tier1={min(len(buckets[1]),targets[1])})")
    return sampled

def sample_line(coords, every_m=120, max_points=3):
    pts=[]; total=line_length(coords)
    if total <= 0: return [coords[0]]
    targets=[min(total-1, i*every_m) for i in range(1, int(total//every_m)+1)]
    if not targets: targets=[total/2]
    if len(targets)>max_points:
        step=len(targets)/max_points; targets=[targets[int(i*step)] for i in range(max_points)]
    for t in targets:
        acc=0
        for i in range(len(coords)-1):
            a,b=coords[i],coords[i+1]; d=hav_m(a,b)
            if acc+d >= t:
                f=(t-acc)/d if d else 0
                pts.append([a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f])
                break
            acc+=d
    return pts or [coords[0]]

def google_metadata(pt, key, radius=20, timeout=8):
    if not key: return {'status':'NO_KEY'}
    url='https://maps.googleapis.com/maps/api/streetview/metadata'
    params={'location': f"{pt[0]},{pt[1]}", 'radius': radius, 'source':'outdoor', 'key': key}
    try:
        r=requests.get(url, params=params, timeout=timeout)
        try: return r.json()
        except: return {'status': f'HTTP_{r.status_code}'}
    except requests.exceptions.ReadTimeout:
        return {'status':'TIMEOUT'}
    except requests.exceptions.RequestException as e:
        return {'status':'REQUEST_ERROR', 'error': str(e)[:160]}

def sync_kommune(k, key, debug=False, max_api_roads=500, samples_per_road=3, google_timeout=8):
    name=get_name(k); log('-'*72); log(f"{name}: Grenze laden")
    boundary=load_boundary(k); boundary_ok=bool(boundary and boundary.get('geojson'))
    try:
        roads=load_roads(k, boundary)
    except Exception as e:
        return {'kommune': name, 'status':'benchmark', 'boundary_ok': boundary_ok,
                'error': str(e), 'benchmark_percent': BENCHMARK_S3.get(name),
                'covered_percent': None, 'blue_lines': []}

    log(f"{name}: {len(roads)} Straßenabschnitte geladen")

    # v2.7: Stratifizierte Stichprobe – repräsentativ statt zufällig/alphabetisch
    roads_to_check = stratified_sample(roads, max_api_roads)
    sampled_ids = {r['id'] for r in roads_to_check}

    # Gesamtlängen berechnen
    total_len = sum(r.get('length_m', line_length(r['coords'])) for r in roads)
    checked_len = sum(r.get('length_m', line_length(r['coords'])) for r in roads_to_check)

    road_lines=[]; blue=[]; checked=0; ok=0
    covered_len=0; timeout_count=0; request_error_count=0

    for idx, r in enumerate(roads):
        length = r.get('length_m', line_length(r['coords']))
        road_lines.append({'id': r['id'], 'name': r['name'], 'highway': r['highway'],
                          'length_m': round(length,1), 'coords': r['coords']})

        if r['id'] not in sampled_ids:
            continue  # nicht in Stichprobe → grau, aber nicht im Nenner

        if debug and (idx % 100 == 0):
            log(f"  {name}: {idx}/{len(roads)} Straßen · OK={ok} · Timeouts={timeout_count}")

        samples = sample_line(r['coords'], every_m=120, max_points=samples_per_road)
        ok_on_road = 0

        for pt in samples:
            checked += 1
            md = google_metadata(pt, key, radius=20, timeout=google_timeout)
            st = md.get('status')
            if st == 'TIMEOUT': timeout_count += 1
            elif st == 'REQUEST_ERROR': request_error_count += 1

            is_ok = False
            if st == 'OK':
                loc = md.get('location') or {}
                try:
                    p2 = [float(loc.get('lat')), float(loc.get('lng'))]
                    is_ok = hav_m(pt, p2) <= 35
                except: pass
            if is_ok:
                ok += 1; ok_on_road += 1
            time.sleep(0.02)

        road_hit_rate = ok_on_road / max(1, len(samples))
        if road_hit_rate >= 0.50:
            covered_len += length
            blue.append({'id': r['id'], 'name': r['name'], 'highway': r['highway'],
                        'length_m': round(length,1), 'coords': r['coords'],
                        'hit_rate': round(road_hit_rate,2)})

    # v2.7: Drei Kennzahlen, klar getrennt
    # 1. Konservativ (alter Wert): covered / total — immer niedrig bei Teilstichprobe
    conservative_pct   = (covered_len / total_len * 100) if total_len else 0
    # 2. NEU — Abdeckung der geprüften Straßen: das ist der eigentlich aussagekräftige Wert
    coverage_checked   = (covered_len / checked_len * 100) if checked_len else 0
    # 3. Hochrechnung: wenn die Stichprobe repräsentativ ist, Extrapolation auf Gesamtnetz
    extrapolated_pct   = coverage_checked  # bei stratifizierter Stichprobe = bester Schätzer
    hit_rate_pct       = (ok / checked * 100) if checked else 0

    bench = BENCHMARK_S3.get(name)
    status = 'api_live_pruefen' if key and checked else 'benchmark'

    log(f"{name}: geprüft={len(roads_to_check)}/{len(roads)} Straßen | "
        f"blau={len(blue)} | Abdeckung geprüft={coverage_checked:.1f}% | "
        f"Hochrechnung={extrapolated_pct:.1f}% | konservativ={conservative_pct:.1f}% | "
        f"manueller Benchmark={bench}%")

    return {
        'kommune': name,
        'status': status,
        'boundary_ok': boundary_ok,
        'source': 'Google Street View Metadata API + OSM',
        'benchmark_percent': bench,

        # v2.7 Kennzahlen — alle drei transparent ausgeben
        'covered_percent': round(conservative_pct, 2),         # konservativ (alter Wert)
        'coverage_of_checked_percent': round(coverage_checked, 2),  # NEU: Hauptwert für UI
        'extrapolated_percent': round(extrapolated_pct, 2),    # Schätzer Gesamtnetz

        'coverage_is_proxy': True,
        'sampling_method': 'stratified_by_tier_and_length',
        'roads_total': len(roads),
        'roads_sampled': len(roads_to_check),
        'roads_covered': len(blue),
        'total_length_m': round(total_len),
        'checked_length_m': round(checked_len),
        'covered_length_m': round(covered_len),
        'metadata_samples': checked,
        'metadata_ok': ok,
        'metadata_hit_rate_percent': round(hit_rate_pct, 2),
        'google_timeouts': timeout_count,
        'google_request_errors': request_error_count,
        'road_lines': road_lines[:3000],
        'blue_lines': blue[:1000],
        'method_note': (
            'v2.7: Stratifizierte Stichprobe (Tier-Gewichtung + Länge). '
            'coverage_of_checked_percent = Abdeckung der geprüften Straßen (Hauptwert). '
            'extrapolated_percent = Hochrechnung auf Gesamtnetz. '
            'covered_percent = konservativ (covered/total, immer niedrig bei Teilstichprobe).'
        )
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--kommune')
    ap.add_argument('--out', default=str(OUT_DEFAULT))
    ap.add_argument('--debug', action='store_true')
    ap.add_argument('--max-api-roads', type=int, default=500,
                    help='Stichprobengröße. 0 = alle prüfen. Default 500 (stratifiziert).')
    ap.add_argument('--samples-per-road', type=int, default=3)
    ap.add_argument('--google-timeout', type=int, default=8)
    args=ap.parse_args()

    seed=load_seed()
    if args.kommune:
        seed=[k for k in seed if get_name(k)==args.kommune]
    key=os.environ.get('GOOGLE_MAPS_API_KEY','').strip()
    if not key:
        log('WARN: GOOGLE_MAPS_API_KEY fehlt.')

    log(f"KommunalSpiegel Sicht 3 v2.7 · {len(seed)} Kommune(n)")
    max_api_roads = None if args.max_api_roads == 0 else args.max_api_roads
    results=[sync_kommune(k, key, args.debug,
                          max_api_roads=max_api_roads,
                          samples_per_road=args.samples_per_road,
                          google_timeout=args.google_timeout) for k in seed]

    out={
        'schema': 'kommunalspiegel.sicht3_streetview_google.v2_7',
        'version': '2.7.0',
        'generated_at': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'source': 'Google Street View Metadata API + OSM',
        'api_status': 'ok' if key else 'no_key',
        'kommunen': results
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
    log(f"✓ geschrieben: {args.out}")

if __name__=='__main__': main()
