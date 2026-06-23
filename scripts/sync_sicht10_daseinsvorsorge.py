#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations
import argparse, json, re, math, time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import requests
from kommunen_seed_loader import load_seed, seed_kommunen, seed_benchmark_s4, seed_benchmark_s2, seed_benchmark_s10

VERSION='8.3.0'
SCHEMA='kommunalspiegel.sicht10_daseinsvorsorge.v8_3_boundary_cache'
USER_AGENT='KommunalSpiegel/8.2 Hochschulprojekt Sicht10 Daseinsvorsorge'
TIMEOUT=25
DATA_DIR=Path('data'); CACHE_DIR=DATA_DIR/'cache'; OUT_FILE=DATA_DIR/'sicht10_daseinsvorsorge.json'; BOUNDARY_CACHE=CACHE_DIR/'sicht10_boundaries.json'; SHARED_BOUNDARY_CACHE=CACHE_DIR/'boundaries_shared.json'
NOMINATIM_URL='https://nominatim.openstreetmap.org/search'
OVERPASS_ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.openstreetmap.ru/api/interpreter','https://overpass.kumi.systems/api/interpreter']

# Fachliche Methode aus der manuellen Erhebung:
# 1) Schulabdeckung: 10-Minuten-Fußerreichbarkeit, als Raster-Proxy approximiert.
# 2) Kita-Abdeckung: 10-Minuten-Fußerreichbarkeit, als Raster-Proxy approximiert.
# 3) Gewerbefläche: ausgewiesene Industrie-/Gewerbeflächen in m² pro 1.000 Einwohner.
# Optional angezeigt, aber NICHT Hauptscore: Gesundheit, Nahversorgung, ÖPNV.
WALK_10_MIN_M=800
GRID_STEP_M=250

KOMMUNEN=[
 {'name':'Leuna','lk':'Saalekreis','ew':14500,'lat':51.3286,'lng':12.0032,'ags':'15088205'},
 {'name':'Bad Dürrenberg','lk':'Saalekreis','ew':9800,'lat':51.2965,'lng':12.0645},
 {'name':'Querfurt','lk':'Saalekreis','ew':12800,'lat':51.3803,'lng':11.5897},
 {'name':'Mücheln (Geiseltal)','lk':'Saalekreis','ew':8600,'lat':51.2994,'lng':11.7996},
 {'name':'Braunsbedra','lk':'Saalekreis','ew':10600,'lat':51.2872,'lng':11.8843},
 {'name':'Landsberg','lk':'Saalekreis','ew':9700,'lat':51.5219,'lng':11.9877,'ags':'15088195'},
]

# Keine erfundenen Benchmark-Werte. Hier können später die Werte aus eurer manuellen Erhebung eingetragen/importiert werden.
# Die API erzeugt deshalb zunächst geprüfte Live-Indikatoren + Status "prüfen", solange kein manueller Vergleichswert vorliegt.
BENCHMARK_DIMENSIONS={
 'Leuna': {
   'school_coverage_percent': None,
   'kita_coverage_percent': None,
   'commercial_area_m2_per_1000_ew': None,
   'source': 'manuelle studentische Erhebung; Werte können aus CSV/JSON ergänzt werden'
 }
}

CATEGORIES=[
 {'id':'schools','group':'main_school','label':'Schulen','dimension':'school_coverage_percent','coverage_radius_m':WALK_10_MIN_M,'main_indicator':True,'kind':'point',
  'filters':[('nwr["amenity"="school"]','Schule')]},
 {'id':'kitas','group':'main_kita','label':'Kitas / Kindertagesstätten','dimension':'kita_coverage_percent','coverage_radius_m':WALK_10_MIN_M,'main_indicator':True,'kind':'point',
  'filters':[('nwr["amenity"="kindergarten"]','Kita'),('nwr["amenity"="childcare"]','Kinderbetreuung')]},
 {'id':'commercial_area','group':'main_commercial','label':'Gewerbe-/Industriefläche','dimension':'commercial_area_m2_per_1000_ew','coverage_radius_m':0,'main_indicator':True,'kind':'area',
  'filters':[('nwr["landuse"="industrial"]','Industriefläche'),('nwr["landuse"="commercial"]','Gewerbefläche'),('nwr["landuse"="retail"]','Einzelhandelsfläche')]},
 {'id':'health_optional','group':'optional_health','label':'Gesundheit (optional)','dimension':'optional_health_count','coverage_radius_m':WALK_10_MIN_M,'main_indicator':False,'kind':'point',
  'filters':[('nwr["amenity"="doctors"]','Arzt'),('nwr["amenity"="dentist"]','Zahnarzt'),('nwr["amenity"="pharmacy"]','Apotheke'),('nwr["amenity"="clinic"]','Klinik'),('nwr["amenity"="hospital"]','Krankenhaus')]},
 {'id':'retail_optional','group':'optional_retail','label':'Nahversorgung (optional)','dimension':'optional_retail_count','coverage_radius_m':WALK_10_MIN_M,'main_indicator':False,'kind':'point',
  'filters':[('nwr["shop"="supermarket"]','Supermarkt'),('nwr["shop"="convenience"]','Nahversorgung'),('nwr["shop"="bakery"]','Bäckerei'),('nwr["shop"="butcher"]','Fleischerei'),('nwr["amenity"="marketplace"]','Markt')]},
 {'id':'mobility_optional','group':'optional_mobility','label':'ÖPNV / Haltestellen (optional)','dimension':'optional_mobility_count','coverage_radius_m':600,'main_indicator':False,'kind':'point',
  'filters':[('nwr["highway"="bus_stop"]','Bushaltestelle'),('nwr["public_transport"="platform"]','ÖPNV-Plattform'),('nwr["railway"="station"]','Bahnhof'),('nwr["railway"="halt"]','Haltepunkt')]},
]

@dataclass
class Feature:
    id:str; osm_type:str; osm_id:int; name:str; category:str; group:str; category_label:str; subcategory:str
    lat:Optional[float]; lng:Optional[float]; source:str; coverage_radius_m:int; main_indicator:bool; optional_layer:bool; area_m2:Optional[float]; tags:Dict[str,Any]

def log(msg): print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)
def norm_key(s):
    s=str(s or '').strip().lower()
    for a,b in {'ä':'ae','ö':'oe','ü':'ue','ß':'ss','é':'e'}.items(): s=s.replace(a,b)
    return re.sub(r'[^a-z0-9]+','',s)
def kommune_by_name(name):
    nk=norm_key(name)
    for k in KOMMUNEN:
        if norm_key(k['name'])==nk: return k
    return None
def load_json(path, default):
    try:
        if path.exists(): return json.loads(path.read_text(encoding='utf-8'))
    except Exception: pass
    return default
def save_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')

def extract_polygons(geojson):
    geom=geojson.get('geometry',geojson); typ=geom.get('type'); coords=geom.get('coordinates'); polys=[]
    if not coords: return []
    rings=[]
    if typ=='Polygon': rings=[coords[0]]
    elif typ=='MultiPolygon': rings=[poly[0] for poly in coords if poly and poly[0]]
    for ring in rings:
        pts=[]
        for p in ring:
            x,y=p[:2]; pts.append((float(y),float(x)))
        if len(pts)>=4: polys.append(pts)
    return polys

def point_in_ring(lat,lng,ring):
    inside=False; j=len(ring)-1; x=lng; y=lat
    for i in range(len(ring)):
        yi,xi=ring[i]; yj,xj=ring[j]
        if ((yi>y)!=(yj>y)) and (x < (xj-xi)*(y-yi)/((yj-yi) or 1e-12)+xi): inside=not inside
        j=i
    return inside
def point_in_polygons(lat,lng,polys): return any(point_in_ring(lat,lng,p) for p in polys)

def haversine_m(lat1,lng1,lat2,lng2):
    R=6371000.0
    p1=math.radians(lat1); p2=math.radians(lat2)
    dp=math.radians(lat2-lat1); dl=math.radians(lng2-lng1)
    a=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.atan2(math.sqrt(a),math.sqrt(1-a))

def ring_area_m2(points):
    # Equirectangular approximation, ausreichend für OSM-Gewerbeflächen in Gemeindegröße.
    if len(points) < 3: return 0.0
    lat0=math.radians(sum(p[0] for p in points)/len(points))
    R=6371000.0
    xy=[(math.radians(lng)*R*math.cos(lat0), math.radians(lat)*R) for lat,lng in points]
    area=0.0
    for i in range(len(xy)):
        x1,y1=xy[i]; x2,y2=xy[(i+1)%len(xy)]
        area += x1*y2-x2*y1
    return abs(area)/2.0

def osm_geometry_area_m2(e):
    geom=e.get('geometry') or []
    if len(geom) < 3: return None
    pts=[]
    for p in geom:
        if 'lat' in p and 'lon' in p: pts.append((float(p['lat']),float(p['lon'])))
    if len(pts) < 3: return None
    # Nur geschlossene Flächen zählen.
    if haversine_m(pts[0][0],pts[0][1],pts[-1][0],pts[-1][1]) > 30:
        pts.append(pts[0])
    area=ring_area_m2(pts)
    return round(area,1) if area > 1 else None

def elem_center(e):
    if 'lat' in e and 'lon' in e: return float(e['lat']),float(e['lon'])
    c=e.get('center') or {}
    if 'lat' in c and 'lon' in c: return float(c['lat']),float(c['lon'])
    geom=e.get('geometry') or []
    if geom:
        vals=[(p.get('lat'),p.get('lon')) for p in geom if 'lat' in p and 'lon' in p]
        if vals: return sum(float(a) for a,b in vals)/len(vals), sum(float(b) for a,b in vals)/len(vals)
    return None,None

def nominatim_get_with_retry(params: Dict[str, Any], retries: int = 4) -> requests.Response:
    """Nominatim ist rate-limited. Bei 429 wird gewartet statt abzubrechen."""
    headers = {'User-Agent': USER_AGENT}
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
            time.sleep(2.2)  # höfliche Pause nach jeder Nominatim-Anfrage
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
            polys=[[(float(a),float(b)) for a,b in ring] for ring in cache[key].get('polygons',[])]
            if polys:
                return polys,{**cache[key].get('meta',{}),'cache':True,'cache_key':key}
    return [],{}


def _write_boundary_to_caches(kommune: Dict[str, Any], polys: List[List[Tuple[float,float]]], meta: Dict[str, Any]) -> None:
    local_cache = load_json(BOUNDARY_CACHE,{})
    shared_cache = load_json(SHARED_BOUNDARY_CACHE,{})
    payload={'meta':meta,'polygons':polys,'saved_at':datetime.now(timezone.utc).isoformat()}
    for key in _boundary_keys(kommune):
        local_cache[key]=payload
        shared_cache[key]=payload
    save_json(BOUNDARY_CACHE,local_cache)
    save_json(SHARED_BOUNDARY_CACHE,shared_cache)


def load_boundary(kommune, force=False):
    # 1) Erst Shared Cache nutzen: dadurch teilen Sicht 2/4/10 dieselben Grenzen.
    if not force:
        for cache_path in [SHARED_BOUNDARY_CACHE, BOUNDARY_CACHE]:
            cache=load_json(cache_path,{})
            polys,meta=_read_boundary_from_cache(cache, kommune)
            if polys:
                return polys,meta

    q=f"{kommune['name']}, {kommune.get('lk','')}, Sachsen-Anhalt, Deutschland"
    params={'q':q,'format':'jsonv2','polygon_geojson':1,'limit':5,'addressdetails':1,'countrycodes':'de'}
    try:
        r=nominatim_get_with_retry(params)
        hits=r.json(); best=None
        for h in hits:
            disp=(h.get('display_name') or '').lower(); cls=(h.get('class') or '').lower(); typ=(h.get('type') or '').lower()
            if h.get('geojson') and 'sachsen-anhalt' in disp and (cls=='boundary' or typ in {'administrative','city','town','municipality'}):
                best=h; break
        if best is None: best=next((h for h in hits if h.get('geojson')),None)
        if not best:
            return [],{'ok':False,'source':'nominatim','error':'keine Grenze gefunden','query':q}
        polys=extract_polygons(best['geojson'])
        meta={'ok':bool(polys),'source':'nominatim_polygon_geojson','display_name':best.get('display_name'),'osm_type':best.get('osm_type'),'osm_id':best.get('osm_id'),'query':q}
        if polys:
            _write_boundary_to_caches(kommune, polys, meta)
        return polys,meta
    except Exception as e:
        return [],{'ok':False,'source':'nominatim','error':str(e),'query':q,'rate_limited':'429' in str(e)}

def overpass_query(query):
    last=None
    for ep in OVERPASS_ENDPOINTS:
        try:
            log(f"Overpass → {ep.split('/')[2]}")
            r=requests.post(ep,data={'data':query},headers={'User-Agent':USER_AGENT},timeout=TIMEOUT)
            if r.status_code in {429,502,503,504}: last=f'HTTP {r.status_code}'; continue
            r.raise_for_status(); return r.json()
        except Exception as e:
            last=str(e); log(f"WARN: Overpass fehlgeschlagen: {last}")
    raise RuntimeError(f'Alle Overpass-Endpunkte fehlgeschlagen. Letzter Fehler: {last}')

def build_query(lat,lng,radius,filter_expr):
    return f"""[out:json][timeout:{TIMEOUT}];
(
  {filter_expr}(around:{radius},{lat},{lng});
);
out center tags geom;"""

def normalize(e,cat,subcat):
    lat,lng=elem_center(e)
    tags=e.get('tags') or {}; name=tags.get('name') or tags.get('operator') or tags.get('ref') or subcat
    area=osm_geometry_area_m2(e) if cat.get('kind')=='area' else None
    return Feature(id=f"{e.get('type')}/{e.get('id')}",osm_type=e.get('type'),osm_id=int(e.get('id')),name=str(name),category=cat['id'],group=cat['group'],category_label=cat['label'],subcategory=subcat,lat=lat,lng=lng,source='OSM Overpass API',coverage_radius_m=int(cat['coverage_radius_m']),main_indicator=bool(cat['main_indicator']),optional_layer=not bool(cat['main_indicator']),area_m2=area,tags=tags)

def dedupe(features):
    seen={}
    for f in features:
        key=(f.osm_type,f.osm_id,f.category) if f.osm_id is not None else (round(f.lat or 0,5),round(f.lng or 0,5),norm_key(f.name),f.category)
        if key not in seen: seen[key]=f
        elif (seen[key].area_m2 is None) and (f.area_m2 is not None): seen[key]=f
    return list(seen.values())

def polygon_bbox(polys):
    lats=[]; lngs=[]
    for ring in polys:
        for lat,lng in ring:
            lats.append(lat); lngs.append(lng)
    return min(lats),min(lngs),max(lats),max(lngs)

def generate_grid(polys, step_m=GRID_STEP_M):
    if not polys: return []
    minlat,minlng,maxlat,maxlng=polygon_bbox(polys)
    midlat=(minlat+maxlat)/2
    lat_step=step_m/111320.0
    lng_step=step_m/(111320.0*max(math.cos(math.radians(midlat)),0.2))
    pts=[]; lat=minlat
    while lat<=maxlat:
        lng=minlng
        while lng<=maxlng:
            if point_in_polygons(lat,lng,polys): pts.append((lat,lng))
            lng += lng_step
        lat += lat_step
    return pts

def coverage_percent(grid, features, category_id=None, radius_m=None):
    if not grid: return None
    fs=[f for f in features if (category_id is None or f.category==category_id) and f.lat is not None and f.lng is not None]
    if not fs: return 0.0
    covered=0
    for glat,glng in grid:
        if any(haversine_m(glat,glng,f.lat,f.lng) <= (radius_m if radius_m is not None else f.coverage_radius_m) for f in fs):
            covered += 1
    return round(covered/len(grid)*100,1)

def compare_pct(api_val, bm_val):
    if api_val is None or bm_val in (None,0): return None
    return round(api_val/bm_val,3)

def status_logic(name, main_indicators, boundary_ok, errors):
    if not boundary_ok:
        return 'benchmark','Keine echte Gemeindegrenze; manuelle Benchmark-Erhebung anzeigen'
    # Hauptindikatoren sind verfügbar, aber ohne manuelle Vergleichswerte bleibt Status bewusst prüfpflichtig.
    bm=BENCHMARK_DIMENSIONS.get(name) or {}
    ratios=[compare_pct(main_indicators.get(k), bm.get(k)) for k in ['school_coverage_percent','kita_coverage_percent','commercial_area_m2_per_1000_ew']]
    ratios=[r for r in ratios if r is not None]
    if not ratios:
        msg='API-Indikatoren berechnet; manuelle Vergleichswerte fehlen noch. Sicht 10 als API-live-prüfen führen; optionale Layer separat anzeigen'
        if errors: msg += f'; {len(errors)} Teilfehler'
        return ('api_live_pruefen_mit_warnung' if errors else 'api_live_pruefen'), msg
    if any(r < .4 or r > 2.5 for r in ratios):
        return 'gemischt_pruefen','API weicht stark vom manuellen Benchmark ab; API + manuelle Erhebung gemeinsam anzeigen'
    if errors:
        return 'api_live_mit_warnung',f'API-Indikatoren im Benchmark-Korridor; {len(errors)} Teilfehler'
    return 'api_live','API-Indikatoren im Benchmark-Korridor; kann Benchmark ersetzen'

def sync_kommune(kommune, debug=False):
    name=kommune['name']; radius=22000
    log(f"{name}: Grenze laden"); polys,bmeta=load_boundary(kommune); boundary_ok=bool(polys)
    features=[]; errors=[]; cat_raw={}; cat_counts={}
    for cat in CATEGORIES:
        cat_features=[]
        for filt,subcat in cat['filters']:
            log(f"{name}: OSM {cat['label']} · {subcat}")
            try:
                data=overpass_query(build_query(kommune['lat'],kommune['lng'],radius,filt)); elems=data.get('elements',[]); cat_raw[cat['id']]=cat_raw.get(cat['id'],0)+len(elems)
                if debug: log(f"  Roh: {len(elems)} Elemente")
                for e in elems:
                    f=normalize(e,cat,subcat)
                    if f and f.lat is not None and f.lng is not None and (not boundary_ok or point_in_polygons(f.lat,f.lng,polys)):
                        cat_features.append(f)
            except Exception as e:
                errors.append({'category':cat['id'],'label':cat['label'],'filter':subcat,'error':str(e)})
        cat_features=dedupe(cat_features); cat_counts[cat['id']]=len(cat_features); features.extend(cat_features)
    features=dedupe(features)
    grid=generate_grid(polys) if boundary_ok else []
    schools=[f for f in features if f.category=='schools']
    kitas=[f for f in features if f.category=='kitas']
    commercial=[f for f in features if f.category=='commercial_area']
    commercial_area_total_m2=round(sum(f.area_m2 or 0 for f in commercial),1)
    commercial_area_m2_per_1000_ew=round(commercial_area_total_m2/(kommune.get('ew')/1000),1) if kommune.get('ew') else None
    school_cov=coverage_percent(grid,features,'schools',WALK_10_MIN_M)
    kita_cov=coverage_percent(grid,features,'kitas',WALK_10_MIN_M)
    main_indicators={
      'school_coverage_percent': school_cov,
      'kita_coverage_percent': kita_cov,
      'commercial_area_m2_total': commercial_area_total_m2,
      'commercial_area_m2_per_1000_ew': commercial_area_m2_per_1000_ew,
    }
    optional_layers={
      'health_count': cat_counts.get('health_optional',0),
      'retail_count': cat_counts.get('retail_optional',0),
      'mobility_count': cat_counts.get('mobility_optional',0),
      'health_10min_proxy_percent': coverage_percent(grid,features,'health_optional',WALK_10_MIN_M),
      'retail_10min_proxy_percent': coverage_percent(grid,features,'retail_optional',WALK_10_MIN_M),
      'mobility_600m_proxy_percent': coverage_percent(grid,features,'mobility_optional',600),
    }
    status,msg=status_logic(name,main_indicators,boundary_ok,errors)
    return {
      'kommune':name,'lk':kommune.get('lk'),'einwohner':kommune.get('ew'),
      'method':'Sicht 10 nach manueller Methodik: Hauptindikatoren sind Schulabdeckung 10-Minuten-Fußweg, Kita-Abdeckung 10-Minuten-Fußweg und Gewerbefläche m²/1.000 EW. Gesundheit, Nahversorgung und ÖPNV werden nur optional angezeigt.',
      'coverage_note':'Die 10-Minuten-Erreichbarkeit wird aktuell als Raster-/Flächenproxy mit 800 m Radius approximiert. Für echte Bevölkerungsabdeckung kann später ein Zensus-100m-Bevölkerungsraster integriert werden.',
      'boundary_ok':boundary_ok,'boundary_meta':bmeta,'status':status,'status_message':msg,
      'main_indicators':main_indicators,
      'manual_benchmark':BENCHMARK_DIMENSIONS.get(name),
      'quality_ratios':{
        'school_coverage_ratio': compare_pct(school_cov,(BENCHMARK_DIMENSIONS.get(name) or {}).get('school_coverage_percent')),
        'kita_coverage_ratio': compare_pct(kita_cov,(BENCHMARK_DIMENSIONS.get(name) or {}).get('kita_coverage_percent')),
        'commercial_area_ratio': compare_pct(commercial_area_m2_per_1000_ew,(BENCHMARK_DIMENSIONS.get(name) or {}).get('commercial_area_m2_per_1000_ew')),
      },
      'category_counts':cat_counts,'category_raw_counts':cat_raw,
      'main_counts':{'schools':len(schools),'kitas':len(kitas),'commercial_area_objects':len(commercial)},
      'optional_layers':optional_layers,
      'grid_points_sampled':len(grid), 'category_errors':errors,
      'catchments':[{'feature_id':f.id,'name':f.name,'category':f.category,'lat':f.lat,'lng':f.lng,'radius_m':f.coverage_radius_m,'kind':'main_10min_walk_radius' if f.category in {'schools','kitas'} else 'optional_context_radius'} for f in features if f.coverage_radius_m and f.lat is not None and f.lng is not None],
      'points':[asdict(f) for f in features]
    }

def main():
    global KOMMUNEN, BENCHMARK_DIMENSIONS
    ap=argparse.ArgumentParser(); ap.add_argument('--kommune'); ap.add_argument('--out',default=str(OUT_FILE)); ap.add_argument('--debug',action='store_true'); ap.add_argument('--seed', default='data/kommunen_seed.json')
    args=ap.parse_args(); DATA_DIR.mkdir(exist_ok=True); CACHE_DIR.mkdir(parents=True,exist_ok=True)
    seed = load_seed(args.seed);
    if seed:
        loaded_kommunen = seed_kommunen(seed)
        loaded_benchmark = seed_benchmark_s10(seed)
        if loaded_kommunen: KOMMUNEN = loaded_kommunen
        if loaded_benchmark is not None: BENCHMARK_DIMENSIONS = loaded_benchmark
        log(f"Seed geladen: {len(KOMMUNEN)} Kommunen aus {args.seed}")
    targets=[kommune_by_name(args.kommune)] if args.kommune else KOMMUNEN; targets=[t for t in targets if t]
    log(f'KommunalSpiegel Sicht 10 · Backend v{VERSION}'); log(f'Ziel: {len(targets)} Kommune(n)')
    results=[]
    for k in targets:
        log('-'*72); results.append(sync_kommune(k,args.debug))
    output={'schema':SCHEMA,'version':VERSION,'source':'OpenStreetMap Overpass API','generated_at':datetime.now(timezone.utc).isoformat(),'api_status':'ok' if results else 'empty','kommunen':results}
    save_json(Path(args.out),output); log(f'✓ geschrieben: {args.out}')
if __name__=='__main__': main()
