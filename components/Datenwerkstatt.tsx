'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  EditorialHeader, MonoLabel, Hairline, AmpelDot, ScoreBadge,
  ksFmt,
} from './Chrome'

const PROZESS = [
  ['Import',      'CSV / Excel aus Vorprojekt'],
  ['Quellenlauf', 'Web · OSM · GovData'],
  ['Validierung', 'Lücken & Plausibilität'],
  ['Benchmark',   'Score · Rang · Peers'],
  ['Freigabe',    'Maßnahmenentwurf prüfen'],
] as const

const SICHTEN_MIN = [
  { nr: 1, label: 'IGEK-Abdeckung',    schicht: 'Strategie' },
  { nr: 2, label: 'Virtuelle Touren',  schicht: 'Plattform' },
  { nr: 3, label: '360° Streetview',   schicht: 'Plattform' },
  { nr: 4, label: 'Ladeinfrastruktur', schicht: 'Plattform' },
  { nr: 5, label: 'Festnetz',          schicht: 'Plattform' },
  { nr: 6, label: 'Mobilfunk',         schicht: 'Plattform' },
  { nr: 7, label: 'Digitale Services', schicht: 'Plattform' },
  { nr: 8, label: 'Social Media',      schicht: 'Netzwerk' },
]
const MASSNAHMEN_TITEL: Record<number, string> = {
  1: 'IGEK/ISEK-Zielsystem digital fortschreiben',
  2: 'Virtuellen Ortsrundgang + Standortprofil',
  3: '360°-/Karten-Sichtbarkeit prüfen',
  4: 'Ladeinfrastruktur priorisiert ausbauen',
  5: 'Breitband-/Gewerbegebietsversorgung',
  6: 'Mobilfunklücken mit Netzbetreibern klären',
  7: 'Online-Bürgerservices ausbauen',
  8: 'Beteiligungskanäle professionalisieren',
}

export default function Datenwerkstatt({ kommune }: { kommune: string }) {
  const [modus, setModus] = useState<'delta' | 'vollabgleich'>('delta')
  const [lauf, setLauf] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const [werte, setWerte] = useState<any[]>([])

  useEffect(() => {
    const t = setInterval(() => setTick(x => (x + 1) % 100), 600)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    fetch(`/api/benchmark?kommune=${encodeURIComponent(kommune)}&jahr=2024`)
      .then(r => r.json())
      .then(d => setWerte(d.werte || []))
      .catch(() => {})
  }, [kommune])

  const starten = async (m: 'delta' | 'vollabgleich') => {
    setLoading(true)
    try {
      const r = await fetch('/api/agentenlauf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ modus: m, kommune }),
      })
      const d = await r.json()
      setLauf(d)
    } catch {}
    setLoading(false)
  }

  const fallbackAgenten = useMemo(() => [
    { name: 'Datenquellen-Agent', status: 'ok',     fortschritt: 100, ergebnis: '33 Kommunen geprüft · 4 neue Quellen erkannt' },
    { name: 'Validierungs-Agent', status: 'ok',     fortschritt: 100, ergebnis: '12 Datenlücken markiert · 3 Plausibilitätskonflikte' },
    { name: 'Benchmarking-Agent', status: 'ok',     fortschritt: 100, ergebnis: 'Scores neu berechnet · 7 Rangverschiebungen' },
    { name: 'IGEK/ISEK-Mapping',  status: 'ok',     fortschritt: 100, ergebnis: 'Schwächen Handlungsfeldern zugeordnet' },
    { name: 'Maßnahmen-Agent',    status: 'prüfen', fortschritt: 84,  ergebnis: '14 Entwürfe erzeugt · Freigabe steht aus' },
  ], [])
  const quellen = [
    { name: 'Vorprojekt CSV/Excel',   typ: 'Startbestand',  letzter: '2024-09-12',   status: 'ok' },
    { name: 'Kommunale Webseiten',    typ: 'Web-Agent',     letzter: 'heute 07:36',  status: 'ok' },
    { name: 'OpenStreetMap/Overpass', typ: 'Live-Quelle',   letzter: 'heute 07:35',  status: 'ok' },
    { name: 'GovData / Landesdaten',  typ: 'Open Data',     letzter: 'gestern 22:14',status: 'prüfen' },
    { name: 'Bundesfördermonitor',    typ: 'Förder-API',    letzter: 'heute 06:00',  status: 'ok' },
  ]
  const agenten = lauf?.agenten || fallbackAgenten

  return (
    <>
      <EditorialHeader
        kicker="Datenwerkstatt · Agentenlauf"
        title={<>Automatisierte Fortschreibung statt einmaliger Sammlung.</>}
        lead="Die manuelle Erhebung bleibt der geprüfte Startbestand. Das Agententeam ergänzt periodisch öffentliche Quellen, prüft Plausibilität, berechnet Benchmarks, ordnet Schwächen IGEK/ISEK-Zielen zu und erzeugt Maßnahmenentwürfe."
        side={
          <div className="ks-run-card" style={{ padding: 0, border: 0, background: 'transparent' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <MonoLabel>Letzter Lauf · 07:34</MonoLabel>
              <span className="ks-pulse" />
            </div>
            <div className="ks-head-num" style={{ fontSize: 48, color: 'var(--ink)' }}>
              {lauf?.kommunen_geprueft || 33}
              <span className="ks-head-num-sm">Kommunen geprüft</span>
            </div>
            <Hairline style={{ margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <MonoLabel>Modus</MonoLabel>
                <div style={{ fontSize: 16, color: 'var(--ink)', fontWeight: 500 }}>{lauf?.modus || 'Delta-Lauf'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <MonoLabel>Abweichungen</MonoLabel>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--amber)' }}>
                  {lauf?.ampeln?.filter((a: any) => a.status === 'rot').length ?? 7}
                </div>
              </div>
            </div>
            <div className="ks-run-actions">
              <button className="ks-btn-primary ks-btn-block" disabled={loading}
                      onClick={() => { setModus('delta'); starten('delta') }}>
                {loading && modus === 'delta' ? 'Lauf aktiv …' : 'Delta-Lauf starten'}
              </button>
              <button className="ks-btn-ghost ks-btn-block" disabled={loading}
                      onClick={() => { setModus('vollabgleich'); starten('vollabgleich') }}>
                Vollabgleich
              </button>
            </div>
          </div>
        }
      />

      <section className="ks-block" style={{ marginBottom: 22 }}>
        <div className="ks-block-head">
          <div>
            <MonoLabel>Prozessmodell</MonoLabel>
            <h2 className="ks-h2" style={{ fontSize: 22 }}>Fünf Schritte · wiederholbar · prüfbar</h2>
          </div>
          {lauf?.lauf_id && <span className="mono-label">{lauf.lauf_id}</span>}
        </div>
        <div className="ks-process-line">
          {PROZESS.map(([title, sub], i) => (
            <div key={i} className="ks-process-step">
              <div className="ks-process-num">{String(i + 1).padStart(2, '0')}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
                <div className="mono-label" style={{ fontSize: 15, marginTop: 3 }}>{sub}</div>
              </div>
              {i < 4 && <div className="ks-process-line-conn" />}
            </div>
          ))}
        </div>
      </section>

      <section className="ks-agent-grid">
        <div className="ks-block">
          <div className="ks-block-head">
            <div>
              <MonoLabel>01</MonoLabel>
              <h2 className="ks-h2" style={{ fontSize: 22 }}>Arbeitsprotokoll der Agenten</h2>
            </div>
            <span className="mono-label">prüfbar statt Blackbox</span>
          </div>
          <div className="ks-agent-list">
            {agenten.map((a: any, i: number) => {
              const live = i === 4 && a.status !== 'ok'
              const fortschritt = live ? Math.min(99, (a.fortschritt || 0) + (tick % 16) * 0.1) : (a.fortschritt ?? 100)
              return (
                <div key={a.name} className="ks-agent-row">
                  <div className="ks-agent-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {live ? <span className="ks-pulse" /> : <AmpelDot v={9} size={6} />}
                      <strong style={{ fontSize: 16 }}>{a.name}</strong>
                    </div>
                    <span className={`ks-status ${a.status === 'ok' ? 'ok' : 'pruefen'}`}>{a.status}</span>
                  </div>
                  <div className="ks-agent-progress">
                    <div className="ks-agent-progress-fill"
                         style={{ width: `${fortschritt}%`, background: live ? 'var(--amber)' : 'var(--green)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span className="ks-agent-result">{a.ergebnis}</span>
                    <span className="mono" style={{ fontSize: 16, color: 'var(--ink-3)' }}>{ksFmt(fortschritt, 0)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="ks-block">
          <div className="ks-block-head">
            <div>
              <MonoLabel>02</MonoLabel>
              <h2 className="ks-h2" style={{ fontSize: 22 }}>Quellen-Status</h2>
            </div>
            <span className="mono-label">letzter Abruf</span>
          </div>
          <div className="ks-source-list">
            {quellen.map(q => (
              <div key={q.name} className="ks-source-row">
                <AmpelDot v={q.status === 'ok' ? 9 : q.status === 'prüfen' ? 5 : 2} size={7} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>{q.name}</div>
                  <div className="mono-label">{q.typ}</div>
                </div>
                <span className="mono" style={{ fontSize: 16, color: 'var(--ink-3)' }}>{q.letzter}</span>
              </div>
            ))}
          </div>
          <Hairline style={{ margin: '14px 0' }} />
          <MonoLabel>CSV / Excel-Import</MonoLabel>
          <label className="ks-upload">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2v9M5 7l4-4 4 4M3 14h12" stroke="var(--ink-3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 500 }}>CSV / XLSX ablegen</div>
              <div className="mono-label" style={{ fontSize: 15 }}>kommune · sicht_nr · kennzahl · score_normiert · quelle</div>
            </div>
            <input type="file" accept=".csv,.xlsx,.txt" style={{ display: 'none' }} />
          </label>
        </div>
      </section>

      <section className="ks-block" style={{ marginTop: 22 }}>
        <div className="ks-block-head">
          <div>
            <MonoLabel>03</MonoLabel>
            <h2 className="ks-h2" style={{ fontSize: 22 }}>Ampelmaßnahmen für {kommune} · Entwurf</h2>
          </div>
          <span className="mono-label">Freigabe durch Verwaltung erforderlich</span>
        </div>
        <div className="ks-ampel-table">
          {SICHTEN_MIN.map(s => {
            const w = werte.find((x: any) => x.sicht_nr === s.nr)
            const v: number | null = w?.score_normiert ?? null
            const status = v == null ? 'grau' : v < 4 ? 'rot' : v < 7 ? 'gelb' : 'gruen'
            return (
              <div key={s.nr} className={`ks-ampel-table-row ${status}`}>
                <span className="ks-ampel-table-status">
                  <AmpelDot v={v} size={8} />
                  <span className="mono-label" style={{ marginLeft: 8 }}>
                    {status === 'gruen' ? 'stabil' : status === 'gelb' ? 'beobachten' : status === 'rot' ? 'kritisch' : 'offen'}
                  </span>
                </span>
                <span className="ks-ampel-table-name">
                  <span style={{ fontWeight: 500 }}>{s.label}</span>
                  <span className="mono-label">Sicht {s.nr} · {s.schicht}</span>
                </span>
                <span className="ks-ampel-table-action">{MASSNAHMEN_TITEL[s.nr]}</span>
                <span className="ks-ampel-table-score"><ScoreBadge v={v} /></span>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
