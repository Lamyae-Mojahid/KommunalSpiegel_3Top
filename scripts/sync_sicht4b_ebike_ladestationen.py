"""
sync_sicht4b_ebike_ladestationen.py - KommunalSpiegel Sicht 4 (Tabelle 2)
Öffentliche Ladeinfrastruktur für E-Bikes/E-Scooter.

Die Bundesnetzagentur erfasst ausschließlich Ladeinfrastruktur für E-Autos/
E-Motorräder (Ladesäulenverordnung). Für E-Bikes/E-Scooter gibt es kein
amtliches Register — die einzige verlässliche, flächendeckende Quelle ist
OpenStreetMap, mit dem Tag amenity=charging_station + bicycle=yes/scooter=yes.

Quelle: https://wiki.openstreetmap.org/wiki/Tag:amenity=charging_station
"""

import os
import time
import logging
import sys
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import requests

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '') or os.environ.get('SUPABASE_SERVICE_KEY', '')

OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
]

COMMUNES = [
    {'name': 'Leuna',          'kommune_id': 1, 'admin_level': '8'},
    {'name': 'Querfurt',       'kommune_id': 2, 'admin_level': '8'},
    {'name': 'Bad Dürrenberg', 'kommune_id': 3, 'admin_level': '8'},
]


def overpass_query(query: str) -> Optional[dict]:
    headers = {'User-Agent': 'KommunalSpiegel-Hochschule-Merseburg/1.0'}
    for ep in OVERPASS_ENDPOINTS:
        try:
            r = requests.post(ep, data={'data': query}, headers=headers, timeout=120)
            if r.status_code == 200:
                return r.json()
            log.warning(f"Overpass {ep}: HTTP {r.status_code}")
        except Exception as e:
            log.warning(f"Overpass {ep}: {e}")
        time.sleep(2)
    return None


def fetch_ebike_stations(commune_name: str, admin_level: str = '8') -> List[Dict]:
    """Holt alle amenity=charging_station Knoten mit bicycle=yes ODER
    scooter=yes innerhalb der Gemeindegrenze. (Stationen, die ZUSÄTZLICH
    auch motorcar=yes haben, werden ebenfalls erfasst — eine Station kann
    mehrere Fahrzeugarten gleichzeitig unterstützen.)
    """
    query = f"""
[out:json][timeout:120];
area["name"="{commune_name}"]["boundary"="administrative"]["admin_level"="{admin_level}"];
(
  node["amenity"="charging_station"]["bicycle"~"^(yes|designated)$"](area);
  node["amenity"="charging_station"]["scooter"~"^(yes|designated)$"](area);
);
out body;
"""
    log.info(f"{commune_name}: Overpass-Abfrage E-Bike/E-Scooter-Ladestationen")
    data = overpass_query(query)

    if not data:
        query2 = f"""
[out:json][timeout:120];
area["name"="{commune_name}"]["boundary"="administrative"];
(
  node["amenity"="charging_station"]["bicycle"~"^(yes|designated)$"](area);
  node["amenity"="charging_station"]["scooter"~"^(yes|designated)$"](area);
);
out body;
"""
        log.info(f"{commune_name}: Fallback ohne admin_level")
        data = overpass_query(query2)

    if not data:
        return []

    stations = []
    for el in data.get('elements', []):
        tags = el.get('tags', {})
        lat, lng = el.get('lat'), el.get('lon')
        if lat is None or lng is None:
            continue

        fahrzeugarten = []
        if tags.get('bicycle') in ('yes', 'designated'):
            fahrzeugarten.append('E-Bike')
        if tags.get('scooter') in ('yes', 'designated'):
            fahrzeugarten.append('E-Scooter')

        # Leistung (kW) aus allen socket:*:output Tags zusammensuchen,
        # höchsten Wert nehmen (häufigster verfügbarer Anschluss).
        leistung_kw = None
        for key, val in tags.items():
            if key.startswith('socket:') and key.endswith(':output'):
                try:
                    kw = float(str(val).lower().replace('kw', '').strip())
                    leistung_kw = max(leistung_kw or 0, kw)
                except ValueError:
                    pass

        capacity = None
        if tags.get('capacity', '').isdigit():
            capacity = int(tags['capacity'])

        stations.append({
            'name': tags.get('name') or tags.get('operator') or 'Ladestation',
            'betreiber': tags.get('operator') or tags.get('brand') or tags.get('network') or '—',
            'adresse': ', '.join(x for x in [tags.get('addr:street', ''), tags.get('addr:housenumber', '')] if x).strip() or None,
            'lat': lat,
            'lng': lng,
            'fahrzeugart': ' + '.join(fahrzeugarten) or 'E-Bike/E-Scooter',
            'anzahl_ladeplaetze': capacity or 1,
            'leistung_kw': leistung_kw,
            'osm_id': el.get('id'),
        })

    return stations


def push_to_supabase(results: Dict[str, List[Dict]]) -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.warning("Supabase nicht konfiguriert (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY fehlen) — kein Push.")
        return
    try:
        from supabase import create_client
    except ImportError:
        log.warning("Python-Paket 'supabase' nicht installiert — kein Push. (pip install supabase)")
        return

    base_url = SUPABASE_URL.split('/rest/')[0] if '/rest/' in SUPABASE_URL else SUPABASE_URL
    sb = create_client(base_url, SUPABASE_KEY)
    jahr = datetime.now().year

    for commune in COMMUNES:
        name = commune['name']
        kommune_id = commune['kommune_id']
        stations = results.get(name, [])

        try:
            sb.table('ebike_ladestationen').delete().eq('kommune_id', kommune_id).eq('erhebungsjahr', jahr).execute()
        except Exception as e:
            log.warning(f"{name}: Löschen alter ebike_ladestationen fehlgeschlagen: {e}")

        if stations:
            rows = [{
                'kommune_id': kommune_id,
                'osm_id': s['osm_id'],
                'name': s['name'],
                'betreiber': s['betreiber'],
                'adresse': s['adresse'],
                'lat': s['lat'],
                'lng': s['lng'],
                'fahrzeugart': s['fahrzeugart'],
                'anzahl_ladeplaetze': s['anzahl_ladeplaetze'],
                'leistung_kw': s['leistung_kw'],
                'erhebungsjahr': jahr,
            } for s in stations]
            try:
                sb.table('ebike_ladestationen').insert(rows).execute()
            except Exception as e:
                log.error(f"{name}: Supabase-Fehler beim Einfügen: {e}")
                continue

        ew = {'Leuna': 14131, 'Querfurt': 10007, 'Bad Dürrenberg': 11521}.get(name)
        pro1000 = round(sum(s['anzahl_ladeplaetze'] for s in stations) / (ew / 1000), 3) if ew else None

        try:
            sb.table('benchmark').upsert({
                'kommune_id': kommune_id,
                'sicht_nr': 4,
                'kennzahl': 'Ladeplätze E-Bike/E-Scooter pro Tsd. Einwohner',
                'wert_num': pro1000,
                'score_normiert': None,
                'erhebungsjahr': jahr,
                'quelle': 'OpenStreetMap (amenity=charging_station, bicycle/scooter=yes)',
                'quelle_typ': 'automatisch',
                'letzter_abruf': datetime.now(timezone.utc).isoformat(),
            }, on_conflict='kommune_id,sicht_nr,kennzahl,erhebungsjahr').execute()
        except Exception as e:
            log.error(f"{name}: Supabase-Fehler (benchmark): {e}")

        log.info(f"{name}: {len(stations)} E-Bike/E-Scooter-Ladestationen, {pro1000} Ladeplätze/1000 EW → Supabase")


def main():
    results = {}
    for commune in COMMUNES:
        name = commune['name']
        stations = fetch_ebike_stations(name, commune['admin_level'])
        results[name] = stations
        log.info(f"{name}: {len(stations)} E-Bike/E-Scooter-Ladestationen gefunden")
        time.sleep(2)

    push_to_supabase(results)

    log.info("══ Résumé final ══")
    for name, stations in results.items():
        log.info(f"  {name}: {len(stations)} Stationen")


if __name__ == '__main__':
    main()
