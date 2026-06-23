'use client'

import { MonoLabel, ksFmt } from './Chrome'

interface KpiCardsProps {
  alleScores: any[]
  avg: number
  krit: number
  vollst?: number
}

export default function KpiCards({ alleScores, avg, krit, vollst }: KpiCardsProps) {
  const beste = [...alleScores].sort((a, b) => (b.score_gesamt || 0) - (a.score_gesamt || 0))[0]
  const fullCount = vollst ?? alleScores.filter(x => x.datenvollst === 100).length
  const bewertet  = alleScores.filter(x => x.score_gesamt).length

  return (
    <section className="ks-kpi-strip">
      <div className="ks-kpi">
        <MonoLabel>Kommunen im Startbestand</MonoLabel>
        <div className="ks-kpi-value">{alleScores.length || 33}</div>
        <div className="ks-kpi-sub">Vorprojekt-Erhebung + Datenwerkstatt</div>
      </div>
      <div className="ks-kpi">
        <MonoLabel>Ø Gesamtscore</MonoLabel>
        <div className="ks-kpi-value">
          {ksFmt(avg)}<span className="ks-kpi-unit">/10</span>
        </div>
        <div className="ks-kpi-sub">
          {bewertet} bewertet
          {beste?.kommune?.name && ` · best: ${beste.kommune.name} ${ksFmt(beste.score_gesamt)}`}
        </div>
      </div>
      <div className="ks-kpi">
        <MonoLabel>Vollständig erhoben</MonoLabel>
        <div className="ks-kpi-value">
          {fullCount}<span className="ks-kpi-unit">/{alleScores.length}</span>
        </div>
        <div className="ks-kpi-sub">alle 8 Sichten besetzt</div>
      </div>
      <div className="ks-kpi">
        <MonoLabel>Rote Ampeln</MonoLabel>
        <div className="ks-kpi-value" style={{ color: krit ? 'var(--red)' : 'var(--green)' }}>{krit}</div>
        <div className="ks-kpi-sub">{krit ? 'priorisierte Prüfung erforderlich' : 'keine kritischen Scores'}</div>
      </div>
    </section>
  )
}
