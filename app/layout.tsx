import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KommunalSpiegel — Kommunales Lagebild Sachsen-Anhalt',
  description: 'Benchmarking, Datenwerkstatt und Maßnahmenmonitor für Kleinstädte und Kommunen in Sachsen-Anhalt',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,400..700,50,0..1&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body data-theme="papier">{children}</body>
    </html>
  )
}
