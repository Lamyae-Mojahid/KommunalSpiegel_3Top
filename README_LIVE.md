# KommunalSpiegel LiveGPT — zusammengeführte Version

Diese Version kombiniert:

- vollständiges Dashboard mit allen Reitern
- Komponenten aus `komponenten.zip`
- Live-/Periodendaten aus `kommunalspiegel-live.zip`
- robuste `/api/benchmark`-Route ohne 500-Fehler bei Detailprofil
- Live-Quellenstatus über `live_cache`, `sync_log`, `datenquellen`
- Förderprogramme über `funding_programs` mit transparenter Fallback-Liste

## Start lokal

```bash
cd ~/Downloads/KS-LiveGPT-FINAL
npm install
cp .env.local.example .env.local
open -a TextEdit .env.local
```

Supabase-Werte eintragen und speichern.

## Supabase vorbereiten

In Supabase → SQL Editor → New query:

```bash
pbcopy < supabase_schema.sql
```

Dann in Supabase mit Cmd+V einfügen und Run klicken.
Bei RLS-Warnung: „Run without RLS“ oder „Run and enable RLS“ ist beides okay, weil Lesepolicies enthalten sind.

## Daten laden

```bash
npm run db:refresh
npm run dev
```

Dann öffnen:

```text
http://localhost:3000
```

## Was ist live?

- Ladeinfrastruktur wird über eine externe Bundesnetzagentur/ArcGIS-Abfrage versucht.
- Förderprogramme liegen in der Tabelle `funding_programs`; eine echte externe Förder-API kann über `FOERDER_API_URL` ergänzt werden.
- Nicht zuverlässig live verfügbare Sichten wie IGEK/ISEK, Social Media und 360° werden als Perioden-/Fallback-Daten geführt.
- Der Reiter „Live-Quellen“ zeigt Datenstand, Quellen und Sync-Status.

## Befehle

```bash
npm run db:seed       # Basis-Benchmarkdaten laden
npm run live:sync     # Live-/Periodendaten und Förderprogramme aktualisieren
npm run db:refresh    # beides zusammen
npm run dev           # lokale App starten
npm run test:apis     # externe APIs testen
```
