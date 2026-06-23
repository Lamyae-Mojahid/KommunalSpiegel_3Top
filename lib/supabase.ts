import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// ── Typen ─────────────────────────────────────────────────────
export interface Kommune {
  id: number
  name: string
  landkreis?: string
  einwohner?: number
  lat?: number
  lng?: number
}

export interface Score {
  id: number
  kommune_id: number
  erhebungsjahr: number
  score_strategie: number | null
  score_plattform: number | null
  score_netzwerk: number | null
  score_gesamt: number | null
  rang: number | null
  datenvollst: number
  kommune?: Kommune
}

export interface BenchmarkWert {
  id: number
  kommune_id: number
  sicht_nr: number
  kennzahl: string
  wert_num: number | null
  score_normiert: number | null
  erhebungsjahr: number
}

export interface Massnahme {
  id: number
  kommune_id: number
  titel: string
  sicht_nr?: number
  status: 'geplant' | 'in Umsetzung' | 'umgesetzt' | 'abgebrochen'
  zieldatum?: string
  notiz?: string
}

// ── Hilfsfunktionen ──────────────────────────────────────────
export const scoreColor = (v: number | null | undefined) => {
  if (v == null) return '#888780'
  if (v >= 7) return '#3B6D11'
  if (v >= 4) return '#854F0B'
  if (v >= 1) return '#A32D2D'
  return '#888780'
}

export const scoreLabel = (v: number | null | undefined) => {
  if (v == null) return 'Keine Daten'
  if (v >= 7) return 'Stark'
  if (v >= 4) return 'Mittel'
  if (v >= 1) return 'Schwach'
  return '—'
}

export const fmt = (v: number | null | undefined, d = 1) =>
  v != null ? v.toFixed(d) : '—'
