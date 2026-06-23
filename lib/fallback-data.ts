// Zentrale Fallback-/Startdaten für den KommunalSpiegel
// Zweck: Die Anwendung bleibt auch ohne Supabase-Verbindung funktionsfähig.
// Fachlogik: manuelle Vorprojekt-Erhebung 2024 als Startbestand, danach Agentenlauf zur Aktualisierung.

export const SICHTEN = [
  { nr:1, name:'IGEK-Abdeckung', schicht:'Strategie', einheit:'Sichten von 10', ziel:'Integrierte Stadtentwicklung / IGEK-ISEK' },
  { nr:2, name:'Virtuelle Touren', schicht:'Plattform', einheit:'pro 1.000 EW', ziel:'Digitale Sichtbarkeit / Tourismus' },
  { nr:3, name:'360° Streetview', schicht:'Plattform', einheit:'% Straßennetz', ziel:'Digitale Standorttransparenz' },
  { nr:4, name:'Ladeinfrastruktur', schicht:'Plattform', einheit:'Plätze / 1.000 EW', ziel:'Nachhaltige Mobilität' },
  { nr:5, name:'Festnetz', schicht:'Plattform', einheit:'Mbit/s Ø', ziel:'Digitale Infrastruktur' },
  { nr:6, name:'Mobilfunk', schicht:'Plattform', einheit:'Empfangsqualität', ziel:'Digitale Daseinsvorsorge' },
  { nr:7, name:'Digitale Services', schicht:'Plattform', einheit:'Reifegrad 1–3', ziel:'Verwaltungsmodernisierung' },
  { nr:8, name:'Social Media', schicht:'Netzwerk', einheit:'Kanaldichte', ziel:'Bürgerkommunikation' },
]

export const KOMMUNEN = [
  { name:'Leuna', landkreis:'Saalekreis', einwohner:15200, lat:51.31, lng:12.00, website:'https://www.leuna.de' },
  { name:'Braunsbedra', landkreis:'Saalekreis', einwohner:11000, lat:51.28, lng:11.88, website:'https://www.braunsbedra.de' },
  { name:'Querfurt', landkreis:'Saalekreis', einwohner:12500, lat:51.38, lng:11.60, website:'https://www.querfurt.de' },
  { name:'Mücheln (Geiseltal)', landkreis:'Saalekreis', einwohner:9800, lat:51.30, lng:11.79, website:'https://www.muecheln.de' },
  { name:'Salzatal', landkreis:'Saalekreis', einwohner:7200, lat:51.45, lng:11.77, website:'https://www.gemeinde-salzatal.de' },
  { name:'Seegebiet Mansfelder Land', landkreis:'Mansfeld-Südharz', einwohner:8900, lat:51.53, lng:11.53, website:'https://www.seegebiet-mansfelder-land.de' },
  { name:'Gerbstedt', landkreis:'Mansfeld-Südharz', einwohner:6500, lat:51.63, lng:11.62, website:'https://www.stadt-gerbstedt.de' },
  { name:'Wettin-Löbejün', landkreis:'Saalekreis', einwohner:11000, lat:51.60, lng:11.90, website:'https://www.stadt-wettin-loebejuen.de' },
  { name:'Bad Dürrenberg', landkreis:'Saalekreis', einwohner:9600, lat:51.29, lng:12.06, website:'https://www.badduerrenberg.de' },
  { name:'Lutherstadt Eisleben', landkreis:'Mansfeld-Südharz', einwohner:23000, lat:51.53, lng:11.55, website:'https://www.eisleben.eu' },
  { name:'Bad Lauchstädt', landkreis:'Saalekreis', einwohner:9200, lat:51.39, lng:11.88, website:'https://www.goethestadt-bad-lauchstaedt.de' },
  { name:'Allstedt', landkreis:'Mansfeld-Südharz', einwohner:5800, lat:51.38, lng:11.37, website:'https://www.allstedt.de' },
  { name:'Kabelsketal', landkreis:'Saalekreis', einwohner:10800, lat:51.43, lng:12.01, website:'https://www.kabelsketal.de' },
  { name:'Landsberg', landkreis:'Saalekreis', einwohner:14000, lat:51.52, lng:12.17, website:'https://www.stadt-landsberg.de' },
  { name:'Muldestausee', landkreis:'Anhalt-Bitterfeld', einwohner:12000, lat:51.66, lng:12.35, website:'https://www.gemeinde-muldestausee.de' },
  { name:'Sandersdorf-Brehna', landkreis:'Anhalt-Bitterfeld', einwohner:15500, lat:51.62, lng:12.22, website:'https://www.sandersdorf-brehna.de' },
  { name:'Köthen (Anhalt)', landkreis:'Anhalt-Bitterfeld', einwohner:26000, lat:51.75, lng:11.97, website:'https://www.koethen-anhalt.de' },
  { name:'Hohenmölsen', landkreis:'Burgenlandkreis', einwohner:9200, lat:51.15, lng:12.10, website:'https://www.stadt-hohenmoelsen.de' },
  { name:'Osternienburger Land', landkreis:'Anhalt-Bitterfeld', einwohner:11000, lat:51.76, lng:12.05, website:'https://www.osternienburgerland.de' },
  { name:'Südliches Anhalt', landkreis:'Anhalt-Bitterfeld', einwohner:17000, lat:51.62, lng:11.72, website:'https://www.suedliches-anhalt.de' },
  { name:'Merseburg', landkreis:'Saalekreis', einwohner:33000, lat:51.36, lng:11.99, website:'https://www.merseburg.de' },
  { name:'Schkopau', landkreis:'Saalekreis', einwohner:11200, lat:51.39, lng:11.95, website:'https://www.gemeinde-schkopau.de' },
  { name:'Teutschenthal', landkreis:'Saalekreis', einwohner:13000, lat:51.45, lng:11.80, website:'https://www.teutschenthal.de' },
  { name:'Petersberg', landkreis:'Saalekreis', einwohner:9300, lat:51.58, lng:11.96, website:'https://www.gemeinde-petersberg.de' },
  { name:'Weißenfels', landkreis:'Burgenlandkreis', einwohner:39000, lat:51.20, lng:11.97, website:'https://www.weissenfels.de' },
  { name:'Naumburg (Saale)', landkreis:'Burgenlandkreis', einwohner:32000, lat:51.15, lng:11.81, website:'https://www.naumburg.de' },
  { name:'Zeitz', landkreis:'Burgenlandkreis', einwohner:27000, lat:51.05, lng:12.14, website:'https://www.zeitz.de' },
  { name:'Teuchern', landkreis:'Burgenlandkreis', einwohner:8200, lat:51.12, lng:12.02, website:'https://www.stadt-teuchern.de' },
  { name:'Lützen', landkreis:'Burgenlandkreis', einwohner:8500, lat:51.26, lng:12.14, website:'https://www.stadt-luetzen.de' },
  { name:'Sangerhausen', landkreis:'Mansfeld-Südharz', einwohner:26000, lat:51.47, lng:11.30, website:'https://www.sangerhausen.de' },
  { name:'Mansfeld', landkreis:'Mansfeld-Südharz', einwohner:8900, lat:51.59, lng:11.46, website:'https://www.mansfeld.eu' },
  { name:'Arnstein', landkreis:'Mansfeld-Südharz', einwohner:6800, lat:51.70, lng:11.45, website:'https://www.arnstein-harz.de' },
  { name:'Hettstedt', landkreis:'Mansfeld-Südharz', einwohner:13500, lat:51.65, lng:11.51, website:'https://www.hettstedt.de' },
]

type Raw = { name:string; s1:number|null; s2:number|null; s3:number|null; s4:number|null; s5:number|null; s6:number|null; s7:number|null; s8:number|null; voll?:number }
const RAW: Raw[] = [
  {name:'Leuna',s1:8,s2:6.8,s3:9.3,s4:10,s5:9.2,s6:5.1,s7:10,s8:10,voll:100},
  {name:'Braunsbedra',s1:5,s2:2.2,s3:4.4,s4:6,s5:7.4,s6:8.1,s7:6,s8:5.2,voll:88},
  {name:'Querfurt',s1:10,s2:0,s3:4.2,s4:5.1,s5:7.8,s6:7.9,s7:2,s8:1.2,voll:100},
  {name:'Mücheln (Geiseltal)',s1:10,s2:0,s3:6.3,s4:1,s5:6.4,s6:5.5,s7:2.5,s8:1,voll:88},
  {name:'Salzatal',s1:10,s2:1,s3:2,s4:6.9,s5:5.8,s6:3.1,s7:1.8,s8:0,voll:88},
  {name:'Seegebiet Mansfelder Land',s1:4,s2:1.2,s3:3.2,s4:7.6,s5:5.9,s6:4.6,s7:2.3,s8:4.3,voll:88},
  {name:'Gerbstedt',s1:6,s2:0,s3:0,s4:0,s5:4.2,s6:2.1,s7:1.5,s8:4,voll:100},
  {name:'Wettin-Löbejün',s1:8,s2:1.5,s3:2.5,s4:1,s5:5.8,s6:0,s7:2,s8:1.8,voll:88},
  {name:'Bad Dürrenberg',s1:3,s2:2,s3:4.2,s4:9.3,s5:6.5,s6:4.4,s7:2.1,s8:5.8,voll:100},
  {name:'Lutherstadt Eisleben',s1:5,s2:1.5,s3:4.3,s4:6.6,s5:6.7,s6:6.6,s7:3.6,s8:1.2,voll:88},
  {name:'Bad Lauchstädt',s1:4,s2:1.8,s3:3.8,s4:7,s5:6.1,s6:5.1,s7:2.8,s8:1.5,voll:88},
  {name:'Allstedt',s1:3,s2:1,s3:2,s4:4,s5:4.8,s6:2.9,s7:1.5,s8:3.2,voll:88},
  {name:'Kabelsketal',s1:3.5,s2:0.8,s3:2.8,s4:0.3,s5:6.6,s6:5,s7:2.8,s8:2.1,voll:88},
  {name:'Landsberg',s1:4,s2:1.2,s3:4,s4:8,s5:6.8,s6:6.5,s7:2.5,s8:1.6,voll:88},
  {name:'Muldestausee',s1:4,s2:.5,s3:5.4,s4:.6,s5:7.3,s6:6.5,s7:1.5,s8:.5,voll:88},
  {name:'Sandersdorf-Brehna',s1:3.8,s2:1,s3:2.5,s4:8.7,s5:3.7,s6:0,s7:2.5,s8:.6,voll:75},
  {name:'Köthen (Anhalt)',s1:5.8,s2:0,s3:.6,s4:.3,s5:7.9,s6:5,s7:.8,s8:1,voll:88},
  {name:'Hohenmölsen',s1:2.5,s2:.8,s3:1.5,s4:1.8,s5:4.6,s6:2.8,s7:1.2,s8:0,voll:75},
  {name:'Osternienburger Land',s1:3,s2:.5,s3:5.3,s4:1.5,s5:0,s6:8.9,s7:1.5,s8:2.6,voll:75},
  {name:'Südliches Anhalt',s1:2.8,s2:0,s3:10,s4:0,s5:4.2,s6:2.2,s7:1.2,s8:1,voll:75},
  {name:'Merseburg',s1:8.5,s2:5.2,s3:8,s4:6.5,s5:8.4,s6:7.8,s7:7.2,s8:8.2,voll:100},
  {name:'Schkopau',s1:5.8,s2:1.5,s3:4.2,s4:5.8,s5:7.9,s6:6.8,s7:3.5,s8:3,voll:88},
  {name:'Teutschenthal',s1:5,s2:1,s3:3.5,s4:2.2,s5:6.2,s6:5.4,s7:2.8,s8:2.4,voll:88},
  {name:'Petersberg',s1:4.6,s2:1.2,s3:3.8,s4:2.8,s5:5.8,s6:5.1,s7:2.2,s8:2.8,voll:88},
  {name:'Weißenfels',s1:7.5,s2:4.5,s3:7.2,s4:5.6,s5:7.8,s6:6.5,s7:5.8,s8:7.2,voll:100},
  {name:'Naumburg (Saale)',s1:8,s2:6,s3:7.8,s4:4.2,s5:7.2,s6:6.1,s7:5.2,s8:7.6,voll:100},
  {name:'Zeitz',s1:6.8,s2:3.8,s3:5.5,s4:3.2,s5:6.8,s6:5.8,s7:4.2,s8:5.8,voll:100},
  {name:'Teuchern',s1:3.8,s2:1,s3:2.2,s4:1.5,s5:5.2,s6:4.4,s7:1.8,s8:1.5,voll:88},
  {name:'Lützen',s1:4.2,s2:1.8,s3:3.2,s4:2.5,s5:5.9,s6:5.2,s7:2.2,s8:2.4,voll:88},
  {name:'Sangerhausen',s1:6.4,s2:3.5,s3:5.8,s4:4.4,s5:6.9,s6:5.9,s7:4.5,s8:5.5,voll:100},
  {name:'Mansfeld',s1:4.5,s2:1.2,s3:2.5,s4:1.8,s5:4.8,s6:4.2,s7:1.7,s8:2.3,voll:88},
  {name:'Arnstein',s1:3.2,s2:.8,s3:2.2,s4:1.2,s5:4.2,s6:3.6,s7:1.3,s8:1.7,voll:75},
  {name:'Hettstedt',s1:5.5,s2:2.2,s3:4.8,s4:3.8,s5:6.2,s6:5.1,s7:3.4,s8:4.8,voll:100},
]

function avg(vals: (number|null|undefined)[]) { const a=vals.filter((v):v is number=>typeof v==='number'); return a.length ? a.reduce((s,v)=>s+v,0)/a.length : null }
function round(v:number|null|undefined,d=1){ return typeof v==='number' ? Number(v.toFixed(d)) : null }

export const SCORE_ROWS = RAW.map((r,idx)=> {
  const strat = avg([r.s1])
  const platt = avg([r.s2,r.s3,r.s4,r.s5,r.s6,r.s7])
  const netz = avg([r.s8])
  const gesamt = avg([strat,platt,netz])
  return {...r, strat:round(strat), platt:round(platt), netz:round(netz), gesamt:round(gesamt), voll:r.voll ?? 100}
}).sort((a,b)=>(b.gesamt??0)-(a.gesamt??0)).map((r,idx)=>({...r, rang:idx+1}))

export function fallbackAllScores(jahr=2024) {
  return SCORE_ROWS.map((s,idx)=> {
    const k = KOMMUNEN.find(k=>k.name===s.name) || KOMMUNEN[idx]
    return {
      id: idx+1, kommune_id: idx+1, erhebungsjahr: jahr,
      score_strategie: s.strat, score_plattform: s.platt, score_netzwerk: s.netz,
      score_gesamt: s.gesamt, rang: s.rang, datenvollst: s.voll,
      kommune: { id: idx+1, name: k.name, landkreis: k.landkreis, einwohner: k.einwohner, lat:k.lat, lng:k.lng }
    }
  })
}

export function fallbackDetail(name:string, jahr=2024) {
  const all = fallbackAllScores(jahr)
  const score = all.find(s=>s.kommune.name===name) || all[0]
  const raw = SCORE_ROWS.find(s=>s.name===score.kommune.name) || SCORE_ROWS[0]
  const werte = SICHTEN.map((sicht,idx)=> {
    const key = `s${sicht.nr}` as keyof Raw
    const value = raw[key] as number | null
    return { id:idx+1, kommune_id:score.kommune_id, sicht_nr:sicht.nr, kennzahl:sicht.name, wert_num:value, wert_text:null, score_normiert:value, erhebungsjahr:jahr, quelle:'Vorprojekt-Erhebung 2024 + Fallback-Datenbestand', quelle_typ:'manuell/fallback', letzter_abruf:new Date().toISOString(), updated_at:new Date().toISOString() }
  })
  const schwach = werte.filter(w=>typeof w.score_normiert==='number').sort((a,b)=>(a.score_normiert??0)-(b.score_normiert??0)).slice(0,3)
  const massnahmen = schwach.map((w,idx)=>({
    id: idx+1, kommune_id: score.kommune_id, titel: massnahmeTitel(w.sicht_nr), sicht_nr: w.sicht_nr,
    status: idx===0 ? 'geplant' : idx===1 ? 'in Umsetzung' : 'geplant',
    zieldatum: idx===0 ? '2025-12-31' : '2026-06-30',
    notiz: `Automatisch aus Schwäche '${w.kennzahl}' abgeleitet. Fachliche Freigabe erforderlich.`
  }))
  return {
    kommune: score.kommune,
    scores: [score],
    werte,
    benchmark: werte,
    massnahmen,
    live: { daten: createLiveStatus(score.kommune.name), abgerufen: new Date().toISOString() },
    sourceRuns: fallbackSyncLogs(),
    fallback: true,
    hinweis: 'Fallback aktiv: Die Anwendung nutzt den eingebauten Startbestand aus der manuellen Vorprojekt-Erhebung. Supabase/Live-Quellen können später verbunden werden.'
  }
}

export function massnahmeTitel(sicht:number) {
  const map:Record<number,string> = {
    1:'IGEK/ISEK-Zielsystem digital fortschreiben',
    2:'Virtuellen Ortsrundgang und Standortprofil erstellen',
    3:'360°-/Karten-Sichtbarkeit öffentlicher Orte prüfen',
    4:'Ladeinfrastruktur priorisiert ausbauen',
    5:'Breitband-/Gewerbegebietsversorgung prüfen',
    6:'Mobilfunklücken mit Netzbetreibern klären',
    7:'Online-Bürgerservices und Terminlogik ausbauen',
    8:'Kommunikations- und Beteiligungskanäle professionalisieren',
  }
  return map[sicht] || 'Maßnahme fachlich prüfen'
}

export function ampel(score:number|null|undefined) {
  if (score == null) return { status:'grau', label:'Daten fehlen', color:'#6B7280', bg:'#F3F4F6' }
  if (score < 4) return { status:'rot', label:'akuter Handlungsbedarf', color:'#B91C1C', bg:'#FEF2F2' }
  if (score < 7) return { status:'gelb', label:'beobachten / verbessern', color:'#B45309', bg:'#FFFBEB' }
  return { status:'gruen', label:'stabil / fortführen', color:'#166534', bg:'#F0FDF4' }
}

export function createLiveStatus(kommune:string) {
  return {
    kommune,
    modus:'hybrid',
    zusammenfassung:'Manuelle Erhebung als Startbestand; Agentenlauf prüft ergänzende Live-Quellen und markiert Abweichungen.',
    quellen:[
      { name:'Vorprojekt CSV/Excel', status:'ok', art:'Startbestand', datenqualitaet:'hoch', aktion:'importiert' },
      { name:'Kommunale Webseite', status:'prüfbar', art:'Webseiten-Agent', datenqualitaet:'mittel', aktion:'IGEK/ISEK, Online-Dienste, Beteiligung suchen' },
      { name:'OpenStreetMap/Overpass', status:'prüfbar', art:'Live-Quelle', datenqualitaet:'mittel', aktion:'POI, Ladepunkte, Daseinsvorsorge zählen' },
      { name:'GovData / Landesdaten', status:'prüfbar', art:'Open Data', datenqualitaet:'mittel', aktion:'Datensätze mit Sachsen-Anhalt-Bezug suchen' },
    ]
  }
}

export function fallbackSyncLogs() {
  return [{
    id:1, synced_at:new Date().toISOString(), kommunen_count:33, fehler_count:0, dauer_ms:1240,
    details:[
      { agent:'Datenquellen-Agent', status:'ok', ergebnis:'33 Kommunen im Startbestand erkannt; Live-Quellen für Folgeabrufe vorbereitet.' },
      { agent:'Validierungs-Agent', status:'ok', ergebnis:'Datenvollständigkeit je Kommune berechnet; fehlende Werte als Prüfbedarf markiert.' },
      { agent:'Benchmarking-Agent', status:'ok', ergebnis:'Scores, Rangfolge und Peer-Vergleich neu berechnet.' },
      { agent:'IGEK/ISEK-Mapping-Agent', status:'ok', ergebnis:'Schwächen auf Handlungsfelder Strategie, Plattform, Netzwerk gemappt.' },
      { agent:'Maßnahmen-Agent', status:'ok', ergebnis:'Ampelmaßnahmen als Entwurf erzeugt; Freigabe durch Verwaltung erforderlich.' },
    ]
  }]
}

export const FOERDER_FALLBACK = [
  { id:'strukturwandel-st', titel:'Strukturwandel / Revier Sachsen-Anhalt Süd', anbieter:'Bund/Land Sachsen-Anhalt', sicht_nr:1, match_basis:.86, max_foerderung:'projektabhängig', frist:'aufrufabhängig', url:'https://strukturwandel.sachsen-anhalt.de', beschreibung:'Förderumfeld für Standortentwicklung, Innovation, Daseinsvorsorge und Transformation.', tags:['Strukturwandel','Sachsen-Anhalt','Stadtentwicklung'] },
  { id:'smart-city-bmwsb', titel:'Modellprojekte Smart Cities / Smarte Kommunen', anbieter:'BMWSB / Bund', sicht_nr:7, match_basis:.84, max_foerderung:'aufrufabhängig', frist:'periodische Aufrufe', url:'https://www.bmwsb.bund.de', beschreibung:'Förderumfeld für Datenplattformen, digitale Strategien und Beteiligung.', tags:['Smart City','Datenplattform','Verwaltung'] },
  { id:'efre-st', titel:'EFRE Sachsen-Anhalt – nachhaltige Stadtentwicklung', anbieter:'EU / Land Sachsen-Anhalt', sicht_nr:5, match_basis:.78, max_foerderung:'programmspezifisch', frist:'Förderperiode', url:'https://europa.sachsen-anhalt.de', beschreibung:'EU-/Landesförderung für regionale Entwicklung, Infrastruktur und Digitalisierung.', tags:['EFRE','Infrastruktur','Sachsen-Anhalt'] },
  { id:'ladeinfrastruktur', titel:'Ladeinfrastruktur und Elektromobilität', anbieter:'Bund/Land/KfW', sicht_nr:4, match_basis:.9, max_foerderung:'aufrufabhängig', frist:'laufend/aufrufabhängig', url:'https://www.foerderdatenbank.de', beschreibung:'Förderumfeld für kommunale Ladepunkte und nachhaltige Mobilität.', tags:['Ladeinfrastruktur','Mobilität','Klimaschutz'] },
  { id:'beteiligung', titel:'Digitale Beteiligung und Engagementförderung', anbieter:'Bund/Land/Stiftungen', sicht_nr:8, match_basis:.7, max_foerderung:'programmabhängig', frist:'periodisch', url:'https://www.foerderdatenbank.de', beschreibung:'Förderung von Bürgerbeteiligung, Ehrenamt, Kommunikation und lokalen Netzwerken.', tags:['Beteiligung','Social Media','Netzwerk'] },
]
