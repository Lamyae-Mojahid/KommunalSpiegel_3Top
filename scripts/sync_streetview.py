"""
sync_streetview.py - KommunalSpiegel S3
Méthode exacte QGIS QuickOSM :
1. Overpass API avec boundary=administrative (comme QGIS QuickOSM)
2. Extrait routes filtrées strictement dans la frontière administrative
3. Échantillonne points tous les 100m
4. Google Street View Metadata API → vérifie couverture
5. Calcule % et sauvegarde dans Supabase
"""

import os
import math
import time
import json
import logging
import urllib.request
import urllib.parse
import subprocess
import sys
from typing import Dict

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_KEY']
GOOGLE_API_KEY = os.environ['GOOGLE_MAPS_API_KEY']

# Nur das städtische Straßennetz: keine Autobahn/Schnellstraße,
# keine Rampen (*_link), kein unclassified (zu viele Feld-/Landwege).
HIGHWAY_TYPES = {
    'living_street', 'primary', 'residential',
    'secondary', 'tertiary'
}

PRIVATE_ACCESS = {'private', 'no', 'customers', 'permit', 'delivery', 'destination'}

SAMPLE_INTERVAL = 100
SEARCH_RADIUS = 50
PAUSE = 0.1

COMMUNES = [
    {'name': 'Leuna',          'kommune_id': 1, 'admin_level': '8'},
    {'name': 'Querfurt',       'kommune_id': 2, 'admin_level': '8'},
    {'name': 'Bad Dürrenberg', 'kommune_id': 3, 'admin_level': '8'},
]

OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
]

def install_deps():
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'supabase', 'requests', '--quiet'])

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def interpolate_points(coords, interval_m):
    points = []
    for i in range(len(coords) - 1):
        lat1, lon1 = coords[i]
        lat2, lon2 = coords[i + 1]
        seg_len = haversine(lat1, lon1, lat2, lon2)
        n = max(1, int(seg_len / interval_m))
        for j in range(n):
            t = j / n
            points.append((lat1 + t*(lat2-lat1), lon1 + t*(lon2-lon1)))
    return points

def overpass_query(query):
    import requests as req_lib
    headers = {'User-Agent': 'KommunalSpiegel-Hochschule-Merseburg/1.0'}
    for ep in OVERPASS_ENDPOINTS:
        try:
            r = req_lib.post(ep, data={'data': query}, headers=headers, timeout=120)
            if r.status_code == 200:
                return r.json()
            log.warning(f"Overpass {ep}: HTTP {r.status_code}")
        except Exception as e:
            log.warning(f"Overpass {ep}: {e}")
        time.sleep(2)
    return None

def fetch_roads_overpass(commune_name, admin_level='8'):
    hw_filter = '|'.join(sorted(HIGHWAY_TYPES))

    query = f"""
[out:json][timeout:120];
area["name"="{commune_name}"]["boundary"="administrative"]["admin_level"="{admin_level}"];
way["highway"~"^({hw_filter})$"]
   ["access"!~"^(private|no|customers|permit|delivery|destination)$"]
   (area);
out geom;
"""
    log.info(f"{commune_name}: requête Overpass boundary=administrative admin_level={admin_level}")
    data = overpass_query(query)

    if not data:
        query2 = f"""
[out:json][timeout:120];
area["name"="{commune_name}"]["boundary"="administrative"];
way["highway"~"^({hw_filter})$"]
   ["access"!~"^(private|no|customers|permit|delivery|destination)$"]
   (area);
out geom;
"""
        log.info(f"{commune_name}: fallback sans admin_level")
        data = overpass_query(query2)

    if not data:
        return []

    roads = []
    for el in data.get('elements', []):
        tags = el.get('tags', {})
        geom = el.get('geometry', [])
        coords = [(pt['lat'], pt['lon']) for pt in geom if 'lat' in pt and 'lon' in pt]
        if len(coords) >= 2:
            name = tags.get('name') or tags.get('name:de') or f"(unbenannt · {tags.get('highway','Weg')})"
            roads.append({'name': name, 'coords': coords, 'highway': tags.get('highway', '')})

    return roads

def has_streetview(lat, lng):
    params = urllib.parse.urlencode({
        'location': f'{lat},{lng}',
        'radius': SEARCH_RADIUS,
        'key': GOOGLE_API_KEY,
        'source': 'outdoor',
    })
    url = f'https://maps.googleapis.com/maps/api/streetview/metadata?{params}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'KommunalSpiegel/1.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('status') == 'OK'
    except Exception:
        return False

def calculate_coverage(commune):
    name = commune['name']
    admin_level = commune.get('admin_level', '8')

    log.info(f"── {name} : extraction routes OSM (boundary=administrative) ──")
    roads = fetch_roads_overpass(name, admin_level)
    log.info(f"{name}: {len(roads)} tronçons dans la frontière administrative")

    if not roads:
        return None, [], []

    # Punkte PRO STRASSE interpolieren — Name und Reihenfolge bleiben erhalten,
    # damit Segmente nur entlang derselben Straße gebildet werden.
    roads_with_points = []
    for road in roads:
        pts = interpolate_points(road['coords'], SAMPLE_INTERVAL)
        if pts:
            roads_with_points.append({'name': road['name'], 'highway': road['highway'], 'points': pts})

    if not roads_with_points:
        return None, [], []

    coverage_cache: dict = {}
    total_unique_points = len(set((round(p[0], 4), round(p[1], 4)) for r in roads_with_points for p in r['points']))
    checked = 0

    def is_covered(lat, lng):
        nonlocal checked
        key = (round(lat, 4), round(lng, 4))
        if key in coverage_cache:
            return coverage_cache[key]
        result = has_streetview(lat, lng)
        coverage_cache[key] = result
        time.sleep(PAUSE)
        checked += 1
        if checked % 50 == 0:
            covered_so_far = sum(1 for v in coverage_cache.values() if v)
            log.info(f"{name}: {checked}/{total_unique_points} ({covered_so_far} couverts)")
        return result

    segments = []
    # Pro Straßenname aufsummierte Länge (m), getrennt nach abgedeckt/nicht.
    # Mehrere OSM-Way-Abschnitte mit demselben Namen werden zusammengefasst
    # (z. B. eine lange Straße, die in mehrere OSM-Ways aufgeteilt ist).
    road_lengths: Dict[str, Dict[str, float]] = {}

    for r in roads_with_points:
        pts = r['points']
        covered_flags = [is_covered(lat, lng) for lat, lng in pts]
        entry = road_lengths.setdefault(r['name'], {'covered_m': 0.0, 'uncovered_m': 0.0, 'highway': r['highway']})
        for i in range(len(pts) - 1):
            lat1, lng1 = pts[i]
            lat2, lng2 = pts[i + 1]
            seg_covered = covered_flags[i] or covered_flags[i + 1]
            seg_len_m = haversine(lat1, lng1, lat2, lng2)
            segments.append({
                'lat_start': round(lat1, 6), 'lng_start': round(lng1, 6),
                'lat_end': round(lat2, 6), 'lng_end': round(lng2, 6),
                'covered': seg_covered,
            })
            if seg_covered:
                entry['covered_m'] += seg_len_m
            else:
                entry['uncovered_m'] += seg_len_m

    roads_summary = [
        {
            'strassenname': rname,
            'highway': info['highway'],
            'laenge_abgedeckt_m': round(info['covered_m'], 1),
            'laenge_nicht_abgedeckt_m': round(info['uncovered_m'], 1),
            'laenge_gesamt_m': round(info['covered_m'] + info['uncovered_m'], 1),
        }
        for rname, info in road_lengths.items()
    ]

    total = len(coverage_cache)
    covered_count = sum(1 for v in coverage_cache.values() if v)
    pct = round((covered_count / total) * 100, 2) if total else 0.0
    score = min(10.0, max(0.0, round(pct / 10, 1)))
    log.info(f"{name}: {covered_count}/{total} → {pct}% (score: {score})")
    return {'pct': pct, 'score': score, 'total_points': total, 'covered_points': covered_count}, segments, roads_summary

def update_supabase(supabase, commune, result, segments, roads_summary):
    commune_name = commune['name']
    kommune_id = commune['kommune_id']
    try:
        supabase.table('benchmark').upsert({
            'kommune_id': kommune_id,
            'sicht_nr': 3,
            'kennzahl': '360° Streetview',
            'wert_num': result['pct'],
            'score_normiert': result['score'],
            'quelle': 'Overpass boundary=administrative + Google Street View Metadata API',
            'quelle_typ': 'automatisch',
            'erhebungsjahr': 2026,
        }, on_conflict='kommune_id,sicht_nr,kennzahl,erhebungsjahr').execute()

        supabase.table('streetview_routes').delete().eq('kommune_id', kommune_id).eq('erhebungsjahr', 2026).execute()

        for i in range(0, len(segments), 500):
            batch = segments[i:i+500]
            supabase.table('streetview_routes').insert([{
                'kommune_id': kommune_id,
                'lat_start': s['lat_start'], 'lng_start': s['lng_start'],
                'lat_end': s['lat_end'], 'lng_end': s['lng_end'],
                'covered': s['covered'], 'erhebungsjahr': 2026,
            } for s in batch]).execute()
            log.info(f"{commune_name}: {min(i+500, len(segments))}/{len(segments)} segments sauvegardés")

        # Tabelle 1/2 der Spezifikation: Straßenname + Länge (m), abgedeckt/nicht.
        supabase.table('streetview_roads_summary').delete().eq('kommune_id', kommune_id).eq('erhebungsjahr', 2026).execute()
        for i in range(0, len(roads_summary), 500):
            batch = roads_summary[i:i+500]
            supabase.table('streetview_roads_summary').insert([{
                'kommune_id': kommune_id,
                'strassenname': r['strassenname'],
                'highway_typ': r['highway'],
                'laenge_abgedeckt_m': r['laenge_abgedeckt_m'],
                'laenge_nicht_abgedeckt_m': r['laenge_nicht_abgedeckt_m'],
                'laenge_gesamt_m': r['laenge_gesamt_m'],
                'erhebungsjahr': 2026,
            } for r in batch]).execute()
        log.info(f"{commune_name}: {len(roads_summary)} Straßen-Zusammenfassungen gespeichert")

        log.info(f"{commune_name}: ✅ → {result['pct']}%")
        return True
    except Exception as e:
        log.error(f"{commune_name}: Supabase erreur: {e}")
        return False

def already_done(supabase, commune):
    try:
        kommune_id = commune['kommune_id']
        r = supabase.table('streetview_routes').select('id').eq('kommune_id', kommune_id).eq('erhebungsjahr', 2026).limit(1).execute()
        return bool(r.data)
    except Exception:
        return False

def main():
    install_deps()
    from supabase import create_client

    _raw = SUPABASE_URL
    base_url = _raw.split('/rest/')[0] if '/rest/' in _raw else _raw
    supabase = create_client(base_url, SUPABASE_KEY)

    results = {}

    for commune in COMMUNES:
        name = commune['name']
        if already_done(supabase, commune):
            log.info(f"{name}: déjà traité ✅ — skip")
            continue
        try:
            result, segments, roads_summary = calculate_coverage(commune)
            if result:
                update_supabase(supabase, commune, result, segments, roads_summary)
                results[name] = result
        except Exception as e:
            log.error(f"{name}: {e}")
        time.sleep(3)

    log.info("══ Résumé final ══")
    for name, r in results.items():
        log.info(f"  {name}: {r['pct']}% ({r['covered_points']}/{r['total_points']})")
    log.info(f"Terminé : {len(results)}/{len(COMMUNES)} communes traitées")

if __name__ == '__main__':
    main()
