/**
 * KommunalSpiegel — API-Test Script
 * 
 * Testet alle Live-Datenquellen und zeigt Status
 * 
 * Ausführen: node scripts/test-apis.js
 */

const LEUNA = { lat: 51.3135, lng: 12.0014 }

const tests = [
  {
    name: 'Bundesnetzagentur — Ladesäulen ArcGIS',
    async fn() {
      const envelope = `${LEUNA.lng - 0.15},${LEUNA.lat - 0.1},${LEUNA.lng + 0.15},${LEUNA.lat + 0.1}`
      const url = `https://services.arcgis.com/R1nXjHtFYnPdSk7c/arcgis/rest/services/Ladesaeulen/FeatureServer/0/query?geometry=${encodeURIComponent(envelope)}&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&outFields=*&returnCountOnly=true&f=json`
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
      const d = await r.json()
      return { ok: d.count >= 0, detail: `${d.count} Ladepunkte im Umkreis` }
    }
  },
  {
    name: 'OpenStreetMap — Overpass API',
    async fn() {
      const delta = 0.05
      const bbox = `${LEUNA.lat-delta},${LEUNA.lng-delta},${LEUNA.lat+delta},${LEUNA.lng+delta}`
      const query = `[out:json][timeout:5];node["amenity"="charging_station"](${bbox});out count;`
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
      const d = await r.json()
      return { ok: true, detail: `${d.elements?.length ?? 0} Elemente gefunden` }
    }
  },
  {
    name: 'Bundesnetzagentur — Breitbandatlas',
    async fn() {
      const url = `https://maps.bundesnetzagentur.de/arcgis/rest/services/Breitbandatlas_2023/MapServer/0/query?geometry=${LEUNA.lng},${LEUNA.lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=download_max&returnGeometry=false&f=json`
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` }
      const d = await r.json()
      const max = d.features?.[0]?.attributes?.download_max
      return { ok: true, detail: max ? `${max} Mbit/s max` : 'Kein Wert' }
    }
  },
  {
    name: 'Bundesnetzagentur — Mobilfunkatlas',
    async fn() {
      const url = `https://maps.bundesnetzagentur.de/arcgis/rest/services/Mobilfunk/MapServer/0/query?geometry=${LEUNA.lng},${LEUNA.lat}&geometryType=esriGeometryPoint&inSR=4326&outFields=*&returnGeometry=false&f=json`
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` }
      const d = await r.json()
      return { ok: true, detail: d.features?.length > 0 ? `${d.features.length} Einträge` : 'Keine Daten' }
    }
  },
  {
    name: 'OZG-Dashboard — Sachsen-Anhalt',
    async fn() {
      const url = `https://dashboard.ozg-umsetzung.de/api/v1/states/Sachsen-Anhalt/leistungen`
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status} — kein direkter API-Zugang` }
      const d = await r.json()
      return { ok: true, detail: `${d.leistungen?.length ?? 0} Leistungen` }
    }
  },
]

async function main() {
  console.log('\nKommunalSpiegel — API-Test\n' + '='.repeat(50))
  
  for (const t of tests) {
    process.stdout.write(`  ${t.name}... `)
    try {
      const r = await t.fn()
      console.log(r.ok ? `✓ ${r.detail}` : `✗ ${r.detail}`)
    } catch (e) {
      console.log(`✗ Fehler: ${e.message}`)
    }
  }
  
  console.log('\n' + '='.repeat(50))
  console.log('Hinweis: APIs die ✗ zeigen werden mit Fallback-Werten aus eurer Erhebung ersetzt.')
  console.log('Das System funktioniert auch wenn externe APIs offline sind.\n')
}

main()
