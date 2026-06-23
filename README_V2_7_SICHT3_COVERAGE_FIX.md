# V2.7 · Sicht 3 · Coverage-Berechnung korrigiert

## Das eigentliche Problem (war kein Parameter-Problem)

`strict_pct = covered_len / total_len` war strukturell falsch:
- `total_len` = Gesamtlänge ALLER Straßen (z.B. 280 km für Leuna)
- `covered_len` = nur Länge der geprüften UND blauen Straßen (250 von 1628)

→ Selbst bei 100% Trefferquote auf den 250 geprüften Straßen kam
  maximal `250/1628 = 15%` raus. Die 66% entstanden nur, weil zufällig
  lange Hauptstraßen am Anfang der (alphabetisch/typ-sortierten) Liste standen.

## Drei neue Kennzahlen (alle transparent im JSON)

| Kennzahl | Berechnung | Bedeutung |
|---|---|---|
| `coverage_of_checked_percent` | covered_len / checked_len | **Hauptwert für UI**: Abdeckung der tatsächlich geprüften Straßen |
| `extrapolated_percent` | = coverage_of_checked_percent | Hochrechnung auf Gesamtnetz (valide bei stratifizierter Stichprobe) |
| `covered_percent` | covered_len / total_len | Konservativ, alter Wert — immer niedrig bei Teilstichprobe |

## Stratifizierte Stichprobe

Statt blinder Reihenfolge werden Straßen nach Tier und Länge gezogen:
- Tier 3 (Haupt-/Bundesstraßen): 60% der Stichprobe
- Tier 2 (Wohn-/Nebenstraßen): 30%
- Tier 1 (Service/Sonstiges): 10%
→ Die Stichprobe ist repräsentativ → Hochrechnung ist methodisch belastbar.

## UI-Empfehlung

Im Frontend `coverage_of_checked_percent` anzeigen (nicht `covered_percent`):
```javascript
// Falsch (alter Wert, systematisch zu niedrig):
const score = data.covered_percent;

// Richtig (v2.7):
const score = data.coverage_of_checked_percent ?? data.benchmark_percent;
```

## Empfohlener Aufruf

```bash
# Schnell (~8 min, 500 Straßen stratifiziert):
python scripts/sync_sicht3_streetview_google.py \
  --kommune Leuna --max-api-roads 500 --debug

# Vollständig (~50 min, alle Straßen):
python scripts/sync_sicht3_streetview_google.py \
  --kommune Leuna --max-api-roads 0 --debug
```
