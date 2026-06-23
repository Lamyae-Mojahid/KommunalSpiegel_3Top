'use client'

import { useState, useEffect } from 'react'

interface BriefingAbschnitt {
  titel:   string
  inhalt:  string
  icon:    string
}

function parseAbschnitte(text: string): BriefingAbschnitt[] {
  const sections = text.split(/\n(?=\d\.\s)/)
  return sections.filter(s=>s.trim()).map(s=>{
    const lines = s.trim().split('\n')
    const head  = lines[0].replace(/^\d+\.\s*/,'').trim()
    const body  = lines.slice(1).join('\n').trim()
    const icons: Record<string,string> = {
      'Zusammenfassung':'📋','Benchmark':'📊','Handlung':'🎯','Förder':'💰','Schritte':'✅','nächste':'✅'
    }
    const icon = Object.entries(icons).find(([k])=>head.toLowerCase().includes(k.toLowerCase()))?.[1]??'•'
    return { titel:head, inhalt:body, icon }
  })
}

function AbschnittKarte({ a, idx }: { a: BriefingAbschnitt; idx: number }) {
  const colors = ['#7C3AED','#1D4ED8','#059669','#D97706','#DC2626']
  const c = colors[idx % colors.length]

  return (
    <div style={{
      background:'#fff',border:'1px solid #E5E1D8',borderRadius:10,
      padding:'16px 18px',marginBottom:10
    }}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <div style={{
          width:28,height:28,borderRadius:8,
          background:`${c}11`,border:`1px solid ${c}33`,
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:17,flexShrink:0
        }}>
          {a.icon}
        </div>
        <div style={{
          fontSize:16,fontWeight:500,color:'#1A1816',
          fontFamily:"'Fraunces',serif"
        }}>
          {idx+1}. {a.titel}
        </div>
      </div>
      <div style={{
        fontSize:16,color:'#374151',lineHeight:1.75,
        paddingLeft:38,whiteSpace:'pre-wrap'
      }}>
        {a.inhalt}
      </div>
    </div>
  )
}

export default function Briefing({ kommune }: { kommune: string }) {
  const [briefingText, setBriefingText]   = useState('')
  const [abschnitte,   setAbschnitte]     = useState<BriefingAbschnitt[]>([])
  const [loading,      setLoading]        = useState(false)
  const [profil,       setProfil]         = useState<any>(null)
  const [kopiert,      setKopiert]        = useState(false)
  const [gedruckt,     setGedruckt]       = useState(false)

  // Profil für Vorschau laden
  useEffect(()=>{
    fetch(`/api/benchmark?kommune=${encodeURIComponent(kommune)}&jahr=2024`)
      .then(r=>r.json())
      .then(d=>setProfil(d))
  },[kommune])

  const generateBriefing = async () => {
    setLoading(true)
    setBriefingText('')
    setAbschnitte([])
    try {
      const res = await fetch('/api/agent', {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ kommune })
      })
      const data = await res.json()
      const text = data.briefing || 'Fehler beim Generieren.'
      setBriefingText(text)
      setAbschnitte(parseAbschnitte(text))
    } catch {
      setBriefingText('Verbindungsfehler. Bitte API-Key in .env.local prüfen.')
    }
    setLoading(false)
  }

  const copyText = () => {
    navigator.clipboard.writeText(briefingText)
    setKopiert(true)
    setTimeout(()=>setKopiert(false), 2000)
  }

  const printBriefing = () => {
    window.print()
    setGedruckt(true)
    setTimeout(()=>setGedruckt(false), 2000)
  }

  const aktScore = profil?.scores?.find((s:any)=>s.erhebungsjahr===2024)
  const werte    = profil?.werte || []
  const schwach  = [...werte]
    .filter((w:any)=>w.score_normiert!=null)
    .sort((a:any,b:any)=>a.score_normiert-b.score_normiert)
    .slice(0,3)
  const stark    = [...werte]
    .filter((w:any)=>w.score_normiert!=null)
    .sort((a:any,b:any)=>b.score_normiert-a.score_normiert)
    .slice(0,2)

  const SICHT_NAMEN: Record<number,string> = {
    1:'IGEK',2:'Touren',3:'360°',4:'Laden',5:'Festnetz',6:'Mobil',7:'E-Gov',8:'Social'
  }

  const sc = (v:number|null) => !v?'#9CA3AF':v>=7?'#16A34A':v>=4?'#D97706':'#DC2626'
  const f  = (v:number|null) => v!=null?v.toFixed(1):'—'

  return (
    <div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-family: 'Plus Jakarta Sans', sans-serif; }
        }
      `}</style>

      {/* Header */}
      <div style={{marginBottom:20}} className="no-print">
        <h1 style={{
          fontFamily:"'Fraunces',serif",fontSize:32,fontWeight:700,
          color:'#1A1816',letterSpacing:'-0.02em',marginBottom:4
        }}>
          Briefing-Generator
        </h1>
        <p style={{color:'#6B6459',fontSize:17}}>
          KI erstellt ein vollständiges Bürgermeister-Briefing für{' '}
          <strong style={{color:'#1A1816'}}>{kommune}</strong>{' '}
          — powered by Claude
        </p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1.6fr',gap:14}} className="no-print">

        {/* Linke Spalte: Profil-Snapshot + Aktionen */}
        <div>
          {/* Profil */}
          <div style={{
            background:'#fff',border:'1px solid #E5E1D8',borderRadius:12,
            padding:'18px 20px',marginBottom:12
          }}>
            <div style={{
              fontSize:17,fontWeight:500,color:'#6B6459',
              textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:14
            }}>
              Profil-Snapshot
            </div>

            <div style={{
              fontSize:40,fontWeight:700,fontFamily:"'Fraunces',serif",
              color:sc(aktScore?.score_gesamt??null),lineHeight:1,marginBottom:4
            }}>
              {f(aktScore?.score_gesamt??null)}
            </div>
            <div style={{fontSize:15,color:'#9C9389',marginBottom:16}}>
              Rang {aktScore?.rang??'—'} · {aktScore?.datenvollst??0}% vollständig
            </div>

            {[
              ['Strategie','score_strategie','#7C3AED'],
              ['Plattform','score_plattform','#1D4ED8'],
              ['Netzwerk','score_netzwerk','#059669'],
            ].map(([l,k,c])=>(
              <div key={k} style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:15,color:c,fontWeight:500}}>{l}</span>
                  <span style={{fontSize:15,fontWeight:500,color:c,fontFamily:"'Fraunces',serif"}}>
                    {f(aktScore?.[k]??null)}
                  </span>
                </div>
                <div style={{background:'#F3F4F6',borderRadius:3,height:5,overflow:'hidden'}}>
                  <div style={{
                    width:`${(aktScore?.[k]||0)*10}%`,height:'100%',
                    background:c,borderRadius:3,transition:'width .5s'
                  }}/>
                </div>
              </div>
            ))}

            {stark.length>0 && (
              <div style={{
                marginTop:12,padding:'8px 10px',
                background:'#F0FDF4',borderRadius:7,border:'1px solid #BBF7D0'
              }}>
                <div style={{fontSize:16,fontWeight:600,color:'#166534',marginBottom:3}}>Stärken</div>
                <div style={{fontSize:17,color:'#15803D'}}>
                  {stark.map((w:any)=>
                    `${SICHT_NAMEN[w.sicht_nr]||'Sicht '+w.sicht_nr} (${f(w.score_normiert)})`
                  ).join(' · ')}
                </div>
              </div>
            )}
            {schwach.length>0 && (
              <div style={{
                marginTop:7,padding:'8px 10px',
                background:'#FEF2F2',borderRadius:7,border:'1px solid #FECACA'
              }}>
                <div style={{fontSize:16,fontWeight:600,color:'#991B1B',marginBottom:3}}>Schwachstellen</div>
                <div style={{fontSize:17,color:'#B91C1C'}}>
                  {schwach.map((w:any)=>
                    `${SICHT_NAMEN[w.sicht_nr]||'Sicht '+w.sicht_nr} (${f(w.score_normiert)})`
                  ).join(' · ')}
                </div>
              </div>
            )}
          </div>

          {/* Briefing enthält */}
          <div style={{
            background:'#fff',border:'1px solid #E5E1D8',borderRadius:12,
            padding:'16px 18px',marginBottom:12
          }}>
            <div style={{
              fontSize:17,fontWeight:500,color:'#6B6459',
              textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10
            }}>
              Briefing enthält
            </div>
            {[
              'Benchmark-Position (Rang & Score)',
              'Stärken & Schwachstellen-Analyse',
              'Top-3 Handlungsempfehlungen',
              'Best-Practice Peer-Kommunen',
              'Passende Förderprogramme',
              'Konkreter 6-Monats-Aktionsplan',
            ].map((item,i)=>(
              <div key={i} style={{
                display:'flex',gap:8,padding:'5px 0',
                borderBottom:'1px solid #F3F4F6',
                fontSize:15,color:'#374151'
              }}>
                <span style={{color:'#16A34A',fontWeight:600}}>✓</span>
                {item}
              </div>
            ))}
          </div>

          {/* Generate Button */}
          <button
            onClick={generateBriefing}
            disabled={loading}
            style={{
              width:'100%',padding:'12px',
              background:loading?'#F3F4F6':'#1B3A5C',
              color:loading?'#9CA3AF':'#fff',
              border:'none',borderRadius:8,
              fontSize:17,fontWeight:500,cursor:loading?'not-allowed':'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:8,
              transition:'all .15s',marginBottom:8
            }}>
            {loading ? (
              <>
                <span style={{
                  width:14,height:14,border:'2px solid #9CA3AF',
                  borderTopColor:'transparent',borderRadius:'50%',
                  animation:'spin .7s linear infinite',display:'inline-block'
                }}/>
                Briefing wird generiert...
              </>
            ) : (
              <>◈ Briefing generieren (Claude API)</>
            )}
          </button>

          {/* Aktionsbuttons */}
          {briefingText && (
            <div style={{display:'flex',gap:6}}>
              <button onClick={copyText}
                style={{
                  flex:1,padding:'8px',fontSize:15,fontWeight:500,
                  border:'1px solid #E5E1D8',borderRadius:7,
                  background:kopiert?'#F0FDF4':'#fff',
                  color:kopiert?'#16A34A':'#374151',cursor:'pointer'
                }}>
                {kopiert?'✓ Kopiert':'Kopieren'}
              </button>
              <button onClick={printBriefing}
                style={{
                  flex:1,padding:'8px',fontSize:15,fontWeight:500,
                  border:'1px solid #E5E1D8',borderRadius:7,
                  background:'#fff',color:'#374151',cursor:'pointer'
                }}>
                🖨️ Drucken/PDF
              </button>
            </div>
          )}
        </div>

        {/* Rechte Spalte: Briefing-Output */}
        <div>
          {!briefingText && !loading && (
            <div style={{
              background:'#fff',border:'1px dashed #E5E1D8',borderRadius:12,
              padding:'48px 30px',textAlign:'center',color:'#9CA3AF'
            }}>
              <div style={{
                fontSize:40,marginBottom:12,
                fontFamily:"'Fraunces',serif",color:'#E5E1D8'
              }}>
                ◈
              </div>
              <div style={{fontSize:17,marginBottom:6}}>
                Briefing noch nicht generiert
              </div>
              <div style={{fontSize:15}}>
                Klicke auf "Briefing generieren" — die KI erstellt
                ein vollständiges Bürgermeister-Briefing basierend
                auf den echten Benchmark-Daten
              </div>
            </div>
          )}

          {loading && (
            <div style={{
              background:'#fff',border:'1px solid #E5E1D8',borderRadius:12,
              padding:'40px 30px',
            }}>
              {['Benchmark-Daten werden analysiert...','Peer-Kommunen werden verglichen...','Handlungsempfehlungen werden formuliert...','Förderprogramme werden verknüpft...'].map((t,i)=>(
                <div key={i} style={{
                  display:'flex',alignItems:'center',gap:10,marginBottom:12,
                  opacity: i===0?1:0.4,
                  animation:`fadeIn .3s ${i*0.3}s ease forwards`
                }}>
                  <span style={{
                    width:14,height:14,border:'2px solid #E5E7EB',
                    borderTopColor:'#1B3A5C',borderRadius:'50%',
                    animation:'spin .7s linear infinite',display:'inline-block',flexShrink:0
                  }}/>
                  <span style={{fontSize:16,color:'#6B7280'}}>{t}</span>
                </div>
              ))}
            </div>
          )}

          {abschnitte.length>0 && (
            <div>
              {/* Briefing-Header */}
              <div style={{
                background:'#1B3A5C',borderRadius:12,padding:'18px 20px',
                marginBottom:10,color:'#fff'
              }}>
                <div style={{
                  fontSize:15,letterSpacing:'0.12em',textTransform:'uppercase',
                  color:'rgba(255,255,255,0.5)',marginBottom:6
                }}>
                  BÜRGERMEISTER-BRIEFING
                </div>
                <div style={{
                  fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:700,
                  letterSpacing:'-0.01em',marginBottom:4
                }}>
                  {kommune}
                </div>
                <div style={{fontSize:15,color:'rgba(255,255,255,0.6)'}}>
                  Generiert am {new Date().toLocaleDateString('de-DE',{
                    day:'2-digit',month:'long',year:'numeric'
                  })} · Benchmark-Daten 2024 · KI-gestützt
                </div>
              </div>

              {abschnitte.map((a,i)=>(
                <AbschnittKarte key={i} a={a} idx={i}/>
              ))}

              <div style={{
                fontSize:17,color:'#9CA3AF',textAlign:'center',
                marginTop:10,padding:'10px'
              }}>
                Generiert von KommunalSpiegel KI-Agent · Datenstand: 2024 ·
                Alle Angaben ohne Gewähr
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
