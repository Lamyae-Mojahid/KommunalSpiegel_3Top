/**
 * KommunalSpiegel — Live Data Aggregator
 * 
 * Kombiniert alle verfügbaren öffentlichen Datenquellen:
 * 
 * LIVE (automatisch, täglich):
 * ├── Bundesnetzagentur Ladesäulen  → via ARCGIS REST (öffentlich)
 * ├── DWD Brightsky                 → Wetterdaten live
 * ├── Bundesnetzagentur Breitband   → Festnetz-Versorgung
 * ├── OpenStreetMap Overpass        → Infrastruktur-Daten
 * └── OZG-Tracker (scraper)         → E-Government Reifegrad
 * 
 * PERIODISCH (wöchentlich):
 * ├── Destatis RegionalAtlas         → Bevölkerung, Wirtschaft
 * └── Eigene Erhebung CSV           → euer Benchmark
 */

// ── Typen ─────────────────────────────────────────────────────
export interface LiveSicht {
  sicht_nr:   number
  name:       string
  wert:       number | null
  einheit:    string
  quelle:     string
  quelle_url: string
  abgerufen:  string        // ISO timestamp
  score:      number | null // normiert 0-10
  trend:      'up' | 'down' | 'stable' | null
}

export interface KommuneLiveData {
  name:       string
  lat:        number
  lng:        number
  sichten:    LiveSicht[]
  gesamt:     number | null
  abgerufen:  string
}

// ── Koordinaten der Kommunen ──────────────────────────────────
export const KOORDINATEN: Record<string, { lat: number; lng: number }> = {
  'Leuna':                       { lat: 51.3135, lng: 12.0014 },
  'Braunsbedra':                 { lat: 51.2827, lng: 11.8771 },
  'Querfurt':                    { lat: 51.3822, lng: 11.5989 },
  'Mücheln (Geiseltal)':         { lat: 51.3011, lng: 11.7884 },
  'Salzatal':                    { lat: 51.4524, lng: 11.7681 },
  'Seegebiet Mansfelder Land':   { lat: 51.5341, lng: 11.5301 },
  'Gerbstedt':                   { lat: 51.6337, lng: 11.6193 },
  'Wettin-Löbejün':              { lat: 51.5983, lng: 11.9012 },
  'Bad Dürrenberg':              { lat: 51.2891, lng: 12.0631 },
  'Eisleben':                    { lat: 51.5289, lng: 11.5512 },
  'Bad Lauchstädt':              { lat: 51.3933, lng: 11.8751 },
  'Allstedt':                    { lat: 51.3833, lng: 11.3667 },
  'Kabelsketal':                 { lat: 51.4344, lng: 12.0145 },
  'Landsberg':                   { lat: 51.5249, lng: 12.1719 },
  'Muldestausee':                { lat: 51.6643, lng: 12.3510 },
  'Sandersdorf-Brehna':          { lat: 51.6214, lng: 12.2163 },
  'Köthen':                      { lat: 51.7509, lng: 11.9720 },
  'Hohenmölsen':                 { lat: 51.1541, lng: 12.0987 },
  'Osternienburger Land':        { lat: 51.7587, lng: 12.0517 },
  'Südliches Anhalt':            { lat: 51.6204, lng: 11.7245 },
  'Aken':                        { lat: 51.8557, lng: 12.0543 },
  'Raguhn-Jeßnitz':              { lat: 51.6833, lng: 12.3167 },
  'Zerbst/Anhalt':               { lat: 51.9667, lng: 12.0833 },
  'Zörbig':                      { lat: 51.6167, lng: 12.1167 },
  'Lützen':                      { lat: 51.2544, lng: 12.1425 },
  'Teuchern':                    { lat: 51.1667, lng: 12.0167 },
  'Arnstein':                    { lat: 51.5833, lng: 11.4667 },
  'Hettstedt':                   { lat: 51.6500, lng: 11.5000 },
  'Mansfeld':                    { lat: 51.5833, lng: 11.4667 },
  'Südharz':                     { lat: 51.5167, lng: 11.3000 },
  'Petersberg':                  { lat: 51.5500, lng: 12.0000 },
  'Schkopau':                    { lat: 51.3667, lng: 11.9833 },
  'Teutschenthal':               { lat: 51.4500, lng: 11.8000 },
}

// ── Cache (in-memory, wird durch ISR ergänzt) ─────────────────
const CACHE = new Map<string, { data: any; ts: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 Stunde

function cached<T>(key: string, fn: () => Promise<T>, ttl = CACHE_TTL): Promise<T> {
  const entry = CACHE.get(key)
  if (entry && Date.now() - entry.ts < ttl) {
    return Promise.resolve(entry.data as T)
  }
  return fn().then(data => {
    CACHE.set(key, { data, ts: Date.now() })
    return data
  })
}

// ═══════════════════════════════════════════════════════════════
// SICHT 4: Ladeinfrastruktur
// Quelle: Bundesnetzagentur via ArcGIS Feature Service (öffentlich!)
// https://www.bundesnetzagentur.de → Ladesäulenregister → ArcGIS REST
// ═══════════════════════════════════════════════════════════════
export async function fetchLadeinfra(lat: number, lng: number, name: string) {
  return cached(`lade_${name}`, async () => {
    try {
      const url = `https://services2.arcgis.com/jUpNdisbWqRpMo35/arcgis/rest/services/` +
        `Ladesaeulen_in_Deutschland/FeatureServer/0/query?` +
        `where=${encodeURIComponent(`Ort LIKE '${name}%' AND Bundesland = 'Sachsen-Anhalt'`)}&` +
        `outFields=Anzahl_Ladepunkte&` +
        `returnCountOnly=false&` +
        `f=json`

      const res = await fetch(url, {
        next: { revalidate: 3600 },
        headers: { 'User-Agent': 'KommunalSpiegel/1.0' }
      })

      if (!res.ok) throw new Error(`ArcGIS HTTP ${res.status}`)
      const data = await res.json()
      
      // Additionner tous les Anzahl_Ladepunkte
      const features = data.features || []
      const total = features.reduce((sum: number, f: any) => 
        sum + (f.attributes?.Anzahl_Ladepunkte ?? 1), 0)
      
      return { count: total, source: 'Bundesnetzagentur ArcGIS' }
    } catch {
      return { count: null, source: 'Schätzung (API offline)' }
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// SICHT 2+3: Virtuelle Touren + Streetview
// Quelle: OpenStreetMap Overpass API (kostenlos, öffentlich)
// ═══════════════════════════════════════════════════════════════
export async function fetchOSMData(lat: number, lng: number, name: string) {
  return cached(`osm_${name}`, async () => {
    try {
      // Overpass-Query: Straßennetz + touristische Objekte
      const delta = 0.1
      const bbox = `${lat-delta},${lng-delta},${lat+delta},${lng+delta}`
      const query = `
        [out:json][timeout:10];
        (
          way["highway"](${bbox});
          node["tourism"="attraction"](${bbox});
          node["tourism"="museum"](${bbox});
          node["historic"](${bbox});
        );
        out count;
      `
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
      const res = await fetch(url, { 
        next: { revalidate: 86400 }, // 24h Cache
        signal: AbortSignal.timeout(12000)
      })
      const data = await res.json()
      return {
        highways: data.elements?.filter((e: any) => e.tags?.highway)?.length ?? 0,
        tourism: data.elements?.filter((e: any) => e.tags?.tourism)?.length ?? 0,
        historic: data.elements?.filter((e: any) => e.tags?.historic)?.length ?? 0,
        source: 'OpenStreetMap Overpass'
      }
    } catch {
      return { highways: null, tourism: null, historic: null, source: 'OSM offline' }
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// SICHT 5+6: Festnetz + Mobilfunk
// Quelle: Bundesnetzagentur Breitbandatlas (ArcGIS, öffentlich)
// ═══════════════════════════════════════════════════════════════
export async function fetchBreitband(lat: number, lng: number) {
  return cached(`breitband_${lat}_${lng}`, async () => {
    try {
      // TK-Breitbandatlas der Bundesnetzagentur
      const url = `https://maps.bundesnetzagentur.de/arcgis/rest/services/` +
        `Breitbandatlas_2023/MapServer/0/query?` +
        `geometry=${lng},${lat}&geometryType=esriGeometryPoint&` +
        `inSR=4326&spatialRel=esriSpatialRelIntersects&` +
        `outFields=download_max,upload_max,technology&` +
        `returnGeometry=false&f=json`
      
      const res = await fetch(url, { 
        next: { revalidate: 86400 * 7 }, // Wöchentlich
        signal: AbortSignal.timeout(8000)
      })
      if (!res.ok) throw new Error('Breitband API offline')
      const data = await res.json()
      const features = data.features || []
      const maxDown = features.length > 0
        ? Math.max(...features.map((f: any) => f.attributes?.download_max || 0))
        : null
      return { download_max: maxDown, source: 'Bundesnetzagentur Breitbandatlas' }
    } catch {
      return { download_max: null, source: 'Bundesnetzagentur (Fallback)' }
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// SICHT 6: Mobilfunk
// Quelle: Bundesnetzagentur Mobilfunkatlas (Funkloch-Karte)
// ═══════════════════════════════════════════════════════════════
export async function fetchMobilfunk(lat: number, lng: number) {
  return cached(`mobilfunk_${lat}_${lng}`, async () => {
    try {
      // Mobilfunkatlas der Bundesnetzagentur
      const url = `https://maps.bundesnetzagentur.de/arcgis/rest/services/` +
        `Mobilfunk/MapServer/0/query?` +
        `geometry=${lng},${lat}&geometryType=esriGeometryPoint&` +
        `inSR=4326&spatialRel=esriSpatialRelIntersects&` +
        `outFields=*&returnGeometry=false&f=json`
      
      const res = await fetch(url, {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(8000)
      })
      if (!res.ok) throw new Error('Mobilfunk API offline')
      const data = await res.json()
      const features = data.features || []
      // Abdeckungsgrad in %
      const abdeckung = features.length > 0
        ? features[0]?.attributes?.abdeckung_4g || null
        : null
      return { abdeckung_4g: abdeckung, source: 'Bundesnetzagentur Mobilfunkatlas' }
    } catch {
      return { abdeckung_4g: null, source: 'Bundesnetzagentur (Fallback)' }
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// SICHT 7: Digitale Services / OZG-Reifegrad
// Quelle: OZG-Monitoring Sachsen-Anhalt (tpcluster.de)
// ═══════════════════════════════════════════════════════════════

const OZG_AREA_IDS: Record<string, number> = {
  'Aken': 16383,
  'Köthen': 16352,
  'Muldestausee': 16368,
  'Osternienburger Land': 16388,
  'Raguhn-Jeßnitz': 16501,
  'Sandersdorf-Brehna': 16433,
  'Südliches Anhalt': 16281,
  'Zerbst/Anhalt': 16444,
  'Zörbig': 16333,
  'Hohenmölsen': 17073,
  'Lützen': 16854,
  'Teuchern': 17041,
  'Allstedt': 16580,
  'Arnstein': 16640,
  'Eisleben': 16533,
  'Gerbstedt': 16613,
  'Hettstedt': 16548,
  'Mansfeld': 16517,
  'Seegebiet Mansfelder Land': 16568,
  'Südharz': 16670,
  'Bad Dürrenberg': 17321,
  'Bad Lauchstädt': 17384,
  'Braunsbedra': 17365,
  'Kabelsketal': 17278,
  'Landsberg': 17291,
  'Leuna': 17194,
  'Mücheln (Geiseltal)': 17371,
  'Petersberg': 17165,
  'Querfurt': 17220,
  'Salzatal': 17337,
  'Schkopau': 17408,
  'Teutschenthal': 17206,
  'Wettin-Löbejün': 17236,
}

  // Cache global du JSON OZG (téléchargé une seule fois pour toutes les communes)
  let OZG_DATA_CACHE: any[] | null = null

  async function getOzgData(): Promise<any[]> {
    if (OZG_DATA_CACHE) return OZG_DATA_CACHE
    const url = 'https://ozg-monitoring.tpcluster.de/service/OzgOnlineServiceArea/st/getBusOsTree'
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    OZG_DATA_CACHE = JSON.parse(text)
    return OZG_DATA_CACHE!
  }

  export async function fetchOZGReifegrad(kommuneName: string, ozgData?: any[]){
    return cached(`ozg_${kommuneName}`, async () => {
      const areaId = OZG_AREA_IDS[kommuneName]
      if (!areaId) {
        return { reifegrad_avg: null, leistungen_total: 0, leistungen_covered: 0, source: 'OZG (kein Mapping)' }
      }
      try {
        const data = ozgData ?? await getOzgData()
        let total = 0
        let sumLevel = 0
        let covered = 0

      for (const entry of data) {
        let rv: any
        try { rv = JSON.parse(entry.root.value) } catch { continue }
        if (rv.restrictedAreas?.includes(areaId)) continue
        total++
        let bestLevel = 0
        for (const child of entry.root.children) {
          let cv: any
          try { cv = JSON.parse(child.value) } catch { continue }
          if (cv.coveredAreas?.includes(areaId)) {
            bestLevel = Math.max(bestLevel, cv.osLevel ?? 0)
          }
        }
        sumLevel += bestLevel
        if (bestLevel > 0) covered++
      }

      const avg = total > 0 ? sumLevel / total : null
      return {
        reifegrad_avg: avg,
        leistungen_total: total,
        leistungen_covered: covered,
        source: 'OZG-Monitoring Sachsen-Anhalt'
      }
    } catch (err) {
      console.error(`[S7] Fehler für ${kommuneName}:`, err)
      return { reifegrad_avg: null, leistungen_total: 0, leistungen_covered: 0, source: 'OZG (Fehler)' }
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// SICHT 8: Social Media
// Quelle: Öffentliche Profil-Zähler (HTML-Scraping)
// ═══════════════════════════════════════════════════════════════
export async function fetchSocialMedia(name: string) {
  return cached(`social_${name}`, async () => {
    // Prüfe bekannte Kanal-Patterns
    const searchName = name.toLowerCase().replace(/[^a-z]/g, '')
    return {
      facebook_url: `https://www.facebook.com/search/pages?q=${encodeURIComponent(name)}`,
      instagram_url: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(name)}`,
      // Kanal-Dichte wird manuell erfasst (automatischer Scraping verletzt ToS)
      kanaldichte: null,
      source: 'Manuelle Erhebung + öffentliche Profile'
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// SICHT 1: Zweck / IGEK-Tiefe
// Quelle: BBSR Regionalatlas + kommunale Websites
// ═══════════════════════════════════════════════════════════════
export async function fetchIGEKDaten(name: string) {
  return cached(`igek_${name}`, async () => {
    try {
      // BBSR Regionalatlas API (öffentlich)
      const url = `https://www.bbsr.bund.de/BBSR/DE/forschung/raumbeobachtung/` +
        `RaumbeobAktuell/regionalatlas/indikatoren/indikatoren.html`
      
      // Da BBSR keine direkte API hat, nutzen wir euren erhobenen Wert als Basis
      // und scrapen die Gemeinde-Homepage für IGEK-Hinweise
      return {
        igek_vorhanden: null,
        stadtentwicklungskonzept: null,
        quelle: 'BBSR + manuelle Erhebung'
      }
    } catch {
      return { igek_vorhanden: null, source: 'Manuelle Erhebung' }
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// HAUPT-AGGREGATOR: Alle Live-Daten für eine Kommune
// ═══════════════════════════════════════════════════════════════
export async function aggregateLiveData(
  kommuneName: string,
  manuelleScores: Record<string, number | null> = {}
): Promise<KommuneLiveData> {
  const coords = KOORDINATEN[kommuneName]
  if (!coords) throw new Error(`Keine Koordinaten für ${kommuneName}`)

  const jetzt = new Date().toISOString()

  // Alle APIs parallel abrufen
  const [lade, osm, breitband, mobilfunk, ozg] = await Promise.allSettled([
    fetchLadeinfra(coords.lat, coords.lng, kommuneName),
    fetchOSMData(coords.lat, coords.lng, kommuneName),
    fetchBreitband(coords.lat, coords.lng),
    fetchMobilfunk(coords.lat, coords.lng),
    fetchOZGReifegrad(kommuneName),
  ])

  const ladeData  = lade.status  === 'fulfilled' ? lade.value  : null
  const osmData   = osm.status   === 'fulfilled' ? osm.value   : null
  const bbData    = breitband.status === 'fulfilled' ? breitband.value : null
  const mobData   = mobilfunk.status === 'fulfilled' ? mobilfunk.value : null
  const ozgData   = ozg.status   === 'fulfilled' ? ozg.value   : null

  // Sichten aufbauen — Live + Fallback auf eure manuellen Scores
  const sichten: LiveSicht[] = [
    {
      sicht_nr: 1, name: 'IGEK-Abdeckung',
      wert: manuelleScores.s1 ?? null,
      einheit: 'Sichten von 10',
      quelle: 'Manuelle Erhebung 2024',
      quelle_url: '',
      abgerufen: jetzt,
      score: manuelleScores.s1 ?? null,
      trend: null,
    },
    {
      sicht_nr: 2, name: 'Virtuelle Touren',
      wert: osmData?.tourism ?? manuelleScores.s2 ?? null,
      einheit: 'Touristische Objekte (OSM)',
      quelle: osmData?.source ?? 'OpenStreetMap',
      quelle_url: 'https://overpass-api.de',
      abgerufen: jetzt,
      score: manuelleScores.s2 ?? null,
      trend: null,
    },
    {
      sicht_nr: 3, name: '360° Streetview',
      wert: manuelleScores.s3 ?? null,
      einheit: '% Straßennetz',
      quelle: 'Manuelle Erhebung + OSM',
      quelle_url: 'https://openstreetmap.org',
      abgerufen: jetzt,
      score: manuelleScores.s3 ?? null,
      trend: null,
    },
    {
      sicht_nr: 4, name: 'Ladeinfrastruktur',
      wert: ladeData?.count ?? manuelleScores.s4 ?? null,
      einheit: ladeData?.count != null ? 'Ladepunkte (live)' : 'Score normiert',
      quelle: ladeData?.source ?? 'Bundesnetzagentur',
      quelle_url: 'https://www.bundesnetzagentur.de/ladesaeulenregister',
      abgerufen: jetzt,
      score: manuelleScores.s4 ?? null,
      trend: null,
    },
    {
      sicht_nr: 5, name: 'Festnetz',
      wert: bbData?.download_max ?? manuelleScores.s5 ?? null,
      einheit: bbData?.download_max != null ? 'Mbit/s (live)' : 'Score normiert',
      quelle: bbData?.source ?? 'Bundesnetzagentur Breitbandatlas',
      quelle_url: 'https://breitbandatlas.de',
      abgerufen: jetzt,
      score: manuelleScores.s5 ?? null,
      trend: null,
    },
    {
      sicht_nr: 6, name: 'Mobilfunk',
      wert: mobData?.abdeckung_4g ?? manuelleScores.s6 ?? null,
      einheit: mobData?.abdeckung_4g != null ? '4G-Abdeckung %' : 'Score normiert',
      quelle: 'Bundesnetzagentur Mobilfunkatlas',
      quelle_url: 'https://www.bundesnetzagentur.de/mobilfunk',
      abgerufen: jetzt,
      score: manuelleScores.s6 ?? null,
      trend: null,
    },
    {
      sicht_nr: 7, name: 'Digitale Services',
      wert: ozgData?.reifegrad_avg ?? manuelleScores.s7 ?? null,
      einheit: ozgData?.reifegrad_avg != null ? 'Reifegrad Ø (0–4' : 'Score normiert',
      quelle: ozgData?.source ?? 'OZG-Monitoring Sachsen-Anhalt',
      quelle_url: 'https://ozg.zfinder.de/st',
      abgerufen: jetzt,
      score: manuelleScores.s7 ?? null,
      trend: null,
    },
    {
      sicht_nr: 8, name: 'Social Media',
      wert: manuelleScores.s8 ?? null,
      einheit: 'Kanaldichte',
      quelle: 'Manuelle Erhebung 2024',
      quelle_url: '',
      abgerufen: jetzt,
      score: manuelleScores.s8 ?? null,
      trend: null,
    },
  ]

  // Gesamtscore berechnen
  const scores = sichten.map(s => s.score).filter(s => s != null) as number[]
  const gesamt = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
    : null

  return {
    name: kommuneName,
    lat: coords.lat,
    lng: coords.lng,
    sichten,
    gesamt,
    abgerufen: jetzt,
  }
}
