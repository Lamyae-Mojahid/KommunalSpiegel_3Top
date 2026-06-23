'use client'

import { useState, useEffect, useRef } from 'react'

interface ScoreZeit {
  erhebungsjahr:   number
  score_strategie: number | null
  score_plattform: number | null
  score_netzwerk:  number | null
  score_gesamt:    number | null
  datenvollst:     number
}
interface Massnahme {
  id:         number
  titel:      string
  sicht_nr?:  number
  status:     'geplant' | 'in Umsetzung' | 'umgesetzt' | 'abgebrochen'
  zieldatum?: string
  notiz?:     string
}

const sc = (v:number|null) => !v&&v!==0?'#9CA3AF':v>=7?'#16A34A':v>=4?'#D97706':'#DC2626'
const f  = (v:number|null,d=1) => v!=null?v.toFixed(d):'—'

// ── Linien-Chart (rein SVG, kein Lib-Import) ──────────────────
function LineChart({ data, height=180 }: { data: ScoreZeit[], height?:number }) {
  const W=480, H=height, ml=28, mr=16, mt=16, mb=28
  const iW=W-ml-mr, iH=H-mt-mb
  const xs=(i:number)=>ml+i/(Math.max(data.length-1,1))*iW
  const ys=(v:number)=>mt+iH-(v/10)*iH

  const series = [
    { key:'score_gesamt',    color:'#1D4ED8', label:'Gesamt',    dash:'' },
    { key:'score_plattform', color:'#7C3AED', label:'Plattform', dash:'4,3' },
    { key:'score_netzwerk',  color:'#059669', label:'Netzwerk',  dash:'2,3' },
    { key:'score_strategie', color:'#D97706', label:'Strategie', dash:'6,3' },
  ] as const

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
      {/* Gitter */}
      {[0,2,4,6,8,10].map(v=>(
        <g key={v}>
          <line x1={ml} y1={ys(v)} x2={ml+iW} y2={ys(v)}
            stroke="#F3F4F6" strokeWidth="1" strokeDasharray="3,3"/>
          <text x={ml-4} y={ys(v)} textAnchor="end" dominantBaseline="central"
            fill="#9CA3AF" fontSize="8" fontFamily="'Plus Jakarta Sans',sans-serif">
            {v}
          </text>
        </g>
      ))}

      {/* X-Achse */}
      {data.map((d,i)=>(
        <text key={i} x={xs(i)} y={H-6} textAnchor="middle"
          fill="#6B7280" fontSize="9" fontFamily="'Plus Jakarta Sans',sans-serif">
          {d.erhebungsjahr}
        </text>
      ))}

      {/* Linien */}
      {series.map(({key,color,dash})=>{
        const pts = data.map((d,i)=>`${xs(i)},${ys((d as any)[key]||0)}`).join(' ')
        return (
          <g key={key}>
            <polyline points={pts} fill="none" stroke={color}
              strokeWidth="2" strokeDasharray={dash||undefined} strokeLinecap="round"/>
            {data.map((d,i)=>(
              <circle key={i} cx={xs(i)} cy={ys((d as any)[key]||0)}
                r="3.5" fill={color} stroke="#fff" strokeWidth="1.5"/>
            ))}
          </g>
        )
      })}

      {/* Legende */}
      {series.map(({color,label,dash},i)=>(
        <g key={label} transform={`translate(${ml+i*100},${H-22})`}>
          <line x1="0" y1="6" x2="14" y2="6" stroke={color} strokeWidth="2"
            strokeDasharray={dash||undefined}/>
          <text x="18" y="9" fill="#6B7280" fontSize="8"
            fontFamily="'Plus Jakarta Sans',sans-serif">
            {label}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ── Delta-Karte ───────────────────────────────────────────────
function DeltaKarte({ label, aktuell, vorher, color }: {
  label:string; aktuell:number|null; vorher:number|null; color:string
}) {
  const delta = aktuell!=null && vorher!=null ? aktuell-vorher : null
  const dc = delta==null?'#9CA3AF':delta>0?'#16A34A':delta<0?'#DC2626':'#6B7280'

  return (
    <div style={{
      background:'#fff',border:'1px solid #E5E1D8',borderRadius:10,padding:'14px 16px'
    }}>
      <div style={{fontSize:17,color:'#9CA3AF',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.06em'}}>
        {label}
      </div>
      <div style={{
        fontSize:28,fontWeight:700,color,
        fontFamily:"'Fraunces',serif",lineHeight:1,marginBottom:4
      }}>
        {f(aktuell)}
      </div>
      {delta!=null && (
        <div style={{display:'flex',alignItems:'center',gap:4,fontSize:16,color:dc,fontWeight:500}}>
          {delta>0?'↑':delta<0?'↓':'→'}
          <span>{delta>0?'+':''}{f(delta)} zum Vorjahr</span>
        </div>
      )}
      {delta==null && (
        <div style={{fontSize:17,color:'#D1D5DB'}}>Kein Vorjahr</div>
      )}
      {/* Mini-Balken */}
      <div style={{background:'#F3F4F6',borderRadius:2,height:3,marginTop:8,overflow:'hidden'}}>
        <div style={{
          width:`${(aktuell||0)*10}%`,height:'100%',
          background:color,borderRadius:2,transition:'width .5s'
        }}/>
      </div>
    </div>
  )
}

// ── Maßnahmen-Kanban ──────────────────────────────────────────
function MassnahmenKanban({ massnahmen }: { massnahmen: Massnahme[] }) {
  const cols: {key:Massnahme['status'],label:string,color:string,bg:string}[] = [
    { key:'geplant',      label:'Geplant',      color:'#1D4ED8', bg:'#EFF6FF' },
    { key:'in Umsetzung', label:'In Umsetzung',  color:'#D97706', bg:'#FFFBEB' },
    { key:'umgesetzt',    label:'Umgesetzt',     color:'#16A34A', bg:'#F0FDF4' },
  ]

  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
      {cols.map(col=>{
        const items = massnahmen.filter(m=>m.status===col.key)
        return (
          <div key={col.key} style={{
            background:col.bg,border:`1px solid ${col.color}22`,
            borderRadius:10,padding:'12px 14px'
          }}>
            <div style={{
              display:'flex',justifyContent:'space-between',
              alignItems:'center',marginBottom:10
            }}>
              <span style={{fontSize:17,fontWeight:500,color:col.color,
                textTransform:'uppercase',letterSpacing:'0.06em'}}>
                {col.label}
              </span>
              <span style={{
                fontSize:17,fontWeight:600,
                background:`${col.color}22`,color:col.color,
                borderRadius:99,padding:'1px 7px'
              }}>
                {items.length}
              </span>
            </div>
            {items.map(m=>(
              <div key={m.id} style={{
                background:'#fff',borderRadius:7,padding:'9px 11px',
                marginBottom:6,border:`1px solid ${col.color}22`,
                fontSize:15,color:'#374151'
              }}>
                <div style={{fontWeight:500,marginBottom:m.zieldatum?3:0}}>
                  {m.titel}
                </div>
                {m.zieldatum && (
                  <div style={{fontSize:16,color:'#9CA3AF'}}>
                    {new Date(m.zieldatum).toLocaleDateString('de-DE',{month:'short',year:'numeric'})}
                  </div>
                )}
                {m.sicht_nr && (
                  <div style={{fontSize:16,color:col.color,marginTop:3}}>
                    Sicht {m.sicht_nr}
                  </div>
                )}
              </div>
            ))}
            {!items.length && (
              <div style={{fontSize:17,color:`${col.color}88`,textAlign:'center',padding:'12px 0'}}>
                Keine Einträge
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────
export default function TrackingPanel({
  kommune,
  setKommune,
}: {
  kommune: string
  setKommune?: (n:string)=>void
}) {
  const [scores,     setScores]     = useState<ScoreZeit[]>([])
  const [massnahmen, setMassnahmen] = useState<Massnahme[]>([])
  const [loading,    setLoading]    = useState(true)
  const [viewMode,   setViewMode]   = useState<'zeitreihe'|'kanban'>('zeitreihe')

  const ZEITREIHE_KOMMUNEN = ['Leuna','Querfurt','Gerbstedt','Bad Dürrenberg']

  useEffect(()=>{
    setLoading(true)
    fetch(`/api/benchmark?kommune=${encodeURIComponent(kommune)}&jahr=2024`)
      .then(r=>r.json())
      .then(d=>{
        setScores(d.scores||[])
        setMassnahmen(d.massnahmen||[])
        setLoading(false)
      })
      .catch(()=>setLoading(false))
  },[kommune])

  const sortedScores = [...scores].sort((a,b)=>a.erhebungsjahr-b.erhebungsjahr)
  const aktuell = sortedScores[sortedScores.length-1]
  const vorjahr = sortedScores[sortedScores.length-2]

  const hatZeitreihe = sortedScores.length >= 2

  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <h1 style={{
          fontFamily:"'Fraunces',serif",fontSize:32,fontWeight:700,
          color:'#1A1816',letterSpacing:'-0.02em',marginBottom:4
        }}>
          Fortschritts-Tracker
        </h1>
        <p style={{color:'#6B6459',fontSize:17}}>
          Entwicklung der Benchmark-Scores über Zeit —{' '}
          <strong style={{color:'#1A1816'}}>{kommune}</strong>
        </p>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:60,color:'#9CA3AF',fontSize:17}}>
          Zeitreihe wird geladen...
        </div>
      ) : (
        <>
          {/* Delta-Karten */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
            <DeltaKarte label="Gesamt"    aktuell={aktuell?.score_gesamt}    vorher={vorjahr?.score_gesamt}    color="#1D4ED8"/>
            <DeltaKarte label="Strategie" aktuell={aktuell?.score_strategie} vorher={vorjahr?.score_strategie} color="#7C3AED"/>
            <DeltaKarte label="Plattform" aktuell={aktuell?.score_plattform} vorher={vorjahr?.score_plattform} color="#059669"/>
            <DeltaKarte label="Netzwerk"  aktuell={aktuell?.score_netzwerk}  vorher={vorjahr?.score_netzwerk}  color="#D97706"/>
          </div>

          {/* Zeitreihe oder Hinweis */}
          {hatZeitreihe ? (
            <div style={{
              background:'#fff',border:'1px solid #E5E1D8',borderRadius:12,
              padding:'16px 20px',marginBottom:14
            }}>
              <div style={{
                fontSize:17,fontWeight:500,color:'#6B6459',
                textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:14
              }}>
                Score-Entwicklung {sortedScores[0].erhebungsjahr}–{sortedScores[sortedScores.length-1].erhebungsjahr}
              </div>
              <LineChart data={sortedScores}/>
            </div>
          ) : (
            <div style={{
              background:'#FAFAF9',border:'1px dashed #E5E1D8',borderRadius:12,
              padding:'32px',textAlign:'center',marginBottom:14
            }}>
              <div style={{fontSize:28,color:'#E5E1D8',marginBottom:10,fontFamily:"'Fraunces',serif"}}>◈</div>
              <div style={{fontSize:17,color:'#9CA3AF',marginBottom:6}}>
                Noch keine Zeitreihe für {kommune}
              </div>
              <div style={{fontSize:15,color:'#D1D5DB',marginBottom:14}}>
                Zeitreihen entstehen nach der zweiten Erhebung
              </div>
              <div style={{fontSize:15,color:'#6B7280',marginBottom:8}}>
                Kommunen mit Zeitreihe:
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:6,flexWrap:'wrap'}}>
                {ZEITREIHE_KOMMUNEN.map(k=>(
                  <button key={k}
                    onClick={()=>setKommune?.(k)}
                    style={{
                      padding:'5px 12px',fontSize:17,fontWeight:500,
                      border:'1px solid #E5E1D8',borderRadius:6,
                      background:'#fff',color:'#374151',cursor:'pointer'
                    }}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Maßnahmen Toggle */}
          <div style={{
            background:'#fff',border:'1px solid #E5E1D8',borderRadius:12,
            overflow:'hidden'
          }}>
            <div style={{
              display:'flex',justifyContent:'space-between',alignItems:'center',
              padding:'14px 18px',borderBottom:'1px solid #E5E1D8',
              background:'#FAFAF9'
            }}>
              <div style={{
                fontSize:17,fontWeight:500,color:'#6B6459',
                textTransform:'uppercase',letterSpacing:'0.07em'
              }}>
                IGEK-Maßnahmen-Status
              </div>
              <div style={{display:'flex',gap:4}}>
                {(['zeitreihe','kanban'] as const).map(v=>(
                  <button key={v} onClick={()=>setViewMode(v)}
                    style={{
                      padding:'5px 12px',fontSize:17,
                      border:`1px solid ${viewMode===v?'#1B3A5C':'#E5E1D8'}`,
                      borderRadius:6,cursor:'pointer',
                      background:viewMode===v?'#1B3A5C':'#fff',
                      color:viewMode===v?'#fff':'#6B6459',
                      textTransform:'capitalize'
                    }}>
                    {v==='zeitreihe'?'Liste':'Kanban'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{padding:'16px 18px'}}>
              {viewMode==='kanban' ? (
                <MassnahmenKanban massnahmen={massnahmen}/>
              ) : (
                <>
                  {massnahmen.length>0 ? (
                    massnahmen.map(m=>{
                      const cfgs = {
                        'umgesetzt':    {c:'#16A34A',bg:'#F0FDF4',b:'#BBF7D0',i:'✓'},
                        'in Umsetzung': {c:'#D97706',bg:'#FFFBEB',b:'#FDE68A',i:'◐'},
                        'geplant':      {c:'#1D4ED8',bg:'#EFF6FF',b:'#BFDBFE',i:'○'},
                        'abgebrochen':  {c:'#DC2626',bg:'#FEF2F2',b:'#FECACA',i:'✗'},
                      }
                      const cfg = cfgs[m.status]
                      return (
                        <div key={m.id} style={{
                          display:'flex',alignItems:'center',gap:12,
                          padding:'10px 0',borderBottom:'1px solid #F3F4F6'
                        }}>
                          <span style={{
                            width:22,height:22,borderRadius:'50%',
                            background:cfg.bg,border:`1px solid ${cfg.b}`,
                            color:cfg.c,display:'flex',alignItems:'center',
                            justifyContent:'center',fontSize:17,
                            flexShrink:0,fontWeight:600
                          }}>
                            {cfg.i}
                          </span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:16,color:'#111827'}}>{m.titel}</div>
                            {m.zieldatum && (
                              <div style={{fontSize:17,color:'#9CA3AF',marginTop:1}}>
                                {new Date(m.zieldatum).toLocaleDateString('de-DE',{day:'2-digit',month:'long',year:'numeric'})}
                              </div>
                            )}
                          </div>
                          {m.sicht_nr && (
                            <span style={{fontSize:17,color:'#9CA3AF'}}>Sicht {m.sicht_nr}</span>
                          )}
                          <span style={{
                            fontSize:16,fontWeight:500,
                            padding:'2px 9px',borderRadius:99,
                            background:cfg.bg,color:cfg.c,
                            border:`1px solid ${cfg.b}`,whiteSpace:'nowrap'
                          }}>
                            {m.status}
                          </span>
                        </div>
                      )
                    })
                  ) : (
                    <div style={{textAlign:'center',padding:24,color:'#9CA3AF',fontSize:16}}>
                      Keine Maßnahmen erfasst
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
