/**
 * KommunalSpiegel — Seed-Script (3 Pilotkommunen)
 * Lädt die echten Benchmark-Daten der manuellen Erhebung Wintersemester 2025
 * für die 3 Pilotkommunen: Leuna, Querfurt, Bad Dürrenberg.
 *
 * Verwendung:
 *   node scripts/seed.js
 *
 * Voraussetzung: .env.local mit NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── 3 Pilotkommunen ──────────────────────────────────────────────
const KOMMUNEN_DATA = [
  { name: 'Leuna',          landkreis: 'Saalekreis', einwohner: 14131, lat: 51.31, lng: 12.00 },
  { name: 'Querfurt',       landkreis: 'Saalekreis', einwohner: 10007, lat: 51.38, lng: 11.60 },
  { name: 'Bad Dürrenberg', landkreis: 'Saalekreis', einwohner: 11521, lat: 51.29, lng: 12.06 },
]

// ── Benchmark-Werte: manuelle Erhebung Wintersemester 2025 ───────
// Quelle: Kennzahlentabelle der studentischen Erhebung.
// Jede Zeile = eine Kennzahl. sicht_nr 9 hat mehrere Teilkennzahlen,
// genauso sicht_nr 6, 7 und 10 — daher mehrere Zeilen pro Sicht möglich.
const BENCHMARK_DATA = {
  'Leuna': [
    { sicht_nr: 1,  kennzahl: 'Abdeckung der Sichten in Prozent',               wert_num: 7 },
    { sicht_nr: 2,  kennzahl: 'Anzahl Touren pro Tsd. Einwohner',                wert_num: 0.41 },
    { sicht_nr: 3,  kennzahl: 'Streetviewabdeckung in Prozent',                  wert_num: 93.01 },
    { sicht_nr: 4,  kennzahl: 'Ladeplätze pro Tsd. Einwohner für E-Autos',       wert_num: 3.59 },
    { sicht_nr: 5,  kennzahl: 'Mittelwert Festnetzempfang (Download) in Mbit/s', wert_num: 447.67 },
    { sicht_nr: 6,  kennzahl: 'Mittelwert Mobilfunkempfang O2',                  wert_num: -90.4 },
    { sicht_nr: 6,  kennzahl: 'Mittelwert Mobilfunkempfang Vodafone',            wert_num: -95.99 },
    { sicht_nr: 6,  kennzahl: 'Mittelwert Mobilfunkempfang Telekom',             wert_num: -81.86 },
    { sicht_nr: 7,  kennzahl: 'Reifegrad-Mittelwert',                            wert_num: 3.24 },
    { sicht_nr: 7,  kennzahl: 'Prozentanteil ab Stufe 2',                        wert_num: 84.85 },
    { sicht_nr: 8,  kennzahl: 'Kanaldichte',                                     wert_num: 5.66 },
    { sicht_nr: 9,  kennzahl: 'Anzahl Akteure (Knoten)',                         wert_num: 87 },
    { sicht_nr: 9,  kennzahl: 'Anzahl Verbindungen (Kanten)',                    wert_num: 798 },
    { sicht_nr: 9,  kennzahl: 'density',                                        wert_num: 0.213 },
    { sicht_nr: 9,  kennzahl: 'global clustering',                              wert_num: 74.00 },
    { sicht_nr: 9,  kennzahl: 'average path length',                            wert_num: 2.05 },
    { sicht_nr: 9,  kennzahl: 'Robustheit-Index',                               wert_num: 0.23 },
    { sicht_nr: 10, kennzahl: 'Schulen',                                        wert_num: 6.87 },
    { sicht_nr: 10, kennzahl: 'Kitas',                                          wert_num: 9.45 },
    { sicht_nr: 10, kennzahl: 'Gewerbegebiet pro Tsd EW (m2)',                  wert_num: 646941 },
  ],
  'Querfurt': [
    { sicht_nr: 1,  kennzahl: 'Abdeckung der Sichten in Prozent',               wert_num: 8 },
    { sicht_nr: 2,  kennzahl: 'Anzahl Touren pro Tsd. Einwohner',                wert_num: 0.40 },
    { sicht_nr: 3,  kennzahl: 'Streetviewabdeckung in Prozent',                  wert_num: 87.27 },
    { sicht_nr: 4,  kennzahl: 'Ladeplätze pro Tsd. Einwohner für E-Autos',       wert_num: 0.504 },
    { sicht_nr: 5,  kennzahl: 'Mittelwert Festnetzempfang (Download) in Mbit/s', wert_num: 576.70 },
    { sicht_nr: 6,  kennzahl: 'Mittelwert Mobilfunkempfang O2',                  wert_num: -81.70 },
    { sicht_nr: 6,  kennzahl: 'Mittelwert Mobilfunkempfang Vodafone',            wert_num: -69.60 },
    { sicht_nr: 6,  kennzahl: 'Mittelwert Mobilfunkempfang Telekom',             wert_num: -73.30 },
    { sicht_nr: 7,  kennzahl: 'Reifegrad-Mittelwert',                            wert_num: 1.5 },
    { sicht_nr: 7,  kennzahl: 'Prozentanteil ab Stufe 2',                        wert_num: 50.00 },
    { sicht_nr: 8,  kennzahl: 'Kanaldichte',                                     wert_num: 0.7 },
    { sicht_nr: 9,  kennzahl: 'Anzahl Akteure (Knoten)',                         wert_num: 20 },
    { sicht_nr: 9,  kennzahl: 'Anzahl Verbindungen (Kanten)',                    wert_num: 82 },
    { sicht_nr: 9,  kennzahl: 'density',                                        wert_num: 0.4315 },
    { sicht_nr: 9,  kennzahl: 'global clustering',                              wert_num: 81.40 },
    { sicht_nr: 9,  kennzahl: 'average path length',                            wert_num: 1.92 },
    { sicht_nr: 9,  kennzahl: 'Robustheit-Index',                               wert_num: 0.35 },
    { sicht_nr: 10, kennzahl: 'Schulen',                                        wert_num: 2.89 },
    { sicht_nr: 10, kennzahl: 'Kitas',                                          wert_num: 5.37 },
    { sicht_nr: 10, kennzahl: 'Gewerbegebiet pro Tsd EW (m2)',                  wert_num: 149673 },
  ],
  'Bad Dürrenberg': [
    { sicht_nr: 1,  kennzahl: 'Abdeckung der Sichten in Prozent',               wert_num: 3 },
    { sicht_nr: 2,  kennzahl: 'Anzahl Touren pro Tsd. Einwohner',                wert_num: 0.61 },
    { sicht_nr: 3,  kennzahl: 'Streetviewabdeckung in Prozent',                  wert_num: 85.66 },
    { sicht_nr: 4,  kennzahl: 'Ladeplätze pro Tsd. Einwohner für E-Autos',       wert_num: 2.95 },
    { sicht_nr: 5,  kennzahl: 'Mittelwert Festnetzempfang (Download) in Mbit/s', wert_num: 432.14 },
    { sicht_nr: 6,  kennzahl: 'Mittelwert Mobilfunkempfang O2',                  wert_num: -90.11 },
    { sicht_nr: 6,  kennzahl: 'Mittelwert Mobilfunkempfang Vodafone',            wert_num: -98.29 },
    { sicht_nr: 6,  kennzahl: 'Mittelwert Mobilfunkempfang Telekom',             wert_num: -95.93 },
    { sicht_nr: 7,  kennzahl: 'Reifegrad-Mittelwert',                            wert_num: 0.571 },
    { sicht_nr: 7,  kennzahl: 'Prozentanteil ab Stufe 2',                        wert_num: 0.00 },
    { sicht_nr: 8,  kennzahl: 'Kanaldichte',                                     wert_num: 3.30 },
    { sicht_nr: 9,  kennzahl: 'Anzahl Akteure (Knoten)',                         wert_num: 327 },
    { sicht_nr: 9,  kennzahl: 'Anzahl Verbindungen (Kanten)',                    wert_num: 2019 },
    { sicht_nr: 9,  kennzahl: 'density',                                        wert_num: 0.038 },
    { sicht_nr: 9,  kennzahl: 'global clustering',                              wert_num: 79.40 },
    { sicht_nr: 9,  kennzahl: 'average path length',                            wert_num: null }, // Quelle: "-"
    { sicht_nr: 9,  kennzahl: 'Robustheit-Index',                               wert_num: 0 },
    { sicht_nr: 10, kennzahl: 'Schulen',                                        wert_num: 10.85 },
    { sicht_nr: 10, kennzahl: 'Kitas',                                          wert_num: 11.25 },
    { sicht_nr: 10, kennzahl: 'Gewerbegebiet pro Tsd EW (m2)',                  wert_num: 146471 },
  ],
}

async function seed() {
  console.log('KommunalSpiegel Seed (3 Pilotkommunen) wird gestartet...\n')

  // 1. Kommunen einfügen/aktualisieren
  console.log('1. Kommunen einfügen...')
  const { data: kommunen, error: kErr } = await supabase
    .from('kommunen')
    .upsert(KOMMUNEN_DATA, { onConflict: 'name', ignoreDuplicates: false })
    .select()
  if (kErr) { console.error('Kommunen Fehler:', kErr); return }
  console.log(`   ${kommunen.length} Kommunen eingefügt/aktualisiert`)

  // 2. Benchmark-Werte einfügen (score_normiert bleibt NULL — noch nicht normiert)
  console.log('2. Benchmark-Werte einfügen...')
  let wertCount = 0
  let wertFehler = 0

  for (const kommuneName of Object.keys(BENCHMARK_DATA)) {
    const k = kommunen.find(x => x.name === kommuneName)
    if (!k) {
      console.error(`   Kommune "${kommuneName}" nicht gefunden — überspringe`)
      continue
    }

    for (const row of BENCHMARK_DATA[kommuneName]) {
      const { error: wErr } = await supabase.from('benchmark').upsert({
        kommune_id: k.id,
        sicht_nr: row.sicht_nr,
        kennzahl: row.kennzahl,
        wert_num: row.wert_num,
        score_normiert: null,
        erhebungsjahr: 2025,
        quelle: 'Manuelle Erhebung Wintersemester 2025',
        quelle_typ: 'manuell',
      }, { onConflict: 'kommune_id,sicht_nr,kennzahl,erhebungsjahr' })
      if (wErr) { wertFehler++; console.error(`   Fehler bei ${kommuneName}/${row.kennzahl}:`, wErr.message) }
      else wertCount++
    }
  }
  console.log(`   ${wertCount} Benchmark-Werte eingefügt, ${wertFehler} Fehler`)

  console.log('\nSeed abgeschlossen!')
}

seed().catch(console.error)
