/**
 * KommunalSpiegel — /api/sync
 *
 * Appelé par GitHub Actions chaque dimanche à 4h.
 * POST → lance le sync complet (collecte + écriture Supabase)
 * GET  → retourne les derniers logs de sync
 *
 * Logique en 2 passes pour S4 :
 *   Passe 1 → collecter toutes les valeurs brutes
 *   Passe 2 → calculer le max dynamiquement, puis normaliser et écrire
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  fetchLadeinfra,
  fetchOSMData,
  fetchBreitband,
  fetchMobilfunk,
  fetchOZGReifegrad,
  KOORDINATEN,
} from '@/lib/live-data'

// ── Sécurité ──────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${cronSecret}`
}

// ── Noms des kennzahlen ───────────────────────────────────────
const KENNZAHL_NAMEN: Record<number, string> = {
  2: 'Virtuelle Touren',
  4: 'Ladeinfrastruktur',
  5: 'Festnetz',
  6: 'Mobilfunk',
  7: 'Digitale Services',
}

// ── Normalisation des scores (0–10) ───────────────────────────
function normalizeScore(
  wert: number | null,
  sicht_nr: number,
  maxWerte: Record<number, number>,
  kommuneEinwohner?: number
): number | null {
  if (wert == null) return null

  switch (sicht_nr) {
    case 4: {
      // Ladepunkte / EW × 1000, normalisé par le max dynamique
      const ew = kommuneEinwohner ?? 10000
      const dichte = wert / ew * 1000
      const maxDichte = maxWerte[4] ?? 1
      return Math.min(10, Math.round(dichte / maxDichte * 10 * 10) / 10)
    }
    case 5: // Festnetz Mbit/s
      return Math.min(10, Math.round((wert / 1000) * 10 * 10) / 10)
    case 6: // Mobilfunk 4G %
      return Math.min(10, Math.round((wert / 100) * 10 * 10) / 10)
    case 7: // OZG Reifegrad Ø (0–4), normalisé dynamiquement
      return Math.min(10, Math.round((wert / (maxWerte[7] ?? wert)) * 10 * 10) / 10)
    default:
      return wert
  }
}

// ── POST : lancer le sync complet ─────────────────────────────
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const started = Date.now()

  // Récupérer toutes les communes
  const { data: kommunen, error: kErr } = await supabaseAdmin
    .from('kommunen')
    .select('*')
    .order('name')

  if (kErr || !kommunen?.length) {
    return NextResponse.json(
      { success: false, error: kErr?.message ?? 'Keine Kommunen gefunden' },
      { status: 500 }
    )
  }

  // ── PASSE 1 : collecter toutes les valeurs brutes ─────────────
  console.log('Passe 1: Daten sammeln...')
  const rohdaten: Record<number, {
    kommune: typeof kommunen[0]
    werte: Array<{ sicht_nr: number; wert: number | null; quelle: string; quelle_url: string }>
  }> = {}

  // Télécharger le JSON OZG une seule fois pour toutes les communes
  console.log('OZG-Daten laden...')
  let ozgRawData: any[] | null = null
  try {
    const ozgRes = await fetch(
      'https://ozg-monitoring.tpcluster.de/service/OzgOnlineServiceArea/st/getBusOsTree',
      { signal: AbortSignal.timeout(120000) }
    )
    const text = await ozgRes.text()
    ozgRawData = JSON.parse(text)
    console.log(`OZG-Daten geladen: ${ozgRawData!.length} Leistungen`)
  } catch (err) {
    console.error('OZG-Laden fehlgeschlagen:', err)
  }

  for (const k of kommunen) {
    const coords = KOORDINATEN[k.name]
    if (!coords) continue

    const [lade, osm, breitband, mobilfunk, ozg] = await Promise.allSettled([
      fetchLadeinfra(coords.lat, coords.lng, k.name),
      fetchOSMData(coords.lat, coords.lng, k.name),
      fetchBreitband(coords.lat, coords.lng),
      fetchMobilfunk(coords.lat, coords.lng),
      fetchOZGReifegrad(k.name, ozgRawData ?? undefined),
    ])

    const ladeData      = lade.status      === 'fulfilled' ? lade.value      : null
    const osmData       = osm.status       === 'fulfilled' ? osm.value       : null
    const breitbandData = breitband.status === 'fulfilled' ? breitband.value : null
    const mobilfunkData = mobilfunk.status === 'fulfilled' ? mobilfunk.value : null
    const ozgData       = ozg.status       === 'fulfilled' ? ozg.value       : null

    rohdaten[k.id] = {
      kommune: k,
      werte: [
        { sicht_nr: 2, wert: osmData?.tourism ?? null,         quelle: osmData?.source ?? 'OpenStreetMap',              quelle_url: 'https://overpass-api.de' },
        { sicht_nr: 4, wert: ladeData?.count ?? null,          quelle: ladeData?.source ?? 'Bundesnetzagentur',         quelle_url: 'https://www.bundesnetzagentur.de/ladesaeulenregister' },
        { sicht_nr: 5, wert: breitbandData?.download_max ?? null, quelle: breitbandData?.source ?? 'Bundesnetzagentur Breitbandatlas', quelle_url: 'https://breitbandatlas.de' },
        { sicht_nr: 6, wert: mobilfunkData?.abdeckung_4g ?? null, quelle: 'Bundesnetzagentur Mobilfunkatlas',           quelle_url: 'https://www.bundesnetzagentur.de/mobilfunk' },
        { sicht_nr: 7, wert: ozgData?.reifegrad_avg ?? null,   quelle: ozgData?.source ?? 'OZG-Monitoring Sachsen-Anhalt', quelle_url: 'https://ozg.zfinder.de/st' },
      ]
    }
  }

  // ── PASSE 2 : calculer les max dynamiques ─────────────────────
  console.log('Passe 2: Max berechnen...')
  const maxWerte: Record<number, number> = {}

  // Max pour S4 : densité Ladepunkte/1000EW
  const dichtenS4 = Object.values(rohdaten)
    .map(({ kommune, werte }) => {
      const w = werte.find(x => x.sicht_nr === 4)
      if (!w?.wert) return 0
      const ew = kommune.einwohner ?? 10000
      return w.wert / ew * 1000
    })
    .filter(d => d > 0)

  maxWerte[4] = dichtenS4.length > 0 ? Math.max(...dichtenS4) : 2.81
      // Max pour S7 : reifegrad_avg dynamique entre toutes les communes
    const valeursS7 = Object.values(rohdaten)
      .map(({ werte }) => werte.find(x => x.sicht_nr === 7)?.wert ?? 0)
      .filter(v => v > 0)
    maxWerte[7] = valeursS7.length > 0 ? Math.max(...valeursS7) : 1
    console.log(`   Max S7 (OZG Reifegrad): ${maxWerte[7].toFixed(4)}`)
  console.log(`   Max S4 (Ladepunkte/1000EW): ${maxWerte[4].toFixed(3)}`)

  // ── PASSE 3 : normaliser et écrire dans Supabase ──────────────
  console.log('Passe 3: Normalisieren und speichern...')
  const details = []
  let fehler = 0
  const jetzt = new Date().toISOString()

  for (const { kommune, werte } of Object.values(rohdaten)) {
    try {
      let updated = 0

      for (const w of werte) {
        if (w.wert == null) continue

        const score = normalizeScore(w.wert, w.sicht_nr, maxWerte, kommune.einwohner)
        const kennzahl = KENNZAHL_NAMEN[w.sicht_nr] ?? `Sicht ${w.sicht_nr} (live)`

        const { error } = await supabaseAdmin.from('benchmark').upsert(
          {
            kommune_id: kommune.id,
            sicht_nr: w.sicht_nr,
            kennzahl,
            wert_num: w.wert,
            score_normiert: score,
            erhebungsjahr: 2026, 
            quelle: w.quelle,
            quelle_url: w.quelle_url,
            quelle_typ: 'automatisch',
            letzter_abruf: jetzt,
            updated_at: jetzt,
          },
          { onConflict: 'kommune_id,sicht_nr,kennzahl,erhebungsjahr' }
        )
        if (!error) updated++
      }

      // Mise à jour du live_cache
      await supabaseAdmin.from('live_cache').upsert(
        {
          kommune_id: kommune.id,
          daten: {
            name: kommune.name,
            abgerufen: jetzt,
            sichten: werte.map(w => ({
              ...w,
              score: normalizeScore(w.wert, w.sicht_nr, maxWerte, kommune.einwohner),
            })),
          },
          abgerufen: jetzt,
        },
        { onConflict: 'kommune_id' }
      )

      details.push({
        kommune: kommune.name,
        status: 'ok',
        sichten_aktualisiert: updated,
        quellen: werte.filter(w => w.wert != null).map(w => `S${w.sicht_nr}`),
        max_s4: maxWerte[4]?.toFixed(3),
      })
    } catch (e: any) {
      fehler++
      details.push({ kommune: kommune.name, status: 'fehler', fehler: e.message })
    }
  }

  // Mise à jour du statut des sources
  await supabaseAdmin
    .from('datenquellen')
    .update({ letzter_abruf: jetzt, status: 'ok' })
    .in('name', [
      'Bundesnetzagentur Ladesäulen',
      'OpenStreetMap Overpass',
      'Bundesnetzagentur Breitbandatlas',
      'Bundesnetzagentur Mobilfunkatlas',
      'Dashboard Digitale Verwaltung/OZG',
    ])

  // Log dans sync_log
  const dauer_ms = Date.now() - started
  await supabaseAdmin.from('sync_log').insert({
    synced_at: jetzt,
    kommunen_count: Object.keys(rohdaten).length - fehler,
    fehler_count: fehler,
    dauer_ms,
    details,
  })

  return NextResponse.json({
    success: true,
    synced: Object.keys(rohdaten).length - fehler,
    fehler,
    dauer_ms,
    max_s4: maxWerte[4],
    details,
    fallback: false,
    message: `Sync abgeschlossen: ${Object.keys(rohdaten).length - fehler}/${kommunen.length} Kommunen aktualisiert`,
  })
}

// ── GET : derniers logs de sync ───────────────────────────────
export async function GET() {
  const { data: logs, error } = await supabaseAdmin
    .from('sync_log')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ logs, fallback: false })
}