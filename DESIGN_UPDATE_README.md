# KommunalSpiegel — Design- und Agenten-Version

Diese Version verbindet die vorhandene funktionale KS-LiveGPT-FINAL3-Anwendung mit dem hochgeladenen Design-System.

Start:
```bash
npm install
npm run dev
```
Dann öffnen:
```text
http://localhost:3000
```

Verbesserungen:
- seriöseres kommunales Design-System mit Instrument Serif, Geist und IBM Plex Mono
- Startseite als kommunales Smart-City-Lagebild statt generisches KI-Dashboard
- Navigation fachlich umbenannt: Lagebild, Kommune, Vergleich, Datenwerkstatt, Maßnahmen, Auswertung, Förderung, Berichte, Quellen
- Datenwerkstatt stärker als automatisierter Fortschreibungsprozess umgesetzt
- Agentenlauf sichtbar, mit Prozessmodell, Protokoll, Ampellogik, Freigabehinweis
- Fallback-Datenbestand bleibt aktiv, damit die App nicht leer wirkt, wenn Supabase noch nicht angebunden ist
- CSV-/Excel-Prüfung für die manuelle Vorprojekt-Erhebung

Wichtig:
Die App kann mit Supabase weiter betrieben werden. Falls keine Supabase-Daten vorhanden sind, nutzt sie den integrierten Startbestand der 33 Kommunen.
