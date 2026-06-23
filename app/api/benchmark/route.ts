import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fallbackAllScores, fallbackDetail, fallbackSyncLogs } from '@/lib/fallback-data'

const useFallback = () => !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('example') || !process.env.SUPABASE_SERVICE_ROLE_KEY

// GET /api/benchmark?alle=true&jahr=2024
// GET /api/benchmark?kommune=Leuna&jahr=2024
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const alle = searchParams.get('alle') === 'true'
  const kommuneName = searchParams.get('kommune')
  const jahr = Number(searchParams.get('jahr') || 2024)

  if (useFallback()) {
    if (alle) return NextResponse.json({ data: fallbackAllScores(jahr), jahr, liveStatus: fallbackSyncLogs()[0], fallback: true })
    if (!kommuneName) return NextResponse.json({ error: 'Parameter fehlt: kommune oder alle=true' }, { status: 400 })
    return NextResponse.json(fallbackDetail(kommuneName, jahr))
  }

  try {
    if (alle) {
      const { data, error } = await supabaseAdmin
        .from('scores')
        .select('*, kommune:kommunen(id, name, landkreis, einwohner, lat, lng)')
        .eq('erhebungsjahr', jahr)
        .order('score_gesamt', { ascending: false, nullsFirst: false })

      if (error) throw error
      if (!data || data.length === 0) {
        return NextResponse.json({ data: fallbackAllScores(jahr), jahr, liveStatus: fallbackSyncLogs()[0], fallback: true, hinweis: 'Supabase ist erreichbar, aber enthält keine Score-Daten. Fallback-Startbestand aktiv.' })
      }

      const { data: liveStatus } = await supabaseAdmin
        .from('sync_log')
        .select('synced_at, kommunen_count, fehler_count, dauer_ms')
        .order('synced_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return NextResponse.json({ data: data || [], jahr, liveStatus: liveStatus || null, fallback: false })
    }

    if (!kommuneName) return NextResponse.json({ error: 'Parameter fehlt: kommune oder alle=true' }, { status: 400 })

    const { data: kommune, error: kError } = await supabaseAdmin
      .from('kommunen')
      .select('*')
      .eq('name', kommuneName)
      .maybeSingle()

    if (kError) throw kError
    if (!kommune) return NextResponse.json(fallbackDetail(kommuneName, jahr))

    const [scoresRes, werteRes, massRes, liveRes, runsRes] = await Promise.all([
      supabaseAdmin.from('scores').select('*').eq('kommune_id', kommune.id).order('erhebungsjahr', { ascending: true }),
      supabaseAdmin.from('benchmark').select('*').eq('kommune_id', kommune.id).order('sicht_nr', { ascending: true }).order('updated_at', { ascending: false }),      supabaseAdmin.from('massnahmen').select('*').eq('kommune_id', kommune.id).order('zieldatum', { ascending: true, nullsFirst: false }),
      supabaseAdmin.from('live_cache').select('*').eq('kommune_id', kommune.id).maybeSingle(),
      supabaseAdmin.from('sync_log').select('*').order('synced_at', { ascending: false }).limit(5),
    ])

    for (const res of [scoresRes, werteRes, massRes, liveRes, runsRes]) if (res.error) throw res.error
    if (!scoresRes.data?.length || !werteRes.data?.length) return NextResponse.json(fallbackDetail(kommuneName, jahr))

    // Dédupliquer par sicht_nr — garder la valeur la plus récente
    const werteRaw = werteRes.data || []
    const werteMap = new Map<number, typeof werteRaw[0]>()
    for (const w of werteRaw) {
      const existing = werteMap.get(w.sicht_nr)
      if (!existing || new Date(w.updated_at) > new Date(existing.updated_at)) {
        werteMap.set(w.sicht_nr, w)
      }
    }
    const werte = Array.from(werteMap.values()).sort((a, b) => a.sicht_nr - b.sicht_nr)

    return NextResponse.json({ kommune, scores: scoresRes.data || [], werte, benchmark: werte, massnahmen: massRes.data || [], live: liveRes.data || null, sourceRuns: runsRes.data || [], fallback: false })

  } catch (error: any) {
    console.warn('API /api/benchmark nutzt Fallback:', error?.message)
    if (alle) return NextResponse.json({ data: fallbackAllScores(jahr), jahr, liveStatus: fallbackSyncLogs()[0], fallback: true, warning: error?.message })
    return NextResponse.json(fallbackDetail(kommuneName || 'Leuna', jahr))
  }
}
