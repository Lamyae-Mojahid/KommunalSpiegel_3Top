import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { FOERDER_FALLBACK, fallbackDetail } from '@/lib/fallback-data'

const useFallback = () => !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('example') || !process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const kommune = searchParams.get('kommune') || 'Leuna'
  const sichtFilter = searchParams.get('sicht')

  async function fallbackResponse() {
    const detail = fallbackDetail(kommune, 2024)
    const werte = detail.werte || []
    let foerder = FOERDER_FALLBACK.map((f: any) => {
      const sichtWert = werte.find((w: any) => w.sicht_nr === f.sicht_nr)
      const gap = sichtWert ? (10 - (sichtWert.score_normiert || 0)) / 10 : 0.5
      const match = Math.round((f.match_basis * 0.55 + gap * 0.45) * 100)
      return { ...f, desc: f.beschreibung, match: Math.min(99, Math.max(10, match)), quelle:'Fallback-Förderkatalog' }
    }).sort((a:any,b:any)=>(b.match||0)-(a.match||0))
    if (sichtFilter) foerder = foerder.filter((f:any)=>f.sicht_nr === Number(sichtFilter))
    return NextResponse.json({ foerder, quelle:'fallback', fallback:true })
  }

  if (useFallback()) return fallbackResponse()

  try {
    const { data: dbPrograms, error } = await supabaseAdmin.from('funding_programs').select('*').eq('aktiv', true)
    if (error) throw error
    let foerder = (dbPrograms?.length ? dbPrograms : FOERDER_FALLBACK).map((p: any) => ({
      id:p.id, titel:p.titel, anbieter:p.anbieter, sicht_nr:p.sicht_nr, match_basis:p.match_basis ?? .6,
      max_foerderung:p.max_foerderung, frist:p.frist, url:p.url, desc:p.beschreibung || p.desc || '', tags:p.tags || [], quelle:p.quelle || 'Fallback-Liste', zuletzt_geprueft:p.zuletzt_geprueft || null,
    }))
    const { data: k } = await supabaseAdmin.from('kommunen').select('id').eq('name', kommune).maybeSingle()
    const { data: werte } = k ? await supabaseAdmin.from('benchmark').select('sicht_nr, score_normiert').eq('kommune_id', k.id).eq('erhebungsjahr', 2024) : { data: [] as any[] }
    foerder = foerder.map((f:any)=>{ const w=werte?.find((x:any)=>x.sicht_nr===f.sicht_nr); const gap=w?(10-(w.score_normiert||0))/10:.5; return {...f, match:Math.min(99,Math.max(10,Math.round((f.match_basis*.55+gap*.45)*100)))}}).sort((a:any,b:any)=>(b.match||0)-(a.match||0))
    if (sichtFilter) foerder = foerder.filter((f:any)=>f.sicht_nr === Number(sichtFilter))
    return NextResponse.json({ foerder, quelle: dbPrograms?.length ? 'funding_programs' : 'fallback', fallback: !dbPrograms?.length })
  } catch(e:any) {
    return fallbackResponse()
  }
}
