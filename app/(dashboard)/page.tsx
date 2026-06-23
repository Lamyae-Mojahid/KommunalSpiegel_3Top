'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Sidebar, Topbar, EditorialHeader, MonoLabel, Hairline,
  Sparkline, ScoreBadge, TrendChip, AmpelDot,
  ksFmt, ampelColor, ampelOf, NAV, type ViewId,
} from '@/components/Chrome'
import KpiCards from '@/components/KpiCards'
import RankingTable from '@/components/RankingTable'
import DetailProfile from '@/components/DetailProfile'
import Datenwerkstatt from '@/components/Datenwerkstatt'
import FoerderPanel from '@/components/FoerderPanel'
import KiAgent from '@/components/KiAgent'
import Briefing from '@/components/Briefing'
import TrackingPanel from '@/components/TrackingPanel'
import LiveDashboard from '@/components/LiveDashboard'
import StreetViewWidget from '@/components/StreetViewWidget' // for API street view

// Trend + Sparkline simuliert (deterministisch je Kommune)
function pseudoTrend(name: string, score: number) {
  let h = 0; for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
  const t = ((h % 21) - 10) / 10
  return Math.round(t * (score > 7 ? 0.3 : score > 4 ? 0.6 : 0.9) * 10) / 10
}

const LOCAL_COORDS: Record<string, {lat:number; lng:number; lk?:string}> = {
  // Anhalt-Bitterfeld
  'Aken':                    {lat:51.86, lng:12.05, lk:'Anhalt-Bitterfeld'},
  'Köthen':                  {lat:51.75, lng:11.97, lk:'Anhalt-Bitterfeld'},
  'Muldestausee':            {lat:51.66, lng:12.35, lk:'Anhalt-Bitterfeld'},
  'Osternienburger Land':    {lat:51.76, lng:12.05, lk:'Anhalt-Bitterfeld'},
  'Raguhn-Jeßnitz':         {lat:51.68, lng:12.32, lk:'Anhalt-Bitterfeld'},
  'Sandersdorf-Brehna':     {lat:51.62, lng:12.22, lk:'Anhalt-Bitterfeld'},
  'Südliches Anhalt':       {lat:51.62, lng:11.72, lk:'Anhalt-Bitterfeld'},
  'Zerbst/Anhalt':          {lat:51.97, lng:12.08, lk:'Anhalt-Bitterfeld'},
  'Zörbig':                 {lat:51.62, lng:12.12, lk:'Anhalt-Bitterfeld'},
  // Burgenlandkreis
  'Hohenmölsen':            {lat:51.15, lng:12.10, lk:'Burgenlandkreis'},
  'Lützen':                 {lat:51.26, lng:12.14, lk:'Burgenlandkreis'},
  'Teuchern':               {lat:51.12, lng:12.02, lk:'Burgenlandkreis'},
  // Mansfeld-Südharz
  'Allstedt':               {lat:51.38, lng:11.37, lk:'Mansfeld-Südharz'},
  'Arnstein':               {lat:51.70, lng:11.45, lk:'Mansfeld-Südharz'},
  'Eisleben':               {lat:51.53, lng:11.55, lk:'Mansfeld-Südharz'},
  'Gerbstedt':              {lat:51.63, lng:11.62, lk:'Mansfeld-Südharz'},
  'Hettstedt':              {lat:51.65, lng:11.51, lk:'Mansfeld-Südharz'},
  'Mansfeld':               {lat:51.59, lng:11.46, lk:'Mansfeld-Südharz'},
  'Seegebiet Mansfelder Land': {lat:51.53, lng:11.53, lk:'Mansfeld-Südharz'},
  'Südharz':                {lat:51.52, lng:11.30, lk:'Mansfeld-Südharz'},
  // Saalekreis
  'Bad Dürrenberg':         {lat:51.29, lng:12.06, lk:'Saalekreis'},
  'Bad Lauchstädt':         {lat:51.39, lng:11.88, lk:'Saalekreis'},
  'Braunsbedra':            {lat:51.28, lng:11.88, lk:'Saalekreis'},
  'Kabelsketal':            {lat:51.43, lng:12.01, lk:'Saalekreis'},
  'Landsberg':              {lat:51.52, lng:12.17, lk:'Saalekreis'},
  'Leuna':                  {lat:51.31, lng:12.00, lk:'Saalekreis'},
  'Mücheln (Geiseltal)':   {lat:51.30, lng:11.79, lk:'Saalekreis'},
  'Petersberg':             {lat:51.58, lng:11.96, lk:'Saalekreis'},
  'Querfurt':               {lat:51.38, lng:11.60, lk:'Saalekreis'},
  'Salzatal':               {lat:51.45, lng:11.77, lk:'Saalekreis'},
  'Schkopau':               {lat:51.39, lng:11.95, lk:'Saalekreis'},
  'Teutschenthal':          {lat:51.45, lng:11.80, lk:'Saalekreis'},
  'Wettin-Löbejün':        {lat:51.60, lng:11.90, lk:'Saalekreis'},
}

function pseudoSpark(name: string) {
  let h = 0; for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
  const out: number[] = []
  let v = 4 + (Math.abs(h) % 30) / 10
  for (let i = 0; i < 8; i++) {
    h = (h * 1103515245 + 12345) | 0
    v = Math.max(0.5, Math.min(9.5, v + ((Math.abs(h) % 18) - 9) / 14))
    out.push(Math.round(v * 10) / 10)
  }
  return out
}

export default function Dashboard() {
  const [view, setView] = useState<ViewId>('uebersicht')
  const [kommune, setKommune] = useState('Leuna')
  const [alleScores, setAlleScores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/benchmark?alle=true&jahr=2024')
      .then(r => r.json())
      .then(d => {
        const data = (d.data || d.scores || []).map((x: any) => ({
          ...x,
          _trend: pseudoTrend(x.kommune?.name || '', x.score_gesamt || 0),
          _spark: pseudoSpark(x.kommune?.name || ''),
        }))
        setAlleScores(data)
        if (data[0]?.kommune?.name) setKommune(data[0].kommune.name)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const openDetail = (n: string) => { setKommune(n); setView('detail') }

  return (
    <div className="ks-app">
      <Sidebar view={view} setView={setView} kommune={kommune} setKommune={setKommune} alleScores={alleScores} />
      <div className="ks-main">
        <Topbar view={view} kommune={kommune} setView={setView} />
        <div className="ks-content" data-screen-label={view}>
          {loading ? (
            <div className="ks-block" style={{ textAlign: 'center', padding: 60 }}>
              <MonoLabel>Lade Benchmark-Daten …</MonoLabel>
            </div>
          ) : (
            <>
              {view === 'uebersicht'     && <LagebildView alleScores={alleScores} openDetail={openDetail} setView={setView} />}
              {view === 'detail'         && <DetailProfile kommune={kommune} alleScores={alleScores} setKommune={(n: string) => { setKommune(n); setView('detail') }} />}
              {view === 'ranking'        && <RankingTable alleScores={alleScores} aktKommune={kommune} setKommune={openDetail} setTab={setView} />}
              {view === 'datenwerkstatt' && <Datenwerkstatt kommune={kommune} />}
              {view === 'tracking'       && <TrackingPanel kommune={kommune} setKommune={(n: string) => { setKommune(n); setView('tracking') }} />}
              {view === 'ki'             && <KiAgent kommune={kommune} />}
              {view === 'foerder'        && <FoerderPanel kommune={kommune} />}
              {view === 'briefing'       && <Briefing kommune={kommune} />}
              {view === 'live'           && <LiveDashboard />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}



function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  const w = window as any
  if (w.L) return Promise.resolve(w.L)

  return new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.setAttribute('data-leaflet-css', 'true')
      document.head.appendChild(link)
    }
    const existing = document.querySelector('script[data-leaflet-js]') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).L), { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.setAttribute('data-leaflet-js', 'true')
    script.onload = () => resolve((window as any).L)
    script.onerror = reject
    document.body.appendChild(script)
  })
}

function KommunenMap({ alleScores, openDetail }: { alleScores:any[]; openDetail:(n:string)=>void }) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const layerRef = useRef<any>(null)

  const pts = useMemo(() => alleScores
    .map(x => {
      const name = x.kommune?.name || ''
      const fallback = LOCAL_COORDS[name]
      return {
        name,
        score: x.score_gesamt || 0,
        lat: typeof x.kommune?.lat === 'number' ? x.kommune.lat : fallback?.lat,
        lng: typeof x.kommune?.lng === 'number' ? x.kommune.lng : fallback?.lng,
        lk: x.kommune?.landkreis || fallback?.lk,
      }
    })
    .filter(p => p.name && typeof p.lat === 'number' && typeof p.lng === 'number'), [alleScores])

  useEffect(() => {
    let cancelled = false
    loadLeaflet().then((L) => {
      if (cancelled || !L || !mapEl.current) return

      if (!mapRef.current) {
        const map = L.map(mapEl.current, {
          zoomControl: true,
          scrollWheelZoom: true,
          attributionControl: true,
        }).setView([51.42, 11.86], 8)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap',
        }).addTo(map)

        mapRef.current = map
        setTimeout(() => map.invalidateSize(), 150)
      }

      const map = mapRef.current
      if (layerRef.current) layerRef.current.remove()
      const group = L.layerGroup().addTo(map)
      layerRef.current = group

      const bounds: any[] = []
      pts.forEach((p) => {
        const color = p.score >= 7 ? '#17824b' : p.score >= 4 ? '#c27803' : '#b32626'
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: 7,
          color: '#ffffff',
          weight: 2,
          fillColor: color,
          fillOpacity: 0.95,
        }).addTo(group)
        marker.bindTooltip(`<strong>${p.name}</strong><br/>Score ${ksFmt(p.score)} · ${p.lk || ''}`, {
          direction: 'top',
          offset: [0, -8],
          opacity: 0.96,
        })
        marker.on('click', () => openDetail(p.name))
        bounds.push([p.lat, p.lng])
      })

      if (bounds.length) {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 9 })
      }
      setTimeout(() => map.invalidateSize(), 80)
    }).catch(() => {})

    return () => { cancelled = true }
  }, [pts, openDetail])

  return (
    <div className="ks-block ks-map-card">
      <div className="ks-block-head">
        <div>
          <MonoLabel>02</MonoLabel>
          <h2 className="ks-h2">Kommunenkarte</h2>
        </div>
        <span className="mono-label">{pts.length || 33} Kommunen</span>
      </div>
      <div ref={mapEl} className="ks-leaflet-map" aria-label="Interaktive OpenStreetMap-Karte der Kommunen" />
      <div className="ks-map-legend">
        <span><i className="gruen"/>stark</span><span><i className="gelb"/>beobachten</span><span><i className="rot"/>prüfen</span>
      </div>
    </div>
  )
}

// ── Lagebild ──────────────────────────────────────────────────────────
// REMPLACE toute la fonction LagebildView dans page.tsx
// Ajoute aussi cet import en haut du fichier (après les autres imports) :
// import StreetViewWidget from '@/components/StreetViewWidget'

function LagebildView({
  alleScores, openDetail, setView,
}: { alleScores: any[]; openDetail: (n: string) => void; setView: (v: ViewId) => void }) {

  // ← NOUVEAU : commune sélectionnée pour le Street View
  const [svKommune, setSvKommune] = useState<string | null>(null)

  const valid = alleScores.filter(x => x.score_gesamt != null)
  const avg = valid.length ? valid.reduce((a, x) => a + (x.score_gesamt || 0), 0) / valid.length : 0
  const krit = alleScores.filter(x => x.score_gesamt != null && x.score_gesamt < 4).length
  const vollst = alleScores.filter(x => x.datenvollst === 100).length
  const sorted = [...alleScores].sort((a, b) => (b.score_gesamt || 0) - (a.score_gesamt || 0))
  const rote   = sorted.filter(x => (x.score_gesamt || 0) < 4).slice(0, 3)
  const gelbe  = sorted.filter(x => (x.score_gesamt || 0) >= 4 && (x.score_gesamt || 0) < 6).slice(0, 2)

  const schichten = [
    { label: 'Strategie', vals: alleScores.map(x => x.score_strategie), tint: 'var(--accent)' },
    { label: 'Plattform', vals: alleScores.map(x => x.score_plattform), tint: 'var(--ink-2)' },
    { label: 'Netzwerk',  vals: alleScores.map(x => x.score_netzwerk),  tint: 'var(--accent-2)' },
  ]
  const safeAvg = (vs: (number | null)[]) => {
    const a = vs.filter((v): v is number => typeof v === 'number')
    return a.length ? a.reduce((x, v) => x + v, 0) / a.length : 0
  }

  // Coordonnées de la commune sélectionnée pour Street View
  const svCoords = svKommune ? LOCAL_COORDS[svKommune] : null

  return (
    <>
      <EditorialHeader
        kicker="Lagebild · Stand 20. Mai 2026"
        title={<>Von der einmaligen Erhebung zur <em>laufenden Datenpflege</em>.</>}
        lead="Die Anwendung führt die Benchmark-Daten der 33 Kommunen Sachsen-Anhalt Süd fort, prüft periodisch ergänzende Quellen, markiert Datenlücken und übersetzt Auffälligkeiten in IGEK/ISEK-nahe Maßnahmenentwürfe."
        side={
          <div className="ks-head-metric-stack">
            <div>
              <MonoLabel>Aktueller Datenlauf</MonoLabel>
              <div className="ks-head-num">{alleScores.length}<span className="ks-head-num-sm">Kommunen</span></div>
            </div>
            <Hairline />
            <div className="ks-process-row"><span className="mono-label">01 Startbestand</span><span>Excel/CSV aus Vorprojekt</span></div>
            <div className="ks-process-row"><span className="mono-label">02 Agentenlauf</span><span>Quellen, Validierung, Benchmark</span></div>
            <div className="ks-process-row"><span className="mono-label">03 Ampel</span><span>Maßnahmen + Freigabe</span></div>
          </div>
        }
      />

      <KpiCards alleScores={alleScores} avg={avg} krit={krit} vollst={vollst} />

      <section className="ks-lage-grid">
        {/* ── Colonne gauche : liste des scores ── */}
        <div className="ks-block ks-score-card">
          <div className="ks-block-head">
            <div>
              <MonoLabel>01</MonoLabel>
              <h2 className="ks-h2">Gesamtscore je Kommune</h2>
            </div>
            <div className="ks-legend">
              <span><i style={{ background: 'var(--green)' }} />≥ 7.0</span>
              <span><i style={{ background: 'var(--amber)' }} />4.0 – 6.9</span>
              <span><i style={{ background: 'var(--red)' }} />&lt; 4.0</span>
            </div>
          </div>
          <div className="ks-rank-list">
            {sorted.map((x, i) => {
              const score = x.score_gesamt || 0
              const name = x.kommune?.name || ''
              const isSelected = svKommune === name
              return (
                <button
                  key={name}
                  className="ks-rank-row"
                  // ← MODIFIÉ : clic gauche → détail, clic droit → Street View
                  onClick={() => openDetail(name)}
                  onMouseEnter={() => setSvKommune(name)}  // ← NOUVEAU : survol = preview SV
                  style={{
                    // ← NOUVEAU : highlight si sélectionné pour SV
                    outline: isSelected ? '1px solid rgba(56,189,248,0.4)' : 'none',
                    outlineOffset: '-1px',
                    borderRadius: isSelected ? '4px' : undefined,
                  }}
                >
                  <span className="ks-rank-num">{String(x.rang || i + 1).padStart(2, '0')}</span>
                  <span className="ks-rank-name">
                    {name}
                    <span className="mono-label ks-rank-meta">{x.kommune?.landkreis}</span>
                  </span>
                  <span className="ks-rank-track">
                    <span
                      className={`ks-rank-fill ks-fill-${ampelOf(score)}`}
                      style={{ width: `${score * 10}%`, animationDelay: `${i * 12}ms` }}
                    />
                  </span>
                  <span className="ks-rank-spark">
                    <Sparkline values={x._spark} color={ampelColor(score)} w={56} h={18} />
                  </span>
                  <span className="ks-rank-score"><ScoreBadge v={score} /></span>
                  <span className="ks-rank-trend"><TrendChip v={x._trend} /></span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Colonne droite : carte + Street View ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <KommunenMap alleScores={alleScores} openDetail={openDetail} />

          {/* ← NOUVEAU : Street View widget */}
          {svCoords ? (
            <StreetViewWidget
              lat={svCoords.lat}
              lng={svCoords.lng}
              kommuneName={svKommune!}
              radius={50}
            />
          ) : (
            // Placeholder avant sélection
            <div style={{
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              height: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#334155',
              fontSize: '12px',
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}>
              ↑ Über eine Kommune fahren für Street View
            </div>
          )}
        </div>
      </section>

      {/* ── Sections secondaires (inchangées) ── */}
      <section className="ks-lage-secondary-grid">
        <div className="ks-block ks-schichten-card">
          <div className="ks-block-head" style={{ marginBottom: 14 }}>
            <div>
              <MonoLabel>03</MonoLabel>
              <h2 className="ks-h2">Schichten im Vergleich</h2>
            </div>
            <span className="mono-label">Ø über {valid.length} Kommunen</span>
          </div>
          {schichten.map(s => {
            const m = safeAvg(s.vals)
            const vals = s.vals.filter((v): v is number => typeof v === 'number')
            const max = Math.max(...vals, 0), min = Math.min(...vals, 10)
            return (
              <div key={s.label} className="ks-schicht-row">
                <div className="ks-schicht-head">
                  <span style={{ color: s.tint, fontWeight: 700, fontSize: 15 }}>{s.label}</span>
                  <span className="mono" style={{ fontSize: 14, color: 'var(--ink-2)' }}>Ø {ksFmt(m)}</span>
                </div>
                <div className="ks-schicht-dots">
                  {s.vals.map((v, i) => v == null ? null : (
                    <span key={i} className="ks-dot" style={{ left: `${v * 10}%`, background: s.tint, opacity: 0.6 }} />
                  ))}
                  <span className="ks-schicht-mean" style={{ left: `${m * 10}%`, background: s.tint }} />
                </div>
                <div className="ks-schicht-scale mono">
                  <span>min {ksFmt(min)}</span><span>max {ksFmt(max)}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="ks-block ks-ampel-list-card">
          <div className="ks-block-head" style={{ marginBottom: 10 }}>
            <div>
              <MonoLabel>04</MonoLabel>
              <h2 className="ks-h2">Handlungsampel</h2>
            </div>
            <span className="mono-label">Prüfbedarf</span>
          </div>
          <div className="ks-ampel-scroll">
            {rote.length === 0 && (
              <div className="ks-ampel-card" style={{ background: 'var(--green-l)', borderColor: 'rgba(48,109,75,0.18)' }}>
                <div className="ks-ampel-head"><AmpelDot v={9} /><b>Keine roten Gesamtscores</b></div>
                <p>Aktuell kein akuter Gesamtbedarf im Startbestand.</p>
              </div>
            )}
            {rote.map(k => (
              <div key={k.kommune?.name} className="ks-ampel-card rot" onClick={() => { openDetail(k.kommune?.name); setView('datenwerkstatt') }}>
                <div className="ks-ampel-head">
                  <AmpelDot v={k.score_gesamt} />
                  <b>{k.kommune?.name}</b>
                  <span className="mono" style={{ marginLeft: 'auto', fontSize: 13 }}>{ksFmt(k.score_gesamt)}</span>
                </div>
                <p>Score {ksFmt(k.score_gesamt)} · Datenlauf und Maßnahmenprüfung empfohlen.</p>
              </div>
            ))}
            {gelbe.map(k => (
              <div key={k.kommune?.name} className="ks-ampel-card gelb" onClick={() => openDetail(k.kommune?.name)}>
                <div className="ks-ampel-head">
                  <AmpelDot v={k.score_gesamt} />
                  <b>{k.kommune?.name}</b>
                  <span className="mono" style={{ marginLeft: 'auto', fontSize: 13 }}>{ksFmt(k.score_gesamt)}</span>
                </div>
                <p>Score im Mittelfeld · beobachten und gezielt ergänzen.</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}