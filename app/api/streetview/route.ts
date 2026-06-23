// app/api/streetview/route.ts
import { NextRequest, NextResponse } from 'next/server'

const MAPILLARY_TOKEN = process.env.MAPILLARY_ACCESS_TOKEN
const MAPILLARY_BASE = 'https://graph.mapillary.com'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Paramètres lat et lng requis' }, { status: 400 })
  }

  if (!MAPILLARY_TOKEN) {
    return NextResponse.json({ error: 'MAPILLARY_ACCESS_TOKEN manquant dans .env.local' }, { status: 500 })
  }

  try {
    const latN = parseFloat(lat)
    const lngN = parseFloat(lng)

    // bbox ~1km autour du centre de la commune
    const delta = 0.01
    const bbox = `${lngN - delta},${latN - delta},${lngN + delta},${latN + delta}`

    // 1. Essai avec panoramas 360° uniquement
    const url1 = new URL(`${MAPILLARY_BASE}/images`)
    url1.searchParams.set('bbox', bbox)
    url1.searchParams.set('limit', '10')
    url1.searchParams.set('is_pano', 'true')
    url1.searchParams.set('fields', 'id,thumb_2048_url,thumb_original_url,geometry,captured_at,is_pano,sequence')
    url1.searchParams.set('access_token', MAPILLARY_TOKEN)

    const res1 = await fetch(url1.toString())
    if (!res1.ok) {
      const err = await res1.text()
      return NextResponse.json({ error: 'Erreur Mapillary API', details: err }, { status: res1.status })
    }
    const data1 = await res1.json()

    if (data1.data && data1.data.length > 0) {
      return NextResponse.json({ images: data1.data, total: data1.data.length, coords: { lat: latN, lng: lngN } })
    }

    // 2. Fallback : toutes images (pas seulement panoramas)
    const url2 = new URL(`${MAPILLARY_BASE}/images`)
    url2.searchParams.set('bbox', bbox)
    url2.searchParams.set('limit', '10')
    url2.searchParams.set('fields', 'id,thumb_2048_url,thumb_original_url,geometry,captured_at,is_pano,sequence')
    url2.searchParams.set('access_token', MAPILLARY_TOKEN)

    const res2 = await fetch(url2.toString())
    const data2 = await res2.json()

    return NextResponse.json({
      images: data2.data || [],
      total: data2.data?.length || 0,
      coords: { lat: latN, lng: lngN },
    })

  } catch (error) {
    console.error('Erreur streetview route:', error)
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 })
  }
}