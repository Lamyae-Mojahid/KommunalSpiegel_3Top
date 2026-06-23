'use client'

// Shared atoms + Sidebar + Topbar + Editorial-Header
// Wird von page.tsx und den Tab-Views importiert.

import React, { useState } from 'react'

// ── Atome ─────────────────────────────────────────────────────────────
export const ksFmt = (v: number | null | undefined, d = 1) =>
  v == null || isNaN(v as number) ? '—' : Number(v).toFixed(d)

export type Ampel = 'gruen' | 'gelb' | 'rot' | 'grau'
export const ampelOf = (v: number | null | undefined): Ampel =>
  v == null ? 'grau' : v < 4 ? 'rot' : v < 7 ? 'gelb' : 'gruen'

export const ampelColor = (v: number | null | undefined) => {
  const a = ampelOf(v)
  return a === 'gruen' ? 'var(--green)' : a === 'gelb' ? 'var(--amber)' : a === 'rot' ? 'var(--red)' : 'var(--ink-4)'
}

export const ampelBg = (v: number | null | undefined) => {
  const a = ampelOf(v)
  return a === 'gruen' ? 'var(--green-l)' : a === 'gelb' ? 'var(--amber-l)' : a === 'rot' ? 'var(--red-l)' : 'var(--s-2)'
}

export function MonoLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span className="mono-label" style={style}>{children}</span>
}

export function Hairline({ style }: { style?: React.CSSProperties }) {
  return <div className="hairline" style={style} />
}

export function Sparkline({ values, w = 72, h = 22, color = 'currentColor' }: { values: number[]; w?: number; h?: number; color?: string }) {
  if (!values?.length) return null
  const max = Math.max(...values, 10)
  const min = Math.min(...values, 0)
  const range = Math.max(0.5, max - min)
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 2) + 1
    const y = h - 1 - ((v - min) / range) * (h - 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = values[values.length - 1]
  const lx = w - 1
  const ly = h - 1 - ((last - min) / range) * (h - 2)
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <circle cx={lx} cy={ly} r="1.8" fill={color} />
    </svg>
  )
}

export function ScoreBadge({ v, big = false }: { v: number | null | undefined; big?: boolean }) {
  const c = ampelColor(v)
  return (
    <span style={{
      fontFamily: 'var(--font-display)',
      fontSize: big ? 26 : 16,
      letterSpacing: '-0.02em',
      color: v == null ? 'var(--ink-4)' : c,
      lineHeight: 1,
      fontWeight: 400,
    }}>{ksFmt(v)}</span>
  )
}

export function TrendChip({ v }: { v: number | null | undefined }) {
  if (v == null) return <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 16 }}>—</span>
  const flat = Math.abs(v) < 0.05
  const up = v > 0
  const c = flat ? 'var(--ink-3)' : up ? 'var(--green)' : 'var(--red)'
  const arrow = flat ? '→' : up ? '↑' : '↓'
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: c, display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      <span>{arrow}</span>
      <span>{flat ? '0.0' : (v > 0 ? '+' : '') + ksFmt(v)}</span>
    </span>
  )
}

export function AmpelDot({ v, size = 8 }: { v: number | null | undefined; size?: number }) {
  return <span style={{
    width: size, height: size, borderRadius: '50%',
    background: ampelColor(v), display: 'inline-block',
    boxShadow: ampelOf(v) === 'gruen' ? '0 0 0 2px rgba(48,109,75,0.10)' : 'none',
  }} />
}

// ── Editorial Header ──────────────────────────────────────────────────
export function EditorialHeader({
  kicker, title, lead, side,
}: { kicker: React.ReactNode; title: React.ReactNode; lead?: React.ReactNode; side?: React.ReactNode }) {
  return (
    <section className="ks-page-head">
      <div className="ks-page-head-text">
        <MonoLabel>{kicker}</MonoLabel>
        <h1 className="ks-display">{title}</h1>
        {lead && <p className="ks-lead">{lead}</p>}
      </div>
      {side && <div className="ks-page-head-side">{side}</div>}
    </section>
  )
}

// ── Navigation Definition ─────────────────────────────────────────────
export const NAV = [
  { id: 'uebersicht',       label: 'Lagebild',       sub: 'Überblick · 33 Kommunen' },
  { id: 'detail',           label: 'Kommune',        sub: 'Detailprofil' },
  { id: 'ranking',          label: 'Vergleich',      sub: 'Ranking + Peers' },
  { id: 'datenwerkstatt',   label: 'Datenwerkstatt', sub: 'Agentenlauf' },
  { id: 'tracking',         label: 'Maßnahmen',      sub: 'Ampelstatus' },
  { id: 'ki',               label: 'Auswertung',     sub: 'KI-Diagnose' },
  { id: 'foerder',          label: 'Förderung',      sub: 'Matching' },
  { id: 'briefing',         label: 'Berichte',       sub: 'IGEK / ISEK' },
  { id: 'live',             label: 'Quellen',        sub: 'Live-Status' },
] as const

export type ViewId = typeof NAV[number]['id']

// ── Sidebar ───────────────────────────────────────────────────────────
export function Sidebar({
  view, setView, kommune, setKommune, alleScores,
}: {
  view: ViewId
  setView: (v: ViewId) => void
  kommune: string
  setKommune: (k: string) => void
  alleScores: any[]
}) {
  const [open, setOpen] = useState(false)
  const k = alleScores.find(x => x.kommune?.name === kommune) || alleScores[0]

  return (
    <aside className="ks-sidebar">
      <div className="ks-brand">
        <div className="ks-brand-mark">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="3" y="3" width="8" height="8" />
            <rect x="13" y="3" width="8" height="8" />
            <rect x="3" y="13" width="8" height="8" />
            <path d="M13 17h8M17 13v8" />
          </svg>
        </div>
        <div>
          <div className="ks-brand-name">KommunalSpiegel</div>
          <div className="mono-label" style={{ fontSize: 15 }}>Sachsen-Anhalt Süd · v0.4</div>
        </div>
      </div>

      <div className="ks-side-section">
        <MonoLabel>Aktive Kommune</MonoLabel>
        <button className="ks-commune-picker" onClick={() => setOpen(o => !o)}>
          <div>
            <div className="ks-commune-name">{k?.kommune?.name || kommune}</div>
            <div className="mono-label" style={{ fontSize: 15 }}>
              {k?.kommune?.landkreis || ''} · {(k?.kommune?.einwohner || 0).toLocaleString('de-DE')} EW
              {k?.rang ? ` · Rang ${k.rang}` : ''}
            </div>
          </div>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.2" fill="none" /></svg>
        </button>
        {open && (
          <div className="ks-commune-dropdown">
            {alleScores.map(c => (
              <button
                key={c.kommune?.name}
                className={`ks-commune-option ${c.kommune?.name === kommune ? 'active' : ''}`}
                onClick={() => { setKommune(c.kommune?.name); setOpen(false) }}
              >
                <span>{c.kommune?.name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AmpelDot v={c.score_gesamt} size={6} />
                  <span className="mono" style={{ fontSize: 16, color: 'var(--ink-3)' }}>{ksFmt(c.score_gesamt)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="ks-nav">
        <MonoLabel>Navigation</MonoLabel>
        {NAV.map(n => (
          <button
            key={n.id}
            className={`ks-nav-item ${view === n.id ? 'active' : ''}`}
            onClick={() => setView(n.id as ViewId)}
          >
            <div className="ks-nav-label">{n.label}</div>
            <div className="ks-nav-sub mono-label">{n.sub}</div>
          </button>
        ))}
      </nav>

      <div className="ks-side-section ks-status-block">
        <MonoLabel>Letzter Agentenlauf</MonoLabel>
        <div className="ks-status-row">
          <span className="ks-pulse" />
          <div>
            <div style={{ fontSize: 17, color: 'var(--ink-2)', fontWeight: 500 }}>heute · 07:34</div>
            <div className="mono-label" style={{ fontSize: 15 }}>Delta · 33 Kommunen · 142 s</div>
          </div>
        </div>
        <Hairline style={{ margin: '12px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div className="mono-label" style={{ fontSize: 15 }}>Datenstand</div>
            <div style={{ fontSize: 17, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>2024 + 2026Q2</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono-label" style={{ fontSize: 15 }}>Quellen</div>
            <div style={{ fontSize: 17, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>5 / 5 ok</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Topbar ────────────────────────────────────────────────────────────
export function Topbar({
  view, kommune, setView,
}: { view: ViewId; kommune: string; setView: (v: ViewId) => void }) {
  const navItem = NAV.find(n => n.id === view) || NAV[0]
  return (
    <header className="ks-topbar">
      <div className="ks-breadcrumb">
        <span className="mono-label">KommunalSpiegel /</span>
        <span style={{ color: 'var(--ink-2)' }}>{navItem.label}</span>
        {view === 'detail' && (
          <>
            <span className="mono-label">/</span>
            <span style={{ color: 'var(--ink)' }}>{kommune}</span>
          </>
        )}
      </div>
      <div className="ks-top-actions">
        <div className="ks-search">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1" />
            <path d="M8 8l2 2" stroke="currentColor" strokeWidth="1" />
          </svg>
          <input placeholder="Kommune, Sicht, Maßnahme suchen …" />
          <kbd>⌘K</kbd>
        </div>
        <button className="ks-btn-ghost" onClick={() => setView('datenwerkstatt')}>
          <span className="ks-pulse" />
          Agentenlauf
        </button>
        <button className="ks-btn-primary">
          Bericht
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2 5.5L5.5 2 9 5.5M5.5 2v7" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </header>
  )
}
