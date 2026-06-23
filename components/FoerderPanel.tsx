'use client'

import { useEffect, useState } from 'react'
import { EditorialHeader, MonoLabel } from './Chrome'

interface Foerderung {
  id: string
  titel: string
  anbieter: string
  sicht_nr: number
  match: number
  max_foerderung: string
  frist: string
  url: string
  desc?: string
  tags: string[]
}

const SICHT_NAMEN: Record<number, string> = {
  1: 'IGEK-Abdeckung', 2: 'Virtuelle Touren', 3: '360° Streetview',
  4: 'Ladeinfrastruktur', 5: 'Festnetz', 6: 'Mobilfunk',
  7: 'Digitale Services', 8: 'Social Media',
}

function MatchRing({ pct }: { pct: number }) {
  const c = pct >= 85 ? 'var(--green)' : pct >= 70 ? 'var(--amber)' : 'var(--ink-4)'
  const r = 20, circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div style={{ position: 'relative', width: 48, height: 48 }}>
      <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--s-2)" strokeWidth="3" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={c} strokeWidth="3"
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)',
      }}>{pct}</span>
    </div>
  )
}

export default function FoerderPanel({ kommune }: { kommune: string }) {
  const [foerder, setFoerder] = useState<Foerderung[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSicht, setFilterSicht] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'match' | 'frist'>('match')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/foerder?kommune=${encodeURIComponent(kommune)}`)
      .then(r => r.json())
      .then(d => { setFoerder(d.foerder || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [kommune])

  const filtered = foerder
    .filter(f => filterSicht == null || f.sicht_nr === filterSicht)
    .sort((a, b) => sortBy === 'match' ? b.match - a.match : 0)

  const hochRelevant = foerder.filter(f => f.match >= 85).length
  const sichtenMit = [...new Set(foerder.map(f => f.sicht_nr))].sort((a, b) => a - b)

  return (
    <>
      <EditorialHeader
        kicker="Förderung · Matching"
        title={<>Programme zu Schwachstellen automatisch zugeordnet.</>}
        lead={`Förderprogramme aus dem Bundesfördermonitor + Landesquellen, gematcht auf die Sichten von ${kommune}.`}
      />

      <section className="ks-kpi-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="ks-kpi">
          <MonoLabel>Programme gefunden</MonoLabel>
          <div className="ks-kpi-value">{foerder.length}</div>
          <div className="ks-kpi-sub">für eure Sichten</div>
        </div>
        <div className="ks-kpi">
          <MonoLabel>Hoch relevant</MonoLabel>
          <div className="ks-kpi-value" style={{ color: 'var(--green)' }}>{hochRelevant}</div>
          <div className="ks-kpi-sub">Match ≥ 85%</div>
        </div>
        <div className="ks-kpi">
          <MonoLabel>Bester Match</MonoLabel>
          <div className="ks-kpi-value">{foerder[0]?.match ?? '—'}<span className="ks-kpi-unit">%</span></div>
          <div className="ks-kpi-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {foerder[0]?.titel || ''}
          </div>
        </div>
      </section>

      <div className="ks-filter-bar">
        <div className="ks-pill-group">
          <button className={`ks-pill ${filterSicht == null ? 'active' : ''}`} onClick={() => setFilterSicht(null)}>Alle</button>
          {sichtenMit.map(nr => (
            <button key={nr} className={`ks-pill ${filterSicht === nr ? 'active' : ''}`}
                    onClick={() => setFilterSicht(filterSicht === nr ? null : nr)}>
              S{nr}
            </button>
          ))}
        </div>
        <div className="ks-pill-group" style={{ marginLeft: 'auto' }}>
          {(['match', 'frist'] as const).map(s => (
            <button key={s} className={`ks-pill ${sortBy === s ? 'active' : ''}`} onClick={() => setSortBy(s)}>
              {s === 'match' ? 'Relevanz' : 'Frist'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="ks-block" style={{ textAlign: 'center', padding: 40 }}>
          <MonoLabel>Förderprogramme werden geladen …</MonoLabel>
        </div>
      ) : (
        <div className="ks-foerder-list">
          {filtered.map(f => (
            <div key={f.id} className="ks-foerder-row">
              <MatchRing pct={f.match} />
              <div>
                <div className="ks-foerder-title">{f.titel}</div>
                <div className="mono-label">{f.anbieter} · Sicht {f.sicht_nr} · {SICHT_NAMEN[f.sicht_nr]}</div>
                <div className="ks-foerder-tags">
                  {f.tags.map(t => <span key={t} className="ks-tag">{t}</span>)}
                </div>
              </div>
              <div>
                <MonoLabel>Frist</MonoLabel>
                <div style={{ fontSize: 16, color: 'var(--ink-2)', marginTop: 4 }}>{f.frist}</div>
              </div>
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="ks-btn-ghost"
                 style={{ justifyContent: 'center', textDecoration: 'none' }}>
                Programm öffnen →
              </a>
            </div>
          ))}
          {!filtered.length && (
            <div className="ks-block" style={{ textAlign: 'center', padding: 40 }}>
              <MonoLabel>Keine Programme für diesen Filter</MonoLabel>
            </div>
          )}
        </div>
      )}
    </>
  )
}
