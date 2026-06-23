/**
 * KommunalSpiegel — Live-/Perioden-Sync
 * Lädt externe Datenquellen soweit öffentlich erreichbar und speichert
 * Datenstand/Quellenstatus in Supabase. Basis-Benchmarkwerte bleiben erhalten.
 *
 * Ausführen: npm run live:sync
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey || supabaseUrl.includes('dein-projekt')) {
  console.error('Fehler: Supabase-URL oder Service-Role-Key fehlt in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

const PROGRAMME = [
  { id:'kfw-441', titel:'KfW / Bundesförderung Ladeinfrastruktur', anbieter:'KfW / Bund', sicht_nr:4, match_basis:0.95, max_foerderung:'abhängig vom aktuellen Aufruf', frist:'laufend/aufrufabhängig', url:'https://www.kfw.de', beschreibung:'Förderung für Ladeinfrastruktur und Elektromobilität. Besonders relevant bei niedriger Ladeinfrastruktur-Abdeckung.', tags:['Ladeinfrastruktur','E-Mobilität','Klimaschutz'] },
  { id:'smart-city-bmwsb', titel:'Smart Cities / Smarte Kommunen', anbieter:'BMWSB / Bund', sicht_nr:7, match_basis:0.88, max_foerderung:'aufrufabhängig', frist:'periodische Aufrufe', url:'https://www.bmwsb.bund.de', beschreibung:'Förderumfeld für digitale kommunale Strategien, Datenplattformen und Smart-City-Maßnahmen.', tags:['Smart City','Digitalisierung','Verwaltung'] },
  { id:'efre-st-breitband', titel:'EFRE Sachsen-Anhalt — digitale Infrastruktur', anbieter:'EU / Land Sachsen-Anhalt', sicht_nr:5, match_basis:0.78, max_foerderung:'programmspezifisch', frist:'Förderperiode / Aufruf', url:'https://europa.sachsen-anhalt.de', beschreibung:'EU-/Landesförderung für Infrastruktur, Digitalisierung und regionale Entwicklung.', tags:['EFRE','Breitband','Infrastruktur'] },
  { id:'bbsr-kleinstadt', titel:'BBSR Kleinstadtentwicklung / Stadtentwicklung', anbieter:'BBSR', sicht_nr:1, match_basis:0.82, max_foerderung:'aufrufabhängig', frist:'periodisch', url:'https://www.bbsr.bund.de', beschreibung:'Unterstützung für integrierte Stadtentwicklung, Konzepte und kommunale Transformationsprozesse.', tags:['IGEK','ISEK','Strategie'] },
  { id:'engagement-digital', titel:'Digitales Ehrenamt und Beteiligung', anbieter:'Bund/Land/Stiftungen', sicht_nr:8, match_basis:0.68, max_foerderung:'programmabhängig', frist:'laufend/periodisch', url:'https://www.foerderdatenbank.de', beschreibung:'Förderumfeld für digitale Beteiligung, Öffentlichkeitsarbeit und lokale Netzwerke.', tags:['Social Media','Beteiligung','Vernetzung'] },
  { id:'tourismus-digital', titel:'Digitale touristische Infrastruktur', anbieter:'Land / Bund / EU', sicht_nr:2, match_basis:0.64, max_foerderung:'programmabhängig', frist:'periodisch', url:'https://www.foerderdatenbank.de', beschreibung:'Mögliche Förderung für virtuelle Touren, digitale Orte und touristische Sichtbarkeit.', tags:['Tourismus','360°','Virtuelle Touren'] }
]

async function safeFetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'KommunalSpiegel/1.0' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchChargingCount(lat, lng) {
  const envelope = `${lng - 0.15},${lat - 0.1},${lng + 0.15},${lat + 0.1}`
  const url = 'https://services.arcgis.com/R1nXjHtFYnPdSk7c/arcgis/rest/services/Ladesaeulen/FeatureServer/0/query?' +
    `geometry=${encodeURIComponent(envelope)}&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&outFields=*&returnCountOnly=true&f=json`
  const data = await safeFetchJson(url)
  return Number.isFinite(data.count) ? data.count : null
}

async function buildLiveData(kommune, werte) {
  const jetzt = new Date().toISOString()
  const bySicht = {}
  for (const w of werte || []) bySicht[w.sicht_nr] = w

  let ladeCount = null
  let ladeStatus = 'fallback'
  if (kommune.lat && kommune.lng) {
    try {
      ladeCount = await fetchChargingCount(kommune.lat, kommune.lng)
      ladeStatus = 'ok'
    } catch (e) {
      ladeStatus = 'fallback'
    }
  }

  const sichten = Array.from({ length: 8 }, (_, i) => {
    const nr = i + 1
    const w = bySicht[nr]
    const liveValue = nr === 4 && ladeCount != null ? ladeCount : null
    return {
      sicht_nr: nr,
      name: w?.kennzahl || `Sicht ${nr}`,
      wert: liveValue ?? w?.wert_num ?? null,
      einheit: nr === 4 && liveValue != null ? 'Ladepunkte im Umkreis ca. 15 km' : 'Benchmark-Score / Periodenwert',
      quelle: nr === 4 && liveValue != null ? 'Bundesnetzagentur Ladesäulenregister' : (w?.quelle || 'Benchmark-Erhebung 2024 / Fallback'),
      quelle_url: nr === 4 ? 'https://www.bundesnetzagentur.de/ladesaeulenregister' : (w?.quelle_url || ''),
      abgerufen: jetzt,
      score: w?.score_normiert ?? null,
      status: nr === 4 ? ladeStatus : 'fallback'
    }
  })

  const scores = sichten.map(s => s.score).filter(v => v != null)
  const gesamt = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null

  return { name: kommune.name, lat: kommune.lat, lng: kommune.lng, sichten, gesamt, abgerufen: jetzt }
}

async function seedFundingPrograms() {
  const rows = PROGRAMME.map(p => ({
    ...p,
    quelle: process.env.FOERDER_API_URL ? 'Externe Förder-API / Fallback ergänzt' : 'Fallback-Liste, API vorbereitet',
    quelle_url: process.env.FOERDER_API_URL || 'https://www.foerderdatenbank.de',
    zuletzt_geprueft: new Date().toISOString(),
    aktiv: true,
  }))
  const { error } = await supabase.from('funding_programs').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

async function main() {
  const started = Date.now()
  console.log('KommunalSpiegel Live-/Perioden-Sync startet...')

  await seedFundingPrograms()
  console.log(`  ${PROGRAMME.length} Förderprogramme aktualisiert`)

  const { data: kommunen, error: kErr } = await supabase.from('kommunen').select('*').order('name')
  if (kErr) throw kErr
  if (!kommunen?.length) throw new Error('Keine Kommunen gefunden. Bitte zuerst npm run db:seed ausführen.')

  const details = []
  let fehler = 0
  for (const k of kommunen) {
    try {
      const { data: werte, error: wErr } = await supabase
        .from('benchmark')
        .select('*')
        .eq('kommune_id', k.id)
        .eq('erhebungsjahr', 2024)
      if (wErr) throw wErr

      const liveData = await buildLiveData(k, werte || [])
      const { error: upErr } = await supabase.from('live_cache').upsert({
        kommune_id: k.id,
        daten: liveData,
        abgerufen: new Date().toISOString(),
      }, { onConflict: 'kommune_id' })
      if (upErr) throw upErr
      details.push({ kommune: k.name, status: 'ok', gesamt: liveData.gesamt, sichten: liveData.sichten.length })
      process.stdout.write('.')
    } catch (e) {
      fehler++
      details.push({ kommune: k.name, status: 'fehler', fehler: e.message })
      process.stdout.write('x')
    }
  }
  console.log('')

  await supabase.from('datenquellen').update({ letzter_abruf: new Date().toISOString(), status: 'ok' }).in('name', [
    'Bundesnetzagentur Ladesäulen', 'Förderprogramme'
  ])
  await supabase.from('datenquellen').update({ letzter_abruf: new Date().toISOString(), status: 'fallback' }).in('name', [
    'Manuelle Erhebung IGEK/ISEK', 'Streetview/360 manuelle Prüfung', 'Manuelle Erhebung Social Media'
  ])

  const { error: logErr } = await supabase.from('sync_log').insert({
    synced_at: new Date().toISOString(),
    kommunen_count: kommunen.length - fehler,
    fehler_count: fehler,
    dauer_ms: Date.now() - started,
    details,
  })
  if (logErr) throw logErr

  console.log(`Live-Sync abgeschlossen: ${kommunen.length - fehler} ok, ${fehler} Fehler, ${Date.now() - started} ms`)
}

main().catch(e => {
  console.error('Live-Sync Fehler:', e)
  process.exit(1)
})
