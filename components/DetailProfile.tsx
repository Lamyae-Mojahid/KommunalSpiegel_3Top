'use client'

import { useEffect, useState } from 'react'
import {
  EditorialHeader, MonoLabel, Hairline,
  ScoreBadge, AmpelDot, TrendChip, Sparkline,
  ksFmt, ampelColor, ampelOf,
} from './Chrome'
import StreetViewWidget from './StreetViewWidget'

// Coordonnées GPS des 33 communes (utilisées pour le Street View)
const KOMMUNE_COORDS: Record<string, { lat: number; lng: number }> = {
  // Anhalt-Bitterfeld
  'Aken':                      { lat: 51.86, lng: 12.05 },
  'Köthen':                    { lat: 51.75, lng: 11.97 },
  'Muldestausee':              { lat: 51.66, lng: 12.35 },
  'Osternienburger Land':      { lat: 51.76, lng: 12.05 },
  'Raguhn-Jeßnitz':           { lat: 51.68, lng: 12.32 },
  'Sandersdorf-Brehna':       { lat: 51.62, lng: 12.22 },
  'Südliches Anhalt':         { lat: 51.62, lng: 11.72 },
  'Zerbst/Anhalt':            { lat: 51.97, lng: 12.08 },
  'Zörbig':                   { lat: 51.62, lng: 12.12 },
  // Burgenlandkreis
  'Hohenmölsen':              { lat: 51.15, lng: 12.10 },
  'Lützen':                   { lat: 51.26, lng: 12.14 },
  'Teuchern':                 { lat: 51.12, lng: 12.02 },
  // Mansfeld-Südharz
  'Allstedt':                 { lat: 51.38, lng: 11.37 },
  'Arnstein':                 { lat: 51.70, lng: 11.45 },
  'Eisleben':                 { lat: 51.53, lng: 11.55 },
  'Gerbstedt':                { lat: 51.63, lng: 11.62 },
  'Hettstedt':                { lat: 51.65, lng: 11.51 },
  'Mansfeld':                 { lat: 51.59, lng: 11.46 },
  'Seegebiet Mansfelder Land':{ lat: 51.53, lng: 11.53 },
  'Südharz':                  { lat: 51.52, lng: 11.30 },
  // Saalekreis
  'Bad Dürrenberg':           { lat: 51.29, lng: 12.06 },
  'Bad Lauchstädt':           { lat: 51.39, lng: 11.88 },
  'Braunsbedra':              { lat: 51.28, lng: 11.88 },
  'Kabelsketal':              { lat: 51.43, lng: 12.01 },
  'Landsberg':                { lat: 51.52, lng: 12.17 },
  'Leuna':                    { lat: 51.31, lng: 12.00 },
  'Mücheln (Geiseltal)':     { lat: 51.30, lng: 11.79 },
  'Petersberg':               { lat: 51.58, lng: 11.96 },
  'Querfurt':                 { lat: 51.38, lng: 11.60 },
  'Salzatal':                 { lat: 51.45, lng: 11.77 },
  'Schkopau':                 { lat: 51.39, lng: 11.95 },
  'Teutschenthal':            { lat: 51.45, lng: 11.80 },
  'Wettin-Löbejün':          { lat: 51.60, lng: 11.90 },
}

interface Wert {
  sicht_nr: number
  kennzahl: string
  wert_num: number | null
  score_normiert: number | null
}
interface Score {
  score_strategie: number | null
  score_plattform: number | null
  score_netzwerk: number | null
  score_gesamt: number | null
  rang: number | null
  datenvollst: number
  erhebungsjahr: number
}
interface KommuneData {
  kommune: { name: string; einwohner?: number; landkreis?: string }
  scores: Score[]
  werte: Wert[]
  massnahmen: any[]
}

const SICHTEN: { nr: number; label: string; kurz: string; schicht: string; einheit: string; hinweis?: string }[] = [
  { nr: 1, label: 'IGEK-Abdeckung',    kurz: 'IGEK',    schicht: 'Strategie', einheit: 'Sichten/10' },
  { nr: 2, label: 'Virtuelle Touren',  kurz: 'Touren',  schicht: 'Plattform', einheit: 'pro 1.000 EW' },
  { nr: 3, label: '360° Streetview',   kurz: '360°',    schicht: 'Plattform', einheit: '% Straßennetz' },
  { nr: 4, label: 'Ladeinfrastruktur', kurz: 'Laden',   schicht: 'Plattform', einheit: 'Plätze/1.000EW' },
  { nr: 5, label: 'Festnetz',          kurz: 'Festnetz',schicht: 'Plattform', einheit: 'Mbit/s' },
  { nr: 6, label: 'Mobilfunk',         kurz: 'Mobil',   schicht: 'Plattform', einheit: 'dBm' },
  {
    nr: 7, label: 'Digitale Services', kurz: 'E-Gov', schicht: 'Plattform', einheit: 'Reifegrad',
    // Methodischer Hinweis: Die automatisierten PVOG-Kennzahlen ("lokal
    // registrierte Online-Dienste") sind eine andere, engere Messung als
    // die ursprüngliche manuelle Reifegrad-Erhebung (0-4 je Einzelleistung,
    // rg/ab2). Das PVOG erkennt nur, OB eine Leistung offiziell als
    // Online-Dienst registriert ist - nicht WIE digital sie tatsächlich
    // ist (Stufe 0/1 sind für das PVOG nicht unterscheidbar, ebenso wenig
    // Stufe 2/3/4). Beide Quellen widersprechen sich nicht, sie decken
    // aber unterschiedliche Ausschnitte derselben Fragestellung ab.
    hinweis: 'PVOG-Daten zeigen offiziell registrierte Online-Dienste (ja/nein je Kommune), aber keine Qualitätsstufen 0–4. Sie ergänzen die manuelle Reifegrad-Erhebung, ersetzen sie aber nicht vollständig.',
  },
  { nr: 8, label: 'Social Media',      kurz: 'Social',  schicht: 'Netzwerk',  einheit: 'Kanaldichte' },
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

function Radar({ scores, size = 260 }: { scores: (number | null)[]; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 36
  const n = SICHTEN.length
  const ang = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2
  const grids = [2, 4, 6, 8, 10].map(lv =>
    SICHTEN.map((_, i) => `${cx + r * (lv / 10) * Math.cos(ang(i))},${cy + r * (lv / 10) * Math.sin(ang(i))}`).join(' ')
  )
  const pts = scores.map((v, i) => `${cx + r * ((v || 0) / 10) * Math.cos(ang(i))},${cy + r * ((v || 0) / 10) * Math.sin(ang(i))}`)
  return (
    <svg width="100%" height={size} viewBox={`0 0 ${size} ${size}`}>
      {grids.map((g, i) => <polygon key={i} points={g} fill="none" stroke="var(--line)" strokeWidth="0.7" />)}
      {SICHTEN.map((_, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(ang(i))} y2={cy + r * Math.sin(ang(i))}
              stroke="var(--line)" strokeWidth="0.5" />
      ))}
      <polygon points={pts.join(' ')} fill="var(--accent)" fillOpacity="0.08" stroke="var(--accent)" strokeWidth="1.5" />
      {pts.map((p, i) => {
        const [x, y] = p.split(',').map(Number)
        return <circle key={i} cx={x} cy={y} r="3.5" fill="#fff" stroke="var(--accent)" strokeWidth="1.5" />
      })}
      {SICHTEN.map((s, i) => {
        const lx = cx + (r + 22) * Math.cos(ang(i))
        const ly = cy + (r + 22) * Math.sin(ang(i))
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                fill="var(--ink-3)" fontSize="10" fontFamily="var(--font-mono)" letterSpacing="0.5">
            {s.kurz.toUpperCase()}
          </text>
        )
      })}
    </svg>
  )
}

export default function DetailProfile({
  kommune, alleScores = [], setKommune,
}: { kommune: string; alleScores?: any[]; setKommune?: (n: string) => void }) {
  const [data, setData] = useState<KommuneData | null>(null)
  const [loading, setLoading] = useState(true)
  const [innerTab, setInnerTab] = useState<'sichten' | 'massnahmen' | 'quellen'>('sichten')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/benchmark?kommune=${encodeURIComponent(kommune)}&jahr=2024`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [kommune])

  if (loading) return <div className="ks-block" style={{ textAlign: 'center', padding: 60 }}><MonoLabel>Profil wird geladen …</MonoLabel></div>
  if (!data)   return <div className="ks-block" style={{ textAlign: 'center', padding: 60, color: 'var(--red)' }}>Fehler beim Laden der Daten</div>

  const score = data.scores?.find(s => s.erhebungsjahr === 2024) || data.scores?.[0]
  const werte = data.werte || []
  const radarScores = SICHTEN.map(s => werte.find(w => w.sicht_nr === s.nr)?.score_normiert ?? null)
  const sorted = [...werte].filter(w => w.score_normiert != null).sort((a, b) => (b.score_normiert || 0) - (a.score_normiert || 0))
  const staerken = sorted.slice(0, 2)
  const schwach  = sorted.slice(-3).reverse()

  const trendDelta = (() => {
    const rec = alleScores.find((x: any) => x.kommune?.name === kommune)
    return rec?._trend ?? null
  })()

  return (
    <>
      <EditorialHeader
        kicker={`${data.kommune.landkreis || '—'} · ${(data.kommune.einwohner || 0).toLocaleString('de-DE')} Einwohner${score?.rang ? ` · Rang ${score.rang}/${alleScores.length || 33}` : ''}`}
        title={
          <>
            {kommune}
            <span style={{ fontStyle: 'italic', color: 'var(--ink-3)', marginLeft: 14, fontSize: '0.6em' }}>Detailprofil</span>
          </>
        }
        lead={`Profil aus der Vorprojekt-Erhebung 2024 + Agentenlauf vom 20. Mai 2026. Daten-Vollständigkeit ${score?.datenvollst ?? 0}%.`}
        side={
          <div className="ks-head-score">
            <MonoLabel>Gesamtscore</MonoLabel>
            <div className="ks-head-num" style={{ color: ampelColor(score?.score_gesamt) }}>
              {ksFmt(score?.score_gesamt)}<span className="ks-head-num-sm">/ 10</span>
            </div>
            <Hairline style={{ margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <MonoLabel>Rang</MonoLabel>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)', whiteSpace: 'nowrap', marginTop: 4 }}>
                  {score?.rang ?? '—'}<span style={{ fontSize: 16, color: 'var(--ink-3)' }}> / {alleScores.length || 33}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <MonoLabel>Trend YoY</MonoLabel>
                <div style={{ paddingTop: 6 }}><TrendChip v={trendDelta} /></div>
              </div>
            </div>
          </div>
        }
      />

      <section className="ks-schicht-strip">
        {[
          { label: 'Strategie', val: score?.score_strategie ?? null, sub: 'IGEK & Konzept', tint: 'var(--accent)' },
          { label: 'Plattform', val: score?.score_plattform ?? null, sub: 'Digital-Infrastruktur', tint: 'var(--ink-2)' },
          { label: 'Netzwerk',  val: score?.score_netzwerk ?? null,  sub: 'Vernetzung + Soziales', tint: 'var(--accent-2)' },
        ].map(s => (
          <div key={s.label} className="ks-schicht-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="mono-label" style={{ color: s.tint }}>{s.label}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: ampelColor(s.val), letterSpacing: '-.03em', lineHeight: 1 }}>{ksFmt(s.val)}</span>
            </div>
            <div className="ks-schicht-card-sub mono-label">{s.sub}</div>
            <div className="ks-bar-mini"><div className="ks-bar-mini-fill" style={{ width: `${(s.val || 0) * 10}%`, background: s.tint }} /></div>
          </div>
        ))}
      </section>

      {/* ── Street View · s'affiche si des coordonnées sont disponibles ── */}
      {KOMMUNE_COORDS[kommune] && (
        <StreetViewWidget
          lat={KOMMUNE_COORDS[kommune].lat}
          lng={KOMMUNE_COORDS[kommune].lng}
          kommuneName={kommune}
          radius={50}
        />
      )}

      <section className="ks-detail-grid">
        <div className="ks-block">
          <div className="ks-block-head">
            <div>
              <MonoLabel>Profil-Radar</MonoLabel>
              <h2 className="ks-h2" style={{ fontSize: 22 }}>Acht Sichten · normalisiert</h2>
            </div>
          </div>
          <Radar scores={radarScores} />
        </div>

        <div className="ks-block">
          <div className="ks-block-head">
            <div>
              <MonoLabel>Diagnose</MonoLabel>
              <h2 className="ks-h2" style={{ fontSize: 22 }}>Stärken &amp; Hebel</h2>
            </div>
          </div>
          <MonoLabel>Stärken</MonoLabel>
          <div className="ks-strong-list">
            {staerken.map(s => {
              const meta = SICHTEN.find(x => x.nr === s.sicht_nr)
              return (
                <div key={s.sicht_nr} className="ks-strong-row">
                  <span className="ks-strong-num">S{s.sicht_nr}</span>
                  <span className="ks-strong-name">{meta?.label}</span>
                  <span><ScoreBadge v={s.score_normiert} /></span>
                </div>
              )
            })}
          </div>
          <Hairline style={{ margin: '14px 0' }} />
          <MonoLabel>Schwächen &amp; Maßnahmenentwurf</MonoLabel>
          <div className="ks-weak-list">
            {schwach.map(s => {
              const meta = SICHTEN.find(x => x.nr === s.sicht_nr)
              return (
                <div key={s.sicht_nr} className="ks-weak-row">
                  <div className="ks-weak-head">
                    <AmpelDot v={s.score_normiert} size={7} />
                    <span className="ks-weak-name">{meta?.label}</span>
                    <span className="mono" style={{ fontSize: 17, color: 'var(--ink-3)' }}>Sicht {s.sicht_nr}</span>
                    <span style={{ marginLeft: 'auto' }}><ScoreBadge v={s.score_normiert} /></span>
                  </div>
                  <p className="ks-weak-action">↳ {MASSNAHMEN_TITEL[s.sicht_nr || 0] || 'Maßnahme prüfen'}</p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="ks-block">
          <div className="ks-block-head">
            <div>
              <MonoLabel>Peers</MonoLabel>
              <h2 className="ks-h2" style={{ fontSize: 22 }}>Vergleichbare Kommunen</h2>
            </div>
            <span className="mono-label">±40% Einwohner</span>
          </div>
          {alleScores
            .filter((c: any) => c.kommune?.name !== kommune && data.kommune.einwohner
              ? Math.abs((c.kommune?.einwohner || 0) - (data.kommune.einwohner || 0)) / (data.kommune.einwohner || 1) < 0.4
              : true)
            .sort((a: any, b: any) => Math.abs((a.kommune?.einwohner || 0) - (data.kommune.einwohner || 0))
                                    - Math.abs((b.kommune?.einwohner || 0) - (data.kommune.einwohner || 0)))
            .slice(0, 5)
            .map((p: any) => (
              <div key={p.kommune?.name} className="ks-peer-row" onClick={() => setKommune?.(p.kommune?.name)}>
                <span className="ks-peer-name">{p.kommune?.name}</span>
                <span className="mono ks-peer-ew">{(p.kommune?.einwohner || 0).toLocaleString('de-DE')} EW</span>
                <span className="ks-peer-bar">
                  <span className={`ks-peer-fill ks-fill-${ampelOf(p.score_gesamt)}`} style={{ width: `${(p.score_gesamt || 0) * 10}%` }} />
                </span>
                <span className="ks-peer-score"><ScoreBadge v={p.score_gesamt} /></span>
              </div>
            ))}
        </div>
      </section>

      <section className="ks-block">
        <div className="ks-tabs">
          {([['sichten', 'Alle Sichten'], ['massnahmen', 'IGEK-Maßnahmen'], ['quellen', 'Quellen & Daten']] as const).map(([v, l]) => (
            <button key={v} className={`ks-tab ${innerTab === v ? 'active' : ''}`} onClick={() => setInnerTab(v)}>{l}</button>
          ))}
        </div>

        {innerTab === 'sichten' && (
          <div className="ks-sichten-grid">
            {SICHTEN.map(s => {
              const w = werte.find(x => x.sicht_nr === s.nr)
              const v = w?.score_normiert ?? null
              const c = ampelColor(v)
              return (
                <div key={s.nr} className="ks-sicht-card">
                  <div className="ks-sicht-head">
                    <span className="mono-label">Sicht {s.nr} · {s.schicht}</span>
                    <AmpelDot v={v} size={7} />
                  </div>
                  <div className="ks-sicht-name">{s.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: c, letterSpacing: '-.03em', lineHeight: 1 }}>
                      {s.nr === 3 && w?.wert_num != null ? `${w.wert_num}%` : ksFmt(v)}
                    </span>
                    <span className="mono-label">{s.einheit}</span>
                  </div>
                  <div className="ks-bar-mini" style={{ marginTop: 10 }}>
                    <div className="ks-bar-mini-fill" style={{ width: `${(v || 0) * 10}%`, background: c }} />
                  </div>
                  <Hairline style={{ margin: '10px 0 6px' }} />
                  <div className="ks-sicht-foot">
                    <span className="mono-label">{ampelOf(v) === 'gruen' ? 'stark' : ampelOf(v) === 'gelb' ? 'mittel' : 'schwach'}</span>
                  </div>
                  {/* Methodischer Hinweis, z.B. für Sicht 7 (PVOG vs. manuelle Erhebung) */}
                  {s.hinweis && (
                    <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.4, color: 'var(--ink-4)', fontStyle: 'italic' }}>
                      ⓘ {s.hinweis}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {innerTab === 'massnahmen' && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(data.massnahmen || []).map(m => (
              <div key={m.id} style={{
                display: 'grid', gridTemplateColumns: '120px 1fr 120px',
                gap: 18, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--line)',
              }}>
                <span className="mono-label" style={{
                  padding: '4px 10px', borderRadius: 99,
                  background: m.status === 'umgesetzt' ? 'var(--green-l)' : 'var(--s-1)',
                  color: m.status === 'umgesetzt' ? 'var(--green)' : 'var(--ink-2)',
                  textAlign: 'center',
                }}>{m.status}</span>
                <div>
                  <div style={{ fontSize: 16.5, color: 'var(--ink)', fontWeight: 500 }}>{m.titel}</div>
                  {m.sicht_nr && <div className="mono-label">Sicht {m.sicht_nr}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <MonoLabel>Zieldatum</MonoLabel>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--ink-2)', marginTop: 2 }}>
                    {m.zieldatum ? new Date(m.zieldatum).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' }) : '—'}
                  </div>
                </div>
              </div>
            ))}
            {!data.massnahmen?.length && (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--ink-4)', fontSize: 16 }}>Keine Maßnahmen erfasst</div>
            )}
          </div>
        )}

        {innerTab === 'quellen' && (
          <div style={{ color: 'var(--ink-3)', fontSize: 15.5 }}>
            <p>Quellenprotokoll für {kommune} — wird aus dem letzten Agentenlauf gespeist.</p>
            <Hairline style={{ margin: '14px 0' }} />
            <div className="mono-label">Status: Modul wird im nächsten Sprint angeschlossen.</div>
          </div>
        )}
      </section>
    </>
  )
}