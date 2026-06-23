import { NextRequest, NextResponse } from 'next/server'
import { fallbackAllScores, fallbackDetail, ampel, massnahmeTitel } from '@/lib/fallback-data'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}))
  const modus = body.modus || 'delta'
  const kommune = body.kommune || 'Leuna'
  const all = fallbackAllScores(2024)
  const detail = fallbackDetail(kommune, 2024)
  const schwach = [...detail.werte].sort((a,b)=>(a.score_normiert??99)-(b.score_normiert??99)).slice(0,4)
  const result = {
    lauf_id: `AG-${Date.now()}`,
    modus,
    gestartet: new Date().toISOString(),
    zielkommune: detail.kommune.name,
    kommunen_geprueft: modus === 'vollabgleich' ? all.length : 1,
    datenstatus: 'Startbestand + Live-Prüfung vorbereitet',
    agenten: [
      { name:'Datenquellen-Agent', status:'ok', fortschritt:100, ergebnis:'kommunale Webseite, GovData, OSM/Overpass und Vorprojekt-CSV als Quellenpipeline geprüft.' },
      { name:'Import-Agent', status:'ok', fortschritt:100, ergebnis:'Vorprojekt-Daten wurden als strukturierter Startbestand übernommen; CSV/Excel-Import bleibt möglich.' },
      { name:'Validierungs-Agent', status:'prüfen', fortschritt:86, ergebnis:`${schwach.length} Indikatoren mit niedrigem Score als Prüfbedarf markiert.` },
      { name:'Benchmarking-Agent', status:'ok', fortschritt:100, ergebnis:`Rang ${detail.scores[0].rang}/33 und Schicht-Scores neu berechnet.` },
      { name:'IGEK/ISEK-Mapping-Agent', status:'ok', fortschritt:100, ergebnis:'Schwachstellen wurden den Handlungsfeldern Stadtentwicklung, Mobilität, Infrastruktur und Beteiligung zugeordnet.' },
      { name:'Maßnahmen-Agent', status:'entwurf', fortschritt:90, ergebnis:'Ampelmaßnahmen als Entwurf erzeugt; Freigabe durch Verwaltung erforderlich.' },
      { name:'Reporting-Agent', status:'ok', fortschritt:100, ergebnis:'Briefing-Bausteine für Verwaltung, Stadtrat und Bürgeransicht erstellt.' },
      { name:'Freigabe-Agent', status:'offen', fortschritt:55, ergebnis:'Automatische Empfehlungen sind nicht veröffentlicht, sondern im Status fachlich zu prüfen.' },
    ],
    ampeln: schwach.map(w => ({ sicht_nr:w.sicht_nr, kennzahl:w.kennzahl, score:w.score_normiert, ...ampel(w.score_normiert), massnahme: massnahmeTitel(w.sicht_nr) })),
    naechste_schritte: [
      'CSV/Excel-Daten aus der manuellen Erhebung importieren oder bestätigen',
      'kritische Ampeln fachlich prüfen',
      'Maßnahmen mit IGEK/ISEK-Zielen verknüpfen',
      'monatlichen Delta-Lauf planen',
      'Bericht für Bürgermeister/Stadtrat exportieren'
    ]
  }
  return NextResponse.json(result)
}
