import { NextRequest, NextResponse } from 'next/server'
import { createLiveStatus, fallbackAllScores, fallbackDetail } from '@/lib/fallback-data'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const kommuneName = searchParams.get('kommune') || 'Leuna'
  const alle = searchParams.get('alle')
  if (alle) {
    return NextResponse.json({
      scores: fallbackAllScores(2024),
      letzter_sync: new Date().toISOString(),
      quellen: createLiveStatus('alle Kommunen').quellen,
      fallback:true,
      hinweis:'Live-Quellen werden über Agentenlauf geprüft; Fallback-Startbestand bleibt immer verfügbar.'
    })
  }
  const detail = fallbackDetail(kommuneName, 2024)
  return NextResponse.json({ ...createLiveStatus(detail.kommune.name), gesamt: detail.scores[0].score_gesamt, fallback:true, abgerufen:new Date().toISOString() })
}
