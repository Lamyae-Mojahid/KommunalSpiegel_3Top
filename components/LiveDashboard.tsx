'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Typen ─────────────────────────────────────────────────────
interface LiveSicht {
  sicht_nr: number; name: string; wert: number | null
  einheit: string; quelle: string; quelle_url: string
  abgerufen: string; score: number | null; trend: string | null
}
interface KommuneLive {
  name: string; lat: number; lng: number
  sichten: LiveSicht[]; gesamt: number | null; abgerufen: string
}
interface SyncLog {
  synced_at: string; kommunen_count: number
  fehler_count: number; dauer_ms: number
}

// ── Farben ────────────────────────────────────────────────────
const sc = (v: number | null) => !v ? '#9CA3AF' : v >= 7 ? '#16A34A' : v >= 4 ? '#D97706' : '#DC2626'
const sbg = (v: number | null) => !v ? '#F9FAFB' : v >= 7 ? '#F0FDF4' : v >= 4 ? '#FFFBEB' : '#FEF2F2'
const sl = (v: number | null) => !v ? '—' : v >= 7 ? 'Stark' : v >= 4 ? 'Mittel' : 'Schwach'
const f = (v: number | null, d = 1) => v != null ? v.toFixed(d) : '—'

// ── Komponenten ──────────────────────────────────────────────

function LiveBadge({ abgerufen, quelle }: { abgerufen: string; quelle: string }) {
  const sek = Math.floor((Date.now() - new Date(abgerufen).getTime()) / 1000)
  const text = sek < 60 ? 'gerade eben' : sek < 3600 ? `vor ${Math.floor(sek / 60)} Min` : `vor ${Math.floor(sek / 3600)} Std`
  return (
    <span title={`Quelle: ${quelle}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 16, padding: '2px 7px', borderRadius: 99,
      background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0',
      fontWeight: 500,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16A34A', animation: 'pulse 2s infinite' }} />
      live · {text}
    </span>
  )
}

function QuelleTag({ quelle, url }: { quelle: string; url: string }) {
  return (
    <a href={url || undefined} target="_blank" rel="noopener"
      style={{ fontSize: 16, color: url ? '#1D4ED8' : '#9CA3AF', textDecoration: url ? 'underline' : 'none', cursor: url ? 'pointer' : 'default' }}>
      {quelle}
    </a>
  )
}

function SichtCard({ s }: { s: LiveSicht }) {
  const c = sc(s.score)
  return (
    <div style={{ border: `1px solid ${s.wert != null ? c + '44' : '#E5E7EB'}`, borderRadius: 10, padding: '12px 14px', background: '#fff' }}>
      <div style={{ fontSize: 16, color: '#9CA3AF', marginBottom: 3 }}>Sicht {s.sicht_nr}</div>
      <div style={{ fontSize: 16, color: '#374151', marginBottom: 8, lineHeight: 1.3 }}>{s.name}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, color: s.wert != null ? c : '#D1D5DB', fontFamily: 'Fraunces, Georgia, serif' }}>
            {s.score != null ? f(s.score) : '—'}
          </div>
          <div style={{ fontSize: 16, color: '#9CA3AF' }}>Score</div>
        </div>
        {s.wert != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#374151' }}>{f(s.wert, s.wert > 100 ? 0 : 1)}</div>
            <div style={{ fontSize: 15, color: '#9CA3AF' }}>{s.einheit}</div>
          </div>
        )}
      </div>
      <div style={{ background: '#F3F4F6', borderRadius: 2, height: 4, overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ width: `${(s.score || 0) * 10}%`, height: '100%', background: c, borderRadius: 2, transition: 'width 0.5s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 16, color: c, fontWeight: 500 }}>{sl(s.score)}</span>
        <LiveBadge abgerufen={s.abgerufen} quelle={s.quelle} />
      </div>
      <div style={{ marginTop: 4 }}>
        <QuelleTag quelle={s.quelle} url={s.quelle_url} />
      </div>
    </div>
  )
}

// ── Haupt-Dashboard ────────────────────────────────────────────
export default function LiveDashboard() {
  const [kommune, setKommune] = useState('Leuna')
  const [liveData, setLiveData] = useState<KommuneLive | null>(null)
  const [alleScores, setAlleScores] = useState<any[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [tab, setTab] = useState<'uebersicht' | 'detail' | 'quellen'>('uebersicht')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [kommuneListe, setKommuneListe] = useState<string[]>([])

  // Alle Scores laden
  useEffect(() => {
    fetch('/api/live?alle=true').then(r => r.json()).then(d => {
      setAlleScores(d.scores || [])
      setKommuneListe((d.scores || []).map((x: any) => x.kommune?.name).filter(Boolean))
    })
    fetch('/api/sync').then(r => r.json()).then(d => setSyncLogs(d.logs || []))
  }, [])

  // Live-Daten für aktive Kommune
  const loadLive = useCallback(async (name: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/live?kommune=${encodeURIComponent(name)}`)
      const data = await res.json()
      setLiveData(data)
    } catch { }
    setLoading(false)
  }, [])

  useEffect(() => { loadLive(kommune) }, [kommune, loadLive])

  // Manueller Sync
  const triggerSync = async () => {
    setSyncing(true)
    await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    setSyncing(false)
    loadLive(kommune)
  }

  const safeSichten = Array.isArray(liveData?.sichten) ? liveData!.sichten : []
  const safeLiveData = liveData && Array.isArray(liveData.sichten) ? liveData : null
  const aktScore = alleScores.find(x => x.kommune?.name === kommune)

  return (
    <div style={{ minHeight: '100vh', background: '#F7F5F0', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin  { to{transform:rotate(360deg)} }
      `}</style>

      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #E5E1D8', padding: '0 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20, height: 58 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: '#1B3A5C', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Fraunces, serif', fontSize: 15, fontWeight: 700 }}>K</div>
            <div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 700, color: '#1A1816', letterSpacing: '-0.02em' }}>KommunalSpiegel</div>
              <div style={{ fontSize: 16, color: '#9C9389', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Live-Benchmark · Sachsen-Anhalt</div>
            </div>
          </div>

          {/* Live-Indikator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: '#DCFCE7', borderRadius: 99, border: '1px solid #BBF7D0' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', animation: 'pulse 2s infinite', display: 'inline-block' }} />
            <span style={{ fontSize: 16, fontWeight: 500, color: '#166534' }}>Live-Daten aktiv</span>
          </div>

          {/* Letzter Sync */}
          {syncLogs[0] && (
            <div style={{ fontSize: 16, color: '#9C9389' }}>
              Sync: {new Date(syncLogs[0].synced_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {syncLogs[0].kommunen_count} Kommunen
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Commune-Wahl */}
          <select value={kommune} onChange={e => setKommune(e.target.value)}
            style={{ fontSize: 16, padding: '6px 12px', border: '1px solid #E5E1D8', borderRadius: 7, background: '#fff', color: '#1A1816', cursor: 'pointer' }}>
            {kommuneListe.map(k => <option key={k}>{k}</option>)}
          </select>

          {/* Manueller Sync-Button */}
          <button onClick={triggerSync} disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: syncing ? '#F3F4F6' : '#1B3A5C', color: syncing ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontSize: 16, fontWeight: 500, cursor: syncing ? 'not-allowed' : 'pointer' }}>
            {syncing
              ? <span style={{ width: 12, height: 12, border: '2px solid #9CA3AF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
              : '↻'
            }
            {syncing ? 'Syncing...' : 'Sync jetzt'}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E1D8' }}>
        <div style={{ maxWidth: 1480, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 0 }}>
          {[['uebersicht', 'Übersicht'], ['detail', 'Live-Detailprofil'], ['quellen', 'Datenquellen']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v as any)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 16px', fontSize: 16, fontWeight: tab === v ? 500 : 400, color: tab === v ? '#1B3A5C' : '#9C9389', borderBottom: `2px solid ${tab === v ? '#1B3A5C' : 'transparent'}` }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main style={{ maxWidth: 1480, margin: '0 auto', padding: '28px 32px' }}>

        {/* Übersicht */}
        {tab === 'uebersicht' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, color: '#1A1816', letterSpacing: '-0.02em', marginBottom: 4 }}>
                Live-Benchmark Sachsen-Anhalt
              </h1>
              <p style={{ color: '#6B6459', fontSize: 17 }}>
                Scores werden täglich automatisch aus öffentlichen APIs aktualisiert
              </p>
            </div>

            {/* API-Status Karten */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Bundesnetzagentur', sub: 'Ladesäulen live', status: 'live', icon: '⚡' },
                { label: 'Breitbandatlas',    sub: 'Festnetz wöchentlich', status: 'live', icon: '📡' },
                { label: 'Mobilfunkatlas',    sub: '4G-Abdeckung', status: 'live', icon: '📶' },
                { label: 'OZG-Dashboard',     sub: 'E-Gov Reifegrad', status: 'live', icon: '🏛️' },
              ].map(c => (
                <div key={c.label} style={{ background: '#fff', border: '1px solid #E5E1D8', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{c.icon}</span>
                    <span style={{ fontSize: 16, padding: '2px 7px', borderRadius: 99, background: '#DCFCE7', color: '#166534', fontWeight: 500 }}>
                      {c.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#1A1816', marginBottom: 2 }}>{c.label}</div>
                  <div style={{ fontSize: 16, color: '#9C9389' }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Ranking mit Live-Badge */}
            <div style={{ background: '#fff', border: '1px solid #E5E1D8', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #E5E1D8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 500, color: '#6B6459', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Ranking aller Kommunen
                </span>
                <span style={{ fontSize: 16, color: '#9C9389' }}>
                  Klicken für Details · Scores live aktualisiert
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 16 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['Rang', 'Kommune', 'Strategie', 'Plattform', 'Netzwerk', 'Gesamt', 'Vollst.'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 16, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...alleScores].sort((a, b) => (a.rang || 99) - (b.rang || 99)).map(x => (
                    <tr key={x.kommune?.name}
                      style={{ background: x.kommune?.name === kommune ? '#EFF6FF' : 'transparent', cursor: 'pointer', transition: 'background .1s' }}
                      onClick={() => { setKommune(x.kommune?.name); setTab('detail') }}
                      onMouseOver={e => { if (x.kommune?.name !== kommune) (e.currentTarget as HTMLElement).style.background = '#F9FAFB' }}
                      onMouseOut={e => { if (x.kommune?.name !== kommune) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                      <td style={{ padding: '9px 14px', borderBottom: '1px solid #F3F4F6', color: '#6B7280', fontSize: 16 }}>
                        {x.rang <= 3 ? ['🥇','🥈','🥉'][x.rang - 1] : x.rang}
                      </td>
                      <td style={{ padding: '9px 14px', borderBottom: '1px solid #F3F4F6', fontWeight: x.kommune?.name === kommune ? 500 : 400, color: x.kommune?.name === kommune ? '#1D4ED8' : '#111827' }}>
                        {x.kommune?.name}
                      </td>
                      {['score_strategie', 'score_plattform', 'score_netzwerk'].map((k, i) => (
                        <td key={k} style={{ padding: '9px 14px', borderBottom: '1px solid #F3F4F6' }}>
                          <span style={{ fontWeight: 500, color: ['#7C3AED', '#1D4ED8', '#059669'][i] }}>
                            {f(x[k])}
                          </span>
                        </td>
                      ))}
                      <td style={{ padding: '9px 14px', borderBottom: '1px solid #F3F4F6' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: sc(x.score_gesamt), fontFamily: 'Fraunces, serif' }}>
                          {f(x.score_gesamt)}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px', borderBottom: '1px solid #F3F4F6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 36, height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${x.datenvollst || 0}%`, height: '100%', background: x.datenvollst === 100 ? '#16A34A' : x.datenvollst >= 60 ? '#D97706' : '#DC2626', borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 16, color: '#6B7280' }}>{x.datenvollst}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail */}
        {tab === 'detail' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, color: '#1A1816', letterSpacing: '-0.02em' }}>{kommune}</h1>
                  {liveData && <LiveBadge abgerufen={liveData.abgerufen} quelle="Alle APIs" />}
                </div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {aktScore && <>
                    <span style={{ fontSize: 16, fontWeight: 500, padding: '3px 10px', borderRadius: 99, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>Rang {aktScore.rang} / 33</span>
                    <span style={{ fontSize: 16, fontWeight: 500, padding: '3px 10px', borderRadius: 99, background: sbg(aktScore.score_gesamt), color: sc(aktScore.score_gesamt), border: `1px solid ${sc(aktScore.score_gesamt)}44` }}>{sl(aktScore.score_gesamt)}</span>
                  </>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 44, fontWeight: 700, fontFamily: 'Fraunces, serif', color: sc(aktScore?.score_gesamt), lineHeight: 1 }}>
                  {loading ? '...' : f(aktScore?.score_gesamt)}
                </div>
                <div style={{ fontSize: 16, color: '#9C9389' }}>Gesamtscore live</div>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 17 }}>
                Live-Daten werden abgerufen...
              </div>
            ) : safeLiveData ? (
              <>
                {/* Schichten */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Strategie', key: 'score_strategie', color: '#7C3AED', sichten: [1] },
                    { label: 'Plattform', key: 'score_plattform', color: '#1D4ED8', sichten: [2,3,4,5,6,7] },
                    { label: 'Netzwerk',  key: 'score_netzwerk',  color: '#059669', sichten: [8] },
                  ].map(sch => (
                    <div key={sch.label} style={{ background: '#fff', border: '1px solid #E5E1D8', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 500, color: sch.color }}>{sch.label}</span>
                        <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Fraunces, serif', color: sch.color }}>{f(aktScore?.[sch.key])}</span>
                      </div>
                      <div style={{ background: '#F3F4F6', borderRadius: 3, height: 7, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ width: `${(aktScore?.[sch.key] || 0) * 10}%`, height: '100%', background: sch.color, borderRadius: 3, transition: 'width 0.6s' }} />
                      </div>
                      <div style={{ fontSize: 16, color: '#9CA3AF' }}>
                        {sch.sichten.length} Sicht{sch.sichten.length > 1 ? 'en' : ''} · {sch.sichten.map(n => `S${n}`).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sichten-Karten mit Live-Daten */}
                <div style={{ background: '#fff', border: '1px solid #E5E1D8', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#6B6459', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                    Live-Kennzahlen je Sicht — direkt aus öffentlichen APIs
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
                    {safeSichten.map(s => <SichtCard key={s.sicht_nr} s={s} />)}
                  </div>
                </div>

                {/* Datenquellenübersicht */}
                <div style={{ background: '#fff', border: '1px solid #E5E1D8', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#6B6459', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                    Datenquellen dieser Abfrage
                  </div>
                  {safeSichten.filter(s => s.quelle !== 'Manuelle Erhebung 2024').map(s => (
                    <div key={s.sicht_nr} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid #F3F4F6' }}>
                      <span style={{ fontSize: 16, color: '#9CA3AF', minWidth: 55 }}>Sicht {s.sicht_nr}</span>
                      <span style={{ fontSize: 16, flex: 1, color: '#374151' }}>{s.name}</span>
                      <span style={{ fontSize: 16, color: '#6B7280' }}>{s.einheit}</span>
                      <QuelleTag quelle={s.quelle} url={s.quelle_url} />
                      <LiveBadge abgerufen={s.abgerufen} quelle={s.quelle} />
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Datenquellen-Tab */}
        {tab === 'quellen' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, color: '#1A1816', letterSpacing: '-0.02em', marginBottom: 4 }}>Datenquellen</h1>
              <p style={{ color: '#6B6459', fontSize: 17 }}>Alle genutzten APIs und Datenpipelines — transparent und nachvollziehbar</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))', gap: 14 }}>
              {[
                { nr: 4, name: 'Bundesnetzagentur Ladesäulenregister', url: 'https://ladestationen.api.bund.dev', typ: 'ArcGIS Feature Service', rhythmus: 'täglich', desc: 'Öffentliches Ladesäulenregister der Bundesnetzagentur. Abgerufen via ArcGIS REST API — kein Key benötigt. Liefert Anzahl Ladepunkte im Umkreis 15km.' },
                { nr: 5, name: 'Bundesnetzagentur Breitbandatlas',     url: 'https://maps.bundesnetzagentur.de', typ: 'ArcGIS REST API',          rhythmus: 'wöchentlich', desc: 'Breitbandversorgung je Adresse (Download Mbit/s). Öffentliche Kartendienste der Bundesnetzagentur.' },
                { nr: 6, name: 'Bundesnetzagentur Mobilfunkatlas',     url: 'https://maps.bundesnetzagentur.de', typ: 'ArcGIS REST API',          rhythmus: 'wöchentlich', desc: '4G-Abdeckungsgrad in Prozent je Gemeinde. Öffentlicher Kartendienst, kein API-Key nötig.' },
                { nr: 7, name: 'OZG-Informationsplattform / PVOG',     url: 'https://dashboard.digitale-verwaltung.de', typ: 'REST API (Beta)', rhythmus: 'wöchentlich', desc: 'Stand der OZG-Umsetzung je Bundesland. Reifegrad 0–4 für alle Verwaltungsleistungen. Datenquelle: Portal-Verbund Online-Gateway (PVOG).' },
                { nr: '2+3', name: 'OpenStreetMap Overpass API',       url: 'https://overpass-api.de',           typ: 'REST API',               rhythmus: 'täglich', desc: 'Touristische Objekte, Straßennetz, historische Stätten im Gemeindegebiet. Komplett kostenlos, Community-gepflegt.' },
                { nr: '1+8', name: 'Manuelle Erhebung (Benchmark 2024)', url: '', typ: 'CSV Import',             rhythmus: 'jährlich', desc: 'Eure erhobenen Daten aus dem Vorsemester-Projekt: IGEK-Abdeckung, Social-Media-Kanaldichte. Basis für alle normiertem Scores.' },
              ].map((q: any) => (
                <div key={q.nr} style={{ background: '#fff', border: '1px solid #E5E1D8', borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 16, color: '#9CA3AF', marginBottom: 3 }}>Sicht {q.nr}</div>
                      <div style={{ fontSize: 17, fontWeight: 500, color: '#1A1816' }}>{q.name}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 16, padding: '2px 8px', borderRadius: 99, background: q.rhythmus === 'täglich' ? '#DCFCE7' : q.rhythmus === 'jährlich' ? '#F3F4F6' : '#EFF6FF', color: q.rhythmus === 'täglich' ? '#166534' : q.rhythmus === 'jährlich' ? '#6B7280' : '#1D4ED8', fontWeight: 500 }}>
                        {q.rhythmus}
                      </span>
                      <span style={{ fontSize: 16, color: '#9CA3AF' }}>{q.typ}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.6, marginBottom: 8 }}>{q.desc}</p>
                  {q.url && (
                    <a href={q.url} target="_blank" rel="noopener" style={{ fontSize: 16, color: '#1D4ED8', textDecoration: 'none' }}>
                      {q.url} ↗
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* Sync-Log */}
            {syncLogs.length > 0 && (
              <div style={{ marginTop: 20, background: '#fff', border: '1px solid #E5E1D8', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: '#6B6459', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Sync-Protokoll
                </div>
                {syncLogs.map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid #F3F4F6', fontSize: 16 }}>
                    <span style={{ color: '#9CA3AF', minWidth: 130 }}>{new Date(l.synced_at).toLocaleString('de-DE')}</span>
                    <span style={{ color: '#374151' }}>{l.kommunen_count} Kommunen</span>
                    <span style={{ color: l.fehler_count > 0 ? '#DC2626' : '#16A34A' }}>{l.fehler_count} Fehler</span>
                    <span style={{ color: '#9CA3AF' }}>{l.dauer_ms}ms</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
