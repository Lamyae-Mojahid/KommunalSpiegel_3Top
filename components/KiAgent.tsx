'use client'

import { useState, useRef, useEffect } from 'react'

interface Message { role: 'user' | 'ai'; text: string }

const QUICK = [
  (k: string) => `Was sind die größten Schwächen von ${k}?`,
  (k: string) => `Welche Kommune ist Vorbild bei Ladeinfrastruktur?`,
  (k: string) => `Vergleiche ${k} mit Querfurt`,
  (_: string) => `Welche Kommunen haben Mobilfunk über 7?`,
  (k: string) => `Was sollte ${k} als nächstes tun?`,
  (k: string) => `Warum ist ${k} auf Rang ${1}?`,
]

export default function KiAgent({ kommune }: { kommune: string }) {
  const [msgs, setMsgs] = useState<Message[]>([{
    role: 'ai',
    text: `Hallo! Ich unterstütze die kommunale Lagebewertung und nutze die Benchmark-Daten der Kommunen aus Sachsen-Anhalt. Frag mich z.B.: „Was sind die größten Schwächen von ${kommune}?" oder „Welche Kommunen haben Mobilfunk über 7?"`
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [komData, setKomData] = useState<any>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Schnell-Diagnose aus API
  useEffect(() => {
    fetch(`/api/benchmark?kommune=${encodeURIComponent(kommune)}&jahr=2024`)
      .then(r => r.json())
      .then(d => setKomData(d))
  }, [kommune])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [msgs])

  const send = async (text?: string) => {
    const frage = text || input.trim()
    if (!frage || loading) return
    setInput('')
    setLoading(true)

    const newMsgs: Message[] = [...msgs, { role: 'user', text: frage }]
    setMsgs(newMsgs)

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frage,
          kommune,
          verlauf: newMsgs.slice(-6).map(m => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.text
          }))
        })
      })
      const data = await res.json()
      setMsgs(prev => [...prev, { role: 'ai', text: data.antwort || data.error || 'Fehler.' }])
    } catch {
      setMsgs(prev => [...prev, { role: 'ai', text: 'Verbindungsfehler. Bitte API-Key prüfen.' }])
    }
    setLoading(false)
  }

  const score = komData?.scores?.[komData.scores.length - 1]
  const werte = komData?.werte || []
  const schwach = [...werte].filter((w: any) => w.score_normiert != null).sort((a: any, b: any) => a.score_normiert - b.score_normiert).slice(0, 3)
  const stark = [...werte].filter((w: any) => w.score_normiert != null).sort((a: any, b: any) => b.score_normiert - a.score_normiert).slice(0, 2)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 4 }}>Lagebewertung</h1>
        <p style={{ color: 'var(--muted)', fontSize: 17 }}>
          Automatisierte Auswertung der Benchmark-Daten mit fachlichen Hinweisen, Maßnahmenvorschlägen und Freigabestatus.
        </p>
      </div>

      <div className="ks-analysis-grid">

        {/* Schnell-Diagnose */}
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="section-label">Schnell-Diagnose: {kommune}</div>
            {score && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 48, fontWeight: 700, fontFamily: 'var(--font-display)', color: scoreColor(score.score_gesamt), lineHeight: 1 }}>
                      {score.score_gesamt?.toFixed(1) || '—'}
                    </div>
                    <div style={{ fontSize: 17, color: 'var(--muted)', marginTop: 3 }}>Rang {score.rang} / 33 · {score.datenvollst}% vollständig</div>
                  </div>
                  <span className="pill" style={{ background: scoreBg(score.score_gesamt), color: scoreColor(score.score_gesamt), border: `1px solid ${scoreColor(score.score_gesamt)}44` }}>
                    {scoreLabel(score.score_gesamt)}
                  </span>
                </div>

                {stark.length > 0 && (
                  <div style={{ background: 'var(--green-bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Stärken</div>
                    <div style={{ fontSize: 15, color: '#15803D' }}>{stark.map((w: any) => `${w.kennzahl} (${w.score_normiert?.toFixed(1)})`).join(' · ')}</div>
                  </div>
                )}

                {schwach.length > 0 && (
                  <div style={{ background: 'var(--red-bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Schwachstellen + Hebel</div>
                    {schwach.map((w: any) => (
                      <div key={w.sicht_nr} style={{ fontSize: 15, color: '#B91C1C', marginBottom: 2 }}>
                        {w.kennzahl} ({w.score_normiert?.toFixed(1)}) — Sicht {w.sicht_nr}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ background: 'var(--blue-bg)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1E3A5F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Empfohlene nächste Schritte</div>
                  <div style={{ fontSize: 15, color: '#1D4ED8', lineHeight: 1.7 }}>
                    {score.score_gesamt >= 7
                      ? `1. Vorbildrolle aktiv kommunizieren\n2. Andere Kommunen beraten\n3. Score weiter ausbauen`
                      : score.score_gesamt >= 4
                      ? `1. ${schwach[0]?.kennzahl || 'Schwachstelle'} priorisieren\n2. Fördermittel beantragen\n3. Best-Practice-Austausch initiieren`
                      : `1. Datenvollständigkeit auf 100% erhöhen\n2. IGEK-Dokument erstellen\n3. Digitalisierungs-Agenda festlegen`
                    }
                  </div>
                </div>
              </>
            )}
            {!score && <div style={{ color: 'var(--muted)', fontSize: 16, textAlign: 'center', padding: 20 }}>Daten werden geladen...</div>}
          </div>
        </div>

        {/* Chat */}
        <div className="card ks-analysis-chat" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-label">Fachliche Rückfrage zur Auswertung</div>

          {/* Quick-Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {QUICK.slice(0, 5).map((qfn, i) => (
              <button key={i} onClick={() => send(qfn(kommune))}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 17, padding: '3px 10px', borderRadius: 99, transition: 'all .12s' }}
                onMouseOver={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)'; (e.target as HTMLElement).style.color = 'var(--accent)'; }}
                onMouseOut={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; (e.target as HTMLElement).style.color = 'var(--muted)'; }}
              >
                {qfn(kommune)}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
            {msgs.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                background: m.role === 'user' ? 'var(--accent)' : 'var(--bg)',
                color: m.role === 'user' ? '#fff' : 'var(--text)',
                border: m.role === 'ai' ? '1px solid var(--border)' : 'none',
                borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                padding: '9px 13px', fontSize: 16, lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
              }}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 13px', fontSize: 16, color: 'var(--muted)', fontStyle: 'italic' }}>
                Analysiere Benchmark-Daten...
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Frage stellen..."
              rows={1}
              style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', resize: 'none', background: 'var(--bg)', color: 'var(--text)', outline: 'none', fontSize: 16 }}
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 16, fontWeight: 500, opacity: loading ? 0.5 : 1 }}>
              Senden →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const scoreColor = (v: number | null | undefined) => !v ? '#6B7280' : v >= 7 ? '#16A34A' : v >= 4 ? '#D97706' : '#DC2626'
const scoreBg = (v: number | null | undefined) => !v ? '#F3F4F6' : v >= 7 ? '#F0FDF4' : v >= 4 ? '#FFFBEB' : '#FEF2F2'
const scoreLabel = (v: number | null | undefined) => !v ? '—' : v >= 7 ? 'Stark' : v >= 4 ? 'Mittel' : 'Schwach'
