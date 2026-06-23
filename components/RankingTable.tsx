'use client'

import { useMemo, useState } from 'react'
import {
  EditorialHeader, MonoLabel, Sparkline, ScoreBadge, TrendChip,
  ksFmt, ampelColor,
} from './Chrome'

interface ScoreRow {
  rang: number | null
  score_strategie: number | null
  score_plattform: number | null
  score_netzwerk: number | null
  score_gesamt: number | null
  datenvollst: number
  erhebungsjahr: number
  kommune: { id: number; name: string; landkreis?: string; einwohner?: number }
  _trend?: number | null
  _spark?: number[]
}

type SortKey = 'rang' | 'score_gesamt' | 'score_strategie' | 'score_plattform' | 'score_netzwerk' | 'datenvollst' | 'name'
type SortDir = 'asc' | 'desc'

export default function RankingTable({
  alleScores = [], aktKommune, setKommune, setTab,
}: {
  alleScores?: ScoreRow[]
  aktKommune?: string
  setKommune?: (n: string) => void
  setTab?: (t: any) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('rang')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [search, setSearch] = useState('')
  const [schicht, setSchicht] = useState<'alle' | 'strat' | 'platt' | 'netz'>('alle')

  const rows = useMemo(() => {
    let list = [...alleScores]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.kommune?.name?.toLowerCase().includes(q) ||
        r.kommune?.landkreis?.toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      if (sortKey === 'name') {
        const c = (a.kommune?.name || '').localeCompare(b.kommune?.name || '')
        return sortDir === 'asc' ? c : -c
      }
      const keyMap: Record<string, keyof ScoreRow> = {
        rang: 'rang', score_gesamt: 'score_gesamt',
        score_strategie: 'score_strategie', score_plattform: 'score_plattform',
        score_netzwerk: 'score_netzwerk', datenvollst: 'datenvollst',
      }
      const k = keyMap[sortKey]
      const av = (a[k] as number) ?? (sortDir === 'asc' ? 99 : -99)
      const bv = (b[k] as number) ?? (sortDir === 'asc' ? 99 : -99)
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return list
  }, [alleScores, sortKey, sortDir, search])

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir(k === 'rang' || k === 'name' ? 'asc' : 'desc') }
  }

  return (
    <>
      <EditorialHeader
        kicker="Vergleich · Ranking 2024 vs 2026"
        title={<>33 Kommunen, drei Schichten, ein Lesefluss.</>}
        lead="Die Tabelle ist nach Gesamtscore sortiert, lässt sich aber nach jeder Sicht filtern. Sparklines zeigen die Score-Entwicklung der letzten acht Erhebungen — der Trend-Pfeil das Delta zum Vorjahr."
      />

      <div className="ks-filter-bar">
        <div className="ks-search ks-search-lg">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1" />
            <path d="M8 8l2 2" stroke="currentColor" strokeWidth="1" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kommune oder Landkreis filtern …" />
        </div>
        <div className="ks-pill-group">
          {(['alle', 'strat', 'platt', 'netz'] as const).map(s => (
            <button key={s} className={`ks-pill ${schicht === s ? 'active' : ''}`} onClick={() => setSchicht(s)}>
              {s === 'alle' ? 'Alle Schichten' : s === 'strat' ? 'Strategie' : s === 'platt' ? 'Plattform' : 'Netzwerk'}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <MonoLabel>{rows.length} Treffer</MonoLabel>
        </div>
      </div>

      <div className="ks-block ks-table-block">
        <table className="ks-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('rang')}>#</th>
              <th onClick={() => toggleSort('name')}>Kommune</th>
              <th>Landkreis</th>
              <th onClick={() => toggleSort('score_strategie')} style={{ opacity: schicht === 'alle' || schicht === 'strat' ? 1 : 0.3 }}>Strategie</th>
              <th onClick={() => toggleSort('score_plattform')} style={{ opacity: schicht === 'alle' || schicht === 'platt' ? 1 : 0.3 }}>Plattform</th>
              <th onClick={() => toggleSort('score_netzwerk')}  style={{ opacity: schicht === 'alle' || schicht === 'netz'  ? 1 : 0.3 }}>Netzwerk</th>
              <th onClick={() => toggleSort('score_gesamt')}>Gesamt</th>
              <th>Verlauf</th>
              <th onClick={() => toggleSort('datenvollst')}>Vollst.</th>
              <th>Trend YoY</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isAct = r.kommune?.name === aktKommune
              return (
                <tr
                  key={r.kommune?.name}
                  className={isAct ? 'active' : ''}
                  onClick={() => { setKommune?.(r.kommune?.name); setTab?.('detail') }}
                >
                  <td className="mono ks-td-rang">{String(r.rang ?? 0).padStart(2, '0')}</td>
                  <td className="ks-td-name">{r.kommune?.name}</td>
                  <td className="mono-label">{r.kommune?.landkreis}</td>
                  <td><ScoreBadge v={r.score_strategie} /></td>
                  <td><ScoreBadge v={r.score_plattform} /></td>
                  <td><ScoreBadge v={r.score_netzwerk} /></td>
                  <td><ScoreBadge v={r.score_gesamt} big /></td>
                  <td>
                    {r._spark
                      ? <Sparkline values={r._spark} color={ampelColor(r.score_gesamt)} w={64} h={20} />
                      : <span className="mono-label">—</span>}
                  </td>
                  <td>
                    <span className="ks-voll">
                      <span className="ks-voll-bar"><span className="ks-voll-fill" style={{ width: `${r.datenvollst}%` }} /></span>
                      <span className="mono">{r.datenvollst}%</span>
                    </span>
                  </td>
                  <td><TrendChip v={r._trend ?? null} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <section className="ks-top-grid">
        {([
          ['Strategie', 'score_strategie', 'var(--accent)'],
          ['Plattform', 'score_plattform', 'var(--ink-2)'],
          ['Netzwerk',  'score_netzwerk',  'var(--accent-2)'],
        ] as const).map(([label, key, color]) => {
          const top = [...alleScores]
            .filter(r => r[key] != null)
            .sort((a, b) => (b[key] as number) - (a[key] as number))
            .slice(0, 5)
          return (
            <div key={label} className="ks-block">
              <div className="ks-block-head">
                <div>
                  <MonoLabel style={{ color }}>Top 5</MonoLabel>
                  <h2 className="ks-h2" style={{ fontSize: 17 }}>{label}</h2>
                </div>
              </div>
              {top.map((r, i) => (
                <div key={r.kommune?.name} className="ks-top-row" onClick={() => { setKommune?.(r.kommune?.name); setTab?.('detail') }}>
                  <span className="ks-top-rank mono">{i + 1}</span>
                  <span className="ks-top-name">{r.kommune?.name}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color }}>{ksFmt(r[key] as number)}</span>
                </div>
              ))}
            </div>
          )
        })}
      </section>
    </>
  )
}
