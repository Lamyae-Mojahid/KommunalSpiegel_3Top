import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { fallbackAllScores, fallbackDetail, ampel, massnahmeTitel } from '@/lib/fallback-data'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'missing-key' })

function regelAntwort(frage:string, kommune:string) {
  const detail = fallbackDetail(kommune, 2024)
  const score = detail.scores[0]
  const werte = detail.werte
  const schwach = [...werte].sort((a,b)=>(a.score_normiert??99)-(b.score_normiert??99)).slice(0,3)
  const stark = [...werte].sort((a,b)=>(b.score_normiert??-1)-(a.score_normiert??-1)).slice(0,3)
  const a = ampel(score.score_gesamt)
  return `Automatisierte Auswertung für ${score.kommune.name}: Gesamtscore ${score.score_gesamt?.toFixed(1)}/10, Rang ${score.rang}/33, Status: ${a.label}.\n\nStärken: ${stark.map(w=>`${w.kennzahl} (${w.score_normiert?.toFixed(1)})`).join(', ')}.\n\nHandlungsbedarf: ${schwach.map(w=>`${w.kennzahl} (${w.score_normiert?.toFixed(1)})`).join(', ')}.\n\nEmpfohlene nächste Maßnahmen: ${schwach.map(w=>massnahmeTitel(w.sicht_nr)).join('; ')}.\n\nHinweis: Diese Antwort wurde regelbasiert erzeugt, weil keine produktive KI-API konfiguriert ist. Für eine Kommune ist das sogar wichtig: Die Empfehlung bleibt nachvollziehbar und muss fachlich freigegeben werden.`
}

export async function POST(req: NextRequest) {
  const { frage='', kommune='Leuna', verlauf=[] } = await req.json()
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'missing-key') {
    return NextResponse.json({ antwort: regelAntwort(frage, kommune), modus:'regelbasiert', fallback:true })
  }
  const alleScores = fallbackAllScores(2024)
  const detail = fallbackDetail(kommune, 2024)
  const benchmarkCtx = alleScores.map(s=>`${s.kommune.name}: Gesamt=${s.score_gesamt?.toFixed(1)}, Rang=${s.rang}, Strategie=${s.score_strategie?.toFixed(1)}, Plattform=${s.score_plattform?.toFixed(1)}, Netzwerk=${s.score_netzwerk?.toFixed(1)}`).join('\n')
  const sichtenCtx = detail.werte.map(w=>`Sicht ${w.sicht_nr}: ${w.kennzahl} Score ${w.score_normiert?.toFixed(1)}`).join('\n')
  const system = `Du bist ein kommunaler Entscheidungsassistenz-Agent für Kleinstädte in Sachsen-Anhalt. Antworte fachlich, kurz, ohne KI-Marketing. Nutze Daten, Ampellogik und IGEK/ISEK-Bezug. BENCHMARK:\n${benchmarkCtx}\nAKTUELLE KOMMUNE ${kommune}:\n${sichtenCtx}`
  try {
    const response = await anthropic.messages.create({ model:'claude-sonnet-4-20250514', max_tokens:450, system, messages:[...verlauf.slice(-6), {role:'user', content:frage}] })
    const antwort = response.content[0].type === 'text' ? response.content[0].text : regelAntwort(frage, kommune)
    return NextResponse.json({ antwort, modus:'ki' })
  } catch(e:any) {
    return NextResponse.json({ antwort: regelAntwort(frage, kommune), modus:'fallback', warning:e?.message })
  }
}

export async function PUT(req: NextRequest) {
  const { kommune='Leuna' } = await req.json()
  const detail = fallbackDetail(kommune, 2024)
  const score = detail.scores[0]
  const schwach = detail.werte.sort((a,b)=>(a.score_normiert??99)-(b.score_normiert??99)).slice(0,3)
  const text = `Bürgermeister-Briefing ${score.kommune.name}\n\n1. Lage: Die Kommune erreicht ${score.score_gesamt?.toFixed(1)}/10 Punkten und liegt auf Rang ${score.rang} von 33. Die Datenbasis stammt aus der manuellen Vorprojekt-Erhebung und wird im Zielbetrieb durch Agentenläufe fortgeschrieben.\n\n2. Kritische Punkte: ${schwach.map(w=>`${w.kennzahl} (${w.score_normiert?.toFixed(1)})`).join(', ')}.\n\n3. Maßnahmen: ${schwach.map(w=>massnahmeTitel(w.sicht_nr)).join('; ')}.\n\n4. Governance: Alle automatisch erzeugten Empfehlungen bleiben im Status Entwurf, bis Verwaltung oder Projektteam sie fachlich freigibt.\n\n5. Nächste 6 Monate: Datenquellen prüfen, CSV/Excel aktualisieren, Agentenlauf monatlich ausführen, Ampelmaßnahmen priorisieren.`
  return NextResponse.json({ briefing:text, fallback:true })
}
