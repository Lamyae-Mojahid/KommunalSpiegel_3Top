'use client'

// components/StreetViewWidget.tsx
// Widget Street View Mapillary pour KommunalSpiegel
// Usage: <StreetViewWidget lat={51.3} lng={12.0} kommuneName="Leuna" />

import { useState, useEffect, useCallback } from 'react'

interface StreetViewImage {
  id: string
  thumb_2048_url?: string
  thumb_original_url?: string
  geometry: { coordinates: [number, number] }
  captured_at: number
  is_pano: boolean
  sequence: string
}

interface StreetViewWidgetProps {
  lat: number
  lng: number
  kommuneName: string
  radius?: number
  className?: string
}

export default function StreetViewWidget({
  lat,
  lng,
  kommuneName,
  radius = 50,
  className = '',
}: StreetViewWidgetProps) {
  const [images, setImages] = useState<StreetViewImage[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const fetchImages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/streetview?lat=${lat}&lng=${lng}&radius=${radius}`
      )
      if (!res.ok) throw new Error('Erreur API streetview')
      const data = await res.json()
      if (data.images && data.images.length > 0) {
        setImages(data.images)
      } else {
        setError('Keine Mapillary-Bilder in der Nähe verfügbar')
      }
    } catch (e) {
      setError('Impossible de charger les images Mapillary')
    } finally {
      setLoading(false)
    }
  }, [lat, lng, radius])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  const currentImage = images[currentIndex]
  const imageUrl = currentImage?.thumb_2048_url || currentImage?.thumb_original_url
  const capturedDate = currentImage
    ? new Date(currentImage.captured_at).toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'long',
      })
    : null

  const mapillaryViewUrl = currentImage
    ? `https://www.mapillary.com/app/?pKey=${currentImage.id}&focus=photo`
    : null

  return (
    <div
      className={`street-view-widget ${className}`}
      style={{
        background: '#0f172a',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Mapillary icon SVG */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#1db954">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
          </svg>
          <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Street View · {kommuneName}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {images.length > 0 && (
            <span style={{ color: '#475569', fontSize: '11px' }}>
              {currentIndex + 1}/{images.length}
            </span>
          )}
          {mapillaryViewUrl && (
            <a
              href={mapillaryViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#38bdf8',
                fontSize: '11px',
                textDecoration: 'none',
                padding: '2px 8px',
                border: '1px solid rgba(56,189,248,0.3)',
                borderRadius: '4px',
              }}
            >
              Öffnen ↗
            </a>
          )}
        </div>
      </div>

      {/* Image area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: expanded ? '400px' : '220px',
          transition: 'height 0.3s ease',
          background: '#0a0f1a',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '12px',
          }}>
            <div style={{
              width: '32px', height: '32px',
              border: '2px solid rgba(56,189,248,0.2)',
              borderTopColor: '#38bdf8',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{ color: '#475569', fontSize: '12px' }}>
              Lade Mapillary-Bilder…
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {error && !loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '8px', padding: '16px', textAlign: 'center',
          }}>
            <span style={{ fontSize: '28px' }}>📷</span>
            <span style={{ color: '#475569', fontSize: '12px' }}>{error}</span>
            <button
              onClick={(e) => { e.stopPropagation(); fetchImages() }}
              style={{
                background: 'rgba(56,189,248,0.1)',
                border: '1px solid rgba(56,189,248,0.3)',
                color: '#38bdf8',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Erneut versuchen
            </button>
          </div>
        )}

        {imageUrl && !loading && (
          <>
            <img
              src={imageUrl}
              alt={`Street View ${kommuneName}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
              onError={() => setError('Bild konnte nicht geladen werden')}
            />
            {/* Pano badge */}
            {currentImage?.is_pano && (
              <div style={{
                position: 'absolute', top: '8px', left: '8px',
                background: 'rgba(0,0,0,0.7)',
                color: '#38bdf8',
                fontSize: '10px',
                padding: '2px 7px',
                borderRadius: '4px',
                backdropFilter: 'blur(4px)',
                fontWeight: 600,
                letterSpacing: '0.05em',
              }}>
                360°
              </div>
            )}
            {/* Date */}
            {capturedDate && (
              <div style={{
                position: 'absolute', bottom: '8px', left: '8px',
                background: 'rgba(0,0,0,0.65)',
                color: '#94a3b8',
                fontSize: '10px',
                padding: '2px 7px',
                borderRadius: '4px',
                backdropFilter: 'blur(4px)',
              }}>
                {capturedDate}
              </div>
            )}
            {/* Expand hint */}
            <div style={{
              position: 'absolute', bottom: '8px', right: '8px',
              background: 'rgba(0,0,0,0.65)',
              color: '#64748b',
              fontSize: '10px',
              padding: '2px 7px',
              borderRadius: '4px',
            }}>
              {expanded ? 'Verkleinern ↑' : 'Vergrößern ↓'}
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      {images.length > 1 && (
        <div style={{
          display: 'flex',
          gap: '6px',
          padding: '10px 14px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          justifyContent: 'center',
        }}>
          <button
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            style={{
              background: currentIndex === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(56,189,248,0.1)',
              border: '1px solid rgba(56,189,248,0.2)',
              color: currentIndex === 0 ? '#334155' : '#38bdf8',
              padding: '4px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            ← Zurück
          </button>

          {/* Dots */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {images.slice(0, 10).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                style={{
                  width: i === currentIndex ? '16px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  background: i === currentIndex ? '#38bdf8' : '#1e293b',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  padding: 0,
                }}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentIndex(i => Math.min(images.length - 1, i + 1))}
            disabled={currentIndex === images.length - 1}
            style={{
              background: currentIndex === images.length - 1 ? 'rgba(255,255,255,0.03)' : 'rgba(56,189,248,0.1)',
              border: '1px solid rgba(56,189,248,0.2)',
              color: currentIndex === images.length - 1 ? '#334155' : '#38bdf8',
              padding: '4px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: currentIndex === images.length - 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Weiter →
          </button>
        </div>
      )}

      {/* Footer credit */}
      <div style={{
        padding: '6px 14px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}>
        <a
          href="https://www.mapillary.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#334155', fontSize: '10px', textDecoration: 'none' }}
        >
          © Mapillary
        </a>
      </div>
    </div>
  )
}
