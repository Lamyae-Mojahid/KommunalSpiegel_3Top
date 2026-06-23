# KommunalSpiegel · Datenquellen-Anleitung
## Genaue Schritte für jeden Key und jeden Download

---

## Sicht 4 — Ladeinfrastruktur (BNetzA Ladesäulenregister)

**Keine Registrierung nötig. Öffentlich. CC BY 4.0.**

**Download-Seite:**
```
https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet/start.html
```
Dort „Liste der Ladesäulen (xlsx / 26 MB)" herunterladen.

**Direkt-URL (Stand April 2026, kann sich bei Updates ändern):**
```
https://www.bundesnetzagentur.de/SharedDocs/Downloads/DE/Sachgebiete/Energie/
Unternehmen_Institutionen/E_Mobilitaet/Ladesaeulenregister.xlsx?__blob=publicationFile
```

**Verwendung:**
```bash
python sync_alle_sichten.py --sicht 4 --file ~/Downloads/Ladesaeulenregister.xlsx
```
Das Skript erkennt alle bekannten Spaltennamen automatisch (Breitengrad, Längengrad,
Anzahl Ladepunkte, Art Ladeeinrichtung, Nennleistung). Header-Zeile wird automatisch
gefunden (überspringt Metadaten-Zeilen).

**Automatischer Download im Skript:**
Das Skript versucht den Download selbst. Wenn BNetzA den Zugriff sperrt (passiert
gelegentlich bei Serverlast), manuell herunterladen und `--file` übergeben.

---

## Sicht 5 — Festnetz (BNetzA Breitbandatlas)

**Keine Registrierung nötig. Öffentlich. CC BY 4.0.**

**Download-Seite:**
```
https://gigabitgrundbuch.bund.de/GIGA/DE/Downloads_Suche/start.html
→ Filter: Festnetz + Tabelle + aktuell
```

**Aktuelle direkte URL (Stand Dezember 2025):**
```
https://data.bundesnetzagentur.de/Bundesnetzagentur/GIGA/DE/Breitbandatlas/Downloads/bba_12_2025.xlsx
```
Dateiname enthält Datum: `bba_MM_YYYY.xlsx` — bei neuem Datenstand anpassen.
Größe: ~9 MB.

**Inhalt (relevante Spalten):**
- `AGS` — Amtlicher Gemeindeschlüssel
- `Gemeindenamen` — Gemeindename
- `Anteil_100Mbit_%` — Anteil Haushalte mit ≥100 Mbit/s
- `Anteil_GBit_FTTB_H_%` — Anteil Glasfaser

**Verwendung:**
```bash
python sync_alle_sichten.py --sicht 5 --file ~/Downloads/bba_12_2025.xlsx
```

---

## Sicht 6 — Mobilfunk (BNetzA Mobilfunk-Monitoring)

**Keine Registrierung nötig. Öffentlich. CC BY 4.0.**

**Download-Seite:**
```
https://gigabitgrundbuch.bund.de/GIGA/DE/Downloads_Suche/start.html
→ Filter: Mobilfunk + Tabelle + aktuell
```

**Aktuelle direkte URL (Stand Dezember 2025, v=11):**
```
https://gigabitgrundbuch.bund.de/GIGA/DE/Downloads_Suche/aktuell/
Auswertung_Mobilfunkmonitoring.xlsx?__blob=publicationFile&v=11
```
`v=11` = Versionsnummer, erhöht sich bei Updates. Auf Downloadseite aktuellen Link prüfen.
Größe: ~5 MB.

**Inhalt (relevante Spalten):**
- `AGS` / `Gemeindenamen`
- `breitbandig_%` — Anteil Fläche mind. 1 Anbieter breitbandiger Mobilfunk
- `4G_Telekom_%`, `4G_Vodafone_%`, `4G_O2_%` — je Anbieter

**Hinweis zur Einheit:**
Benchmark-Daten aus 2024 sind in dBm (Signalstärke, Messung).
BNetzA-Monitoring-Daten sind in % Flächenversorgung (behördliche Meldedaten).
Beide Kennzahlen messen Mobilfunkversorgung, aber auf verschiedene Weise.
Das Skript macht den Unterschied im JSON transparent.

**Verwendung:**
```bash
python sync_alle_sichten.py --sicht 6 --file ~/Downloads/Auswertung_Mobilfunkmonitoring.xlsx
```

---

## Sicht 3 — StreetView (Google Maps Platform)

**Kostenlos für Metadata-Anfragen (kein Panorama-Download). Billing-Konto nötig.**

**Schritt-für-Schritt Key erstellen:**
1. Gehe zu: https://console.cloud.google.com
2. Neues Projekt erstellen (z.B. „KommunalSpiegel")
3. Linkes Menü → „APIs & Services" → „Bibliothek"
4. Suche: „Street View Static API" → Aktivieren
5. Linkes Menü → „APIs & Services" → „Anmeldedaten"
6. „Anmeldedaten erstellen" → „API-Schlüssel"
7. Den Schlüssel kopieren (beginnt mit `AIzaSy...`)
8. Optional (empfohlen): Schlüssel einschränken auf „Street View Static API"

**Billing-Konto:**
- Ein Billing-Konto muss verknüpft sein (Kreditkarte nötig)
- Metadata-Anfragen (`/metadata` Endpoint) kosten **0 USD** — kein Panorama-Download
- Nur der Image-Endpoint kostet Geld — der wird hier NICHT verwendet

**Kosten für KommunalSpiegel:**
- 33 Kommunen × 16 Testpunkte × 12 Monate = 6.336 Anfragen/Jahr = **0 €**

**In .env eintragen:**
```
GOOGLE_MAPS_API_KEY=AIzaSy...
```

---

## Sicht 7 — OZG / Digitale Services

**Keine öffentliche REST-API verfügbar (Stand 2026).**

**Realistischer Weg für den Prototyp:**
1. OZG-Dashboard aufrufen: https://www.digitale-verwaltung.de
2. „Dashboard Digitale Verwaltung" → Daten nach Gemeinde filtern
3. Tabellarische Daten als CSV/XLSX exportieren (soweit möglich)
4. Mit `--file` übergeben

**Alternativ: Serviceportal Sachsen-Anhalt:**
```
https://service.sachsen-anhalt.de
```
Zeigt digitale Verwaltungsleistungen nach Gemeinde an.
Kein direkter Download — manuelle Zählung oder Scraping.

**Primäre Quelle bleibt Benchmark-CSV 2024** bis eine offizielle API verfügbar ist.
Das Skript zeigt den Status „benchmark" wenn keine API-Daten vorhanden.

---

## Sicht 8 — Social Media (Meta Graph API)

**Kostenlos für öffentliche Seiten. App-Review für Produktion nötig.**

**Schritt-für-Schritt Token erstellen (für Prototyp/Demo):**
1. Gehe zu: https://developers.facebook.com
2. „My Apps" → „Create App" → Typ: „Sonstige" oder „Business"
3. App Name: „KommunalSpiegel Test"
4. Im App-Dashboard: „Graph API Explorer" öffnen
5. Oben rechts: „User or Page" → „Get User Access Token"
6. Berechtigungen: `pages_read_engagement` auswählen
7. Token kopieren (beginnt mit `EAAx...`)

**Wichtig:**
- Short-Lived Token läuft nach 60 Tagen ab → dann neu generieren
- Für dauerhaften Betrieb: Long-Lived Token oder System-User-Token
- App Review bei Meta beantragen für erweiterte Suchrechte (1-4 Wochen)

**In .env eintragen:**
```
META_ACCESS_TOKEN=EAAx...
```

---

## Sicht 2/9/10 — OSM Overpass API

**Kein Key nötig. Einfach starten.**

Läuft automatisch ohne Konfiguration:
```bash
python sync_alle_sichten.py --sicht 2
```

Aus GitHub Actions erreichbar. Kostenlos. Rate-Limit respektieren (0.5s Pause eingebaut).

---

## Sicht 1 — IGEK/ISEK PDF (Claude API)

**Kostenlos bis 5 USD/Monat Guthaben (dann Pay-as-you-go).**

**Key erstellen:**
1. Gehe zu: https://console.anthropic.com
2. „API Keys" → „Create Key"
3. Key kopieren (beginnt mit `sk-ant-...`)

**In .env eintragen:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

**Verwendung:**
```bash
python sync_alle_sichten.py --sicht 1 --pdf ~/Downloads/IGEK_Leuna_2024.pdf --kommune Leuna
```

**Kosten:** ~0,05–0,20 € pro PDF (je nach Länge). Für 33 Kommunen einmal im Jahr: ~3–7 €.

---

## Supabase (optional — ohne läuft alles lokal als JSON)

**Kostenlos bis 500 MB Datenbankgröße (Free Tier).**

**Setup:**
1. Gehe zu: https://supabase.com → „Start your project"
2. Neues Projekt erstellen → Passwort merken
3. Settings → API → `URL` und `service_role` Key kopieren

**In .env eintragen:**
```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

**SQL für Tabelle (im Supabase SQL Editor ausführen):**
```sql
CREATE TABLE IF NOT EXISTS benchmark_sync (
  id              BIGSERIAL PRIMARY KEY,
  kommune_name    TEXT NOT NULL,
  sicht_nr        INTEGER NOT NULL,
  status          TEXT,
  score           DECIMAL(5,2),
  quelle          TEXT,
  api_daten       JSONB,
  benchmark_daten JSONB,
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kommune_name, sicht_nr)
);
```

---

## Alle Sichten auf einmal ausführen

```bash
# Einmalig einrichten
pip install -r requirements.txt
cp .env.example .env
# → Keys in .env eintragen

# Erstlauf: Dateien manuell herunterladen
# BNetzA XLSX → ~/Downloads/Ladesaeulenregister.xlsx
# Breitband → ~/Downloads/bba_12_2025.xlsx
# Mobilfunk → ~/Downloads/Auswertung_Mobilfunkmonitoring.xlsx

# Sync mit lokalen Dateien
python sync_alle_sichten.py --alle \
  --file ~/Downloads/Ladesaeulenregister.xlsx

# Wenn alle Dateien im data/raw/ Ordner liegen:
# Das Skript versucht sie automatisch zu laden.

# Nur eine Kommune testen
python sync_alle_sichten.py --alle --kommune Leuna

# JSON prüfen
cat data/output/alle_sichten.json | python3 -m json.tool | head -50
```

---

## GitHub Actions

Für automatischen täglichen Sync (ohne manuelle Downloads für S4):

Das Skript versucht S4 automatisch herunterzuladen.
S5 und S6 müssen **alle 6 Monate manuell aktualisiert werden** (neuer BNetzA-Dateiname).

**Secrets in GitHub setzen:**
Repository → Settings → Secrets and variables → Actions:
- `GOOGLE_MAPS_API_KEY`
- `META_ACCESS_TOKEN`
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
