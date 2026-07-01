"""
sync_sicht7_ozg_digitale_services.py - KommunalSpiegel Sicht 7
OZG / Digitale Services, automatisiert über die PVOG Suchdienst-API.

Hintergrund:
Bisher (siehe backend_v6/sync_alle_sichten.py, Funktion sync_s7) gab es für
Sicht 7 keine öffentliche REST-API und das Skript fiel komplett auf die
Benchmark-CSV 2024 zurück. Das ist mittlerweile überholt: Das Portalverbund
Online-Gateway (PVOG) der FITKO / des IT-Planungsrats betreibt seit 2026 eine
produktive, öffentliche und (laut FITKO-Dokumentation) ohne Authentisierung
nutzbare REST-API ("Suchdienst"). Damit lässt sich der OZG-Umsetzungsstand
pro Kommune erstmals automatisiert abfragen.

Verwendete Endpunkte (Stand Juni/Juli 2026, Quelle: docs.fitko.de,
produktportal.pvog.fitko.de):

1) Ortssuche -> Amtlicher Regionalschlüssel (ARS) ermitteln
   GET {BASE}/v3/locations/ars?q=<Ortsname>
   Liefert u.a. den ARS (12-stellig) für einen Ortsnamen. Wir verzichten
   bewusst darauf, den ARS selbst aus dem AGS herzuleiten (das Einfügen des
   Gemeindeverband-Anteils ist nicht trivial), sondern lassen ihn von der
   API auflösen - das ist robuster.

2) Online-Dienste je Gebiet zählen (Beta-Endpunkt, aber bereits produktiv
   dokumentiert)
   GET {BASE}/v1beta2/onlineservices?ars=<ARS>
   Liefert alle Onlinedienste, die für den ARS zuständig sind - inklusive
   "vererbter" Zuständigkeiten von Land/Bund (das ist von der FITKO so
   beschrieben und entspricht der Logik, die auch das offizielle "Dashboard
   Digitale Verwaltung" verwendet). totalHits ist die Gesamtzahl. Das ist
   unsere Hauptkennzahl für Sicht 7.

3) Stichprobe konkreter Leistungen (LeiKa-Schlüssel) je Gebiet prüfen
   GET {BASE}/v3/servicedescriptions/leikaid?ars=<ARS>&leikaIds=<ID>
   Liefert Treffer, wenn die konkrete Leistung für dieses Gebiet hinterlegt
   ist. Wir nutzen das nur für einen kleinen, EXPLIZIT VERIFIZIERTEN Korb an
   LeiKa-Schlüsseln (siehe LEIKA_KORB unten) als zusätzliche, feingranulare
   Kennzahl. Der Korb ist bewusst klein gehalten: Es werden hier nur
   Schlüssel verwendet, die über offizielle Quellen (fimportal.de
   Leistungs-Stammtexte bzw. PVOG-Dokumentation) nachgewiesen sind. Weitere
   Schlüssel lassen sich unter https://fimportal.de/suche nachschlagen und
   einfach in LEIKA_KORB ergänzen.

Wichtige Einschränkungen / Hinweise:
- Domainumzug: pvog.fitko.de wird laut FITKO-Ankündigung abgeschaltet
  (Zieltermin 01.08.2026). Wir nutzen daher primär pvog.fitko.net und
  fallen nur defensiv auf die alte Domain zurück, falls die neue temporär
  nicht erreichbar ist.
- /v1beta2/onlineservices ist als "Beta-API" gekennzeichnet. Struktur und
  Verhalten können sich noch ändern - das Skript ist entsprechend defensiv
  geschrieben (mehrere mögliche Antwortformen, Pagination, Try/Except).
- "totalHits" zählt auch Leistungen, die nur auf Landes- oder Bundesebene
  hinterlegt und in die Fläche vererbt sind. Das ist gewollt (siehe oben),
  bedeutet aber: absolute Vergleiche nur zwischen Kommunen IM SELBEN
  BUNDESLAND sind aussagekräftig (hier ohnehin der Fall, alle drei
  Pilotkommunen liegen in Sachsen-Anhalt).
- Kein API-Key zwingend erforderlich. Optional kann ein kostenloser Key
  über das PVOG-Produktportal beantragt und als Umgebungsvariable
  PVOG_API_KEY gesetzt werden (Header pvog-sud-api-client-id) - das hilft
  laut FITKO vor allem bei künftigen Änderungen/Drosselungen.
"""

import os
import sys
import time
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '') or os.environ.get('SUPABASE_SERVICE_KEY', '')
PVOG_API_KEY = os.environ.get('PVOG_API_KEY', '')  # optional, siehe Hinweis oben

# Primäre und Fallback-Domain des PVOG Suchdienstes
PVOG_BASES = [
    'https://pvog.fitko.net/suchdienst/api',
    'https://pvog.fitko.de/suchdienst/api',  # Fallback bis zur endgültigen Abschaltung
]

USER_AGENT = 'KommunalSpiegel-Hochschule-Merseburg/1.0'

# Gleiche drei Pilotkommunen wie in den übrigen scripts/sync_sichtX.py
COMMUNES = [
    {'name': 'Leuna',          'kommune_id': 1, 'ags': '15088205'},
    {'name': 'Querfurt',       'kommune_id': 2, 'ags': '15088305'},
    {'name': 'Bad Dürrenberg', 'kommune_id': 3, 'ags': '15088020'},
]

# Verifizierter Korb an LeiKa-Schlüsseln (14-stellig).
# Jeder Eintrag stammt aus einer offiziellen Quelle (siehe Kommentar je
# Eintrag) - hier wurde bewusst NICHT geraten. Weitere Schlüssel können
# über die offizielle Suche https://fimportal.de/suche nachgeschlagen und
# hier ergänzt werden (Format: 14 Ziffern, siehe FIM Baustein Leistungen).
LEIKA_KORB = [
    {
        'id': '99107021017000',
        'name': 'Unterhaltsvorschuss Online (UVO)',
        'quelle': 'BayKommun / fimportal.de Leistungs-Stammtext',
    },
    {
        'id': '99107102017000',
        'name': 'Unterhaltsvorschuss Online - Jahresprüfung (UVOJahr)',
        'quelle': 'BayKommun / fimportal.de Leistungs-Stammtext',
    },
    {
        'id': '99107103017000',
        'name': 'Unterhaltsvorschuss Online - NavI',
        'quelle': 'BayKommun / fimportal.de Leistungs-Stammtext',
    },
    {
        'id': '99015007012000',
        'name': 'Schwerbehindertenausweis Ausstellung',
        'quelle': 'fimportal.de Leistungs-Stammtext S100002/S1000020010000010122',
    },
]


def _headers() -> Dict[str, str]:
    h = {'User-Agent': USER_AGENT, 'Accept': 'application/json'}
    if PVOG_API_KEY:
        h['pvog-sud-api-client-id'] = PVOG_API_KEY
    return h


def _get(path: str, params: Dict[str, Any], leise: bool = False) -> "tuple[Optional[Any], Optional[str]]":
    """
    Ruft einen PVOG-Suchdienst-Endpunkt auf. Probiert zuerst die neue
    Domain (pvog.fitko.net), bei Fehlern die alte (pvog.fitko.de).
    Gibt immer ein Tupel (daten, fehlermeldung) zurück:
    - Erfolg:        (json, None)
    - kein Treffer:  (None, None)   (HTTP 404 - gültiges leeres Ergebnis)
    - Fehler:        (None, "...")  (inkl. Antwortkörper zur Diagnose)
    Bei HTTP-Fehlern wird (außer im "leisen" Modus) der Antwortkörper
    mitgeloggt, da PVOG-Fehlerantworten i.d.R. eine konkrete
    Validierungsmeldung enthalten (z.B. fehlender/falscher Parameter).
    """
    last_error: Optional[str] = None
    for base in PVOG_BASES:
        url = f"{base}{path}"
        try:
            r = requests.get(url, params=params, headers=_headers(), timeout=30)
            if r.status_code == 200:
                return r.json(), None
            if r.status_code == 404:
                # Kein Treffer ist ein gültiges, "leeres" Ergebnis - kein Fehler.
                return None, None
            body = (r.text or '')[:300].replace('\n', ' ')
            last_error = f"HTTP {r.status_code} bei {url} — Antwort: {body}"
            if not leise:
                log.warning(f"  ⚠ {last_error}")
        except Exception as e:
            last_error = f"{type(e).__name__}: {e}"
            if not leise:
                log.warning(f"  ⚠ Fehler bei {url}: {last_error}")
        time.sleep(0.5)
    if not leise:
        log.error(f"  ✗ Alle PVOG-Domains fehlgeschlagen ({path}): {last_error}")
    return None, last_error


# Kandidaten für Endpunkt + Parametername der Ortssuche, in Reihenfolge der
# Wahrscheinlichkeit. /v3/locations/ars lieferte HTTP 400 mit unklarem
# Parameter; /v2/locations?q=... ist hingegen aus einer offiziellen
# BayKommun-Anleitung als funktionierendes Beispiel belegt. Wir probieren
# daher mehrere Kombinationen automatisch durch und protokollieren bei
# Bedarf alle Fehlerantworten zur Diagnose.
LOCATION_KANDIDATEN = [
    ('/v2/locations', 'q'),
    ('/v3/locations', 'q'),
    ('/v3/locations/ars', 'q'),
    ('/v3/locations/ars', 'search'),
    ('/v3/locations/ars', 'name'),
]


def resolve_ars(ort_name: str) -> Optional[str]:
    """
    Ermittelt den Amtlichen Regionalschlüssel (ARS) zu einem Ortsnamen über
    den PVOG-Ortssuchendienst. Bevorzugt Treffer in Sachsen-Anhalt, falls
    mehrdeutig (gleichnamige Orte in anderen Bundesländern).

    Probiert mehrere Endpunkt-/Parameter-Kombinationen, da die genaue
    Schnittstelle nicht für alle API-Versionen öffentlich dokumentiert ist
    und der BKG-Ortsdienst laut FITKO-Statusmeldungen zeitweise instabil ist.
    """
    fehler_protokoll = []
    for path, param in LOCATION_KANDIDATEN:
        data, fehler = _get(path, {param: ort_name}, leise=True)
        if fehler:
            fehler_protokoll.append(f"{path}?{param}=... → {fehler}")
        if not data:
            continue
        treffer = data if isinstance(data, list) else (data.get('results') or data.get('content') or data.get('items') or [])
        if not treffer:
            continue
        bevorzugt = next((t for t in treffer if 'sachsen-anhalt' in str(t).lower()), None)
        eintrag = bevorzugt or treffer[0]
        ars = eintrag.get('ars') or eintrag.get('ARS') if isinstance(eintrag, dict) else None
        if ars:
            log.info(f"  ✓ ARS via {path}?{param}=... aufgelöst")
            return ars
    # Alle Kandidaten fehlgeschlagen - vollständiges Protokoll für Diagnose ausgeben.
    log.error(f"  ✗ ARS-Auflösung für '{ort_name}' fehlgeschlagen über alle Kandidaten:")
    for zeile in fehler_protokoll:
        log.error(f"      {zeile}")
    return None


def fetch_online_services(ars: str, diagnose: bool = False) -> Dict[str, Any]:
    """
    Ruft alle für den ARS zuständigen Onlinedienste ab (inkl. vererbter
    Zuständigkeiten von Land/Bund) über den Beta-Endpunkt
    /v1beta2/onlineservices. Folgt nextPageToken bei mehreren Seiten.

    Gibt zurück: {'total': int|None, 'items': [...] (Rohdaten je Eintrag)}

    Der genaue Feldname der Trefferliste (vermutlich "hits", laut
    FITKO-Blogpost) ist öffentlich nicht vollständig dokumentiert - daher
    werden mehrere plausible Feldnamen defensiv geprüft. Mit diagnose=True
    wird die Rohstruktur des ERSTEN gefundenen Eintrags 1:1 geloggt, damit
    wir das tatsächliche Antwortschema einmalig sehen und danach sauber
    zuordnen können (Name, Link, LeiKa-ID o.ä.) - statt zu raten.
    """
    total: Optional[int] = None
    alle_items: List[Any] = []
    next_token: Optional[str] = None
    seiten = 0
    erste_diagnose_ausgegeben = False

    while True:
        params: Dict[str, Any] = {'ars': ars}
        if next_token:
            params['nextPageToken'] = next_token
        data, fehler = _get('/v1beta2/onlineservices', params)
        if fehler:
            log.warning(f"  ⚠ Online-Dienste-Abfrage: {fehler}")
        if data is None:
            break
        if not isinstance(data, dict):
            log.warning("  ⚠ Unerwartetes Antwortformat bei /v1beta2/onlineservices (kein Objekt)")
            break

        if total is None:
            total = data.get('totalHits')

        if diagnose and not erste_diagnose_ausgegeben:
            # Komplette Top-Level-Struktur der Antwort zeigen (Schlüsselnamen),
            # damit wir sehen, wie die Trefferliste tatsächlich heißt.
            log.info(f"  🔍 DIAGNOSE — Top-Level-Schlüssel der Antwort: {list(data.keys())}")

        # Mehrere plausible Feldnamen für die Trefferliste defensiv prüfen.
        # Per Diagnose bestätigt: der tatsächliche Feldname ist
        # "onlineservices" (Kleinschreibung) - "hits" existiert als
        # Schlüssel, war in unseren Tests aber leer.
        items = (
            data.get('onlineservices') or data.get('hits') or data.get('items') or data.get('results')
            or data.get('content') or data.get('services') or data.get('onlineServices') or []
        )
        if isinstance(items, list):
            alle_items.extend(items)
            if diagnose and items and not erste_diagnose_ausgegeben:
                log.info("  🔍 DIAGNOSE — Rohstruktur des ersten Onlinedienst-Eintrags:")
                log.info("      " + json.dumps(items[0], ensure_ascii=False, indent=2).replace('\n', '\n      '))
                erste_diagnose_ausgegeben = True

        next_token = data.get('nextPageToken')
        seiten += 1
        if not next_token or seiten > 20:  # Sicherheitsgrenze gegen Endlosschleifen
            break

    if diagnose and not erste_diagnose_ausgegeben:
        log.warning("  ⚠ DIAGNOSE — Keine Einträge in der Trefferliste gefunden (leeres Ergebnis oder unbekanntes Feld)")

    return {'total': total, 'items': alle_items}


def check_leika_basket(ars: str) -> List[Dict[str, Any]]:
    """
    Prüft je Eintrag aus LEIKA_KORB, ob die Leistung für den ARS im PVOG
    hinterlegt ist (= online verfügbar in diesem Gebiet, ggf. inkl.
    Vererbung von Land/Bund).
    """
    ergebnisse = []
    for leistung in LEIKA_KORB:
        data, fehler = _get('/v3/servicedescriptions/leikaid', {
            'ars': ars, 'page': 0, 'size': 10, 'leikaIds': leistung['id'],
        })
        if fehler:
            log.warning(f"    ⚠ {leistung['name']}: {fehler}")
        treffer = bool(data) and bool(
            data if isinstance(data, list) else (data.get('content') or data.get('results') or [])
        )
        ergebnisse.append({**leistung, 'verfuegbar': treffer})
        log.info(f"    {'✓' if treffer else '–'} {leistung['name']} ({leistung['id']})")
        time.sleep(0.3)
    return ergebnisse


def klassifiziere_lokale_dienste(items: List[Dict[str, Any]], ars_kommune: str) -> Dict[str, Any]:
    """
    Unterscheidet anhand der tatsächlichen PVOG-Antwortstruktur, welche
    Onlinedienste WIRKLICH für genau diese Kommune registriert sind
    (serviceDescriptions[].ars enthält exakt den ARS der Kommune) und
    welche nur "vererbt" sind (ars == Bund "000000000000", Land- oder
    Kreis-Ebene mit nachfolgenden Nullen).

    Das löst das Problem, dass die reine Gesamtzahl (totalHits) fast
    überall gleich hoch ist, weil sie hauptsächlich Bund-/Landesdienste
    zählt, die JEDE Kommune "hat" - unabhängig von eigenem Engagement.
    """
    lokale_dienste = []
    for item in items:
        if not isinstance(item, dict):
            continue
        alle_ars = set()
        for sd in item.get('serviceDescriptions', []) or []:
            for a in sd.get('ars', []) or []:
                alle_ars.add(a)
        if ars_kommune in alle_ars:
            link = (item.get('links') or [{}])[0].get('uri', '')
            lokale_dienste.append({'id': item.get('id'), 'name': item.get('name', '(ohne Namen)'), 'url': link})

    return {
        'anzahl_lokal': len(lokale_dienste),
        'anzahl_geerbt': len(items) - len(lokale_dienste),
        'lokale_dienste': lokale_dienste,
    }


def process_all() -> List[Dict[str, Any]]:
    results = []
    for i, k in enumerate(COMMUNES):
        log.info(f"\n[Sicht 7] {k['name']} (AGS {k['ags']})")
        ars = resolve_ars(k['name'])
        if not ars:
            log.warning(f"  ⚠ {k['name']}: ARS nicht auflösbar - überspringe (Benchmark-Fallback bleibt in Supabase erhalten)")
            continue
        log.info(f"  ARS ermittelt: {ars}")

        # Diagnose nur bei der ersten Kommune ausgeben - reicht, um das
        # Antwortschema einmalig zu sehen, ohne die Logs unnötig aufzublähen.
        online_daten = fetch_online_services(ars, diagnose=(i == 0))
        anzahl = online_daten['total']
        items = online_daten['items']
        if anzahl is not None:
            log.info(f"  Online-Dienste laut PVOG: {anzahl} (davon {len(items)} Einträge abgerufen)")
        else:
            log.warning(f"  ⚠ {k['name']}: Online-Dienste-Abfrage fehlgeschlagen")

        klassifikation = klassifiziere_lokale_dienste(items, ars)
        log.info(
            f"  → davon lokal registriert: {klassifikation['anzahl_lokal']} · "
            f"geerbt (Bund/Land/Kreis): {klassifikation['anzahl_geerbt']}"
        )
        for d in klassifikation['lokale_dienste']:
            log.info(f"      · {d['name']}")

        korb_ergebnisse = check_leika_basket(ars)
        verfuegbar_n = sum(1 for e in korb_ergebnisse if e['verfuegbar'])
        pct_korb = round(verfuegbar_n / len(korb_ergebnisse) * 100, 1) if korb_ergebnisse else None

        results.append({
            'kommune': k['name'], 'kommune_id': k['kommune_id'], 'ags': k['ags'], 'ars': ars,
            'anzahl_online_dienste': anzahl,
            'anzahl_lokal': klassifikation['anzahl_lokal'],
            'anzahl_geerbt': klassifikation['anzahl_geerbt'],
            'lokale_dienste': klassifikation['lokale_dienste'],
            'leika_korb': korb_ergebnisse,
            'pct_korb_verfuegbar': pct_korb,
        })
    return results


def push_to_supabase(results: List[Dict[str, Any]]) -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.warning('Supabase nicht konfiguriert (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY fehlen) — kein Push.')
        return
    try:
        from supabase import create_client
    except ImportError:
        log.warning("Python-Paket 'supabase' nicht installiert — kein Push. (pip install supabase)")
        return

    base_url = SUPABASE_URL.split('/rest/')[0] if '/rest/' in SUPABASE_URL else SUPABASE_URL
    sb = create_client(base_url, SUPABASE_KEY)
    jahr = datetime.now().year
    quelle_basis = 'PVOG Suchdienst-API (FITKO/IT-Planungsrat), pvog.fitko.net'

    for res in results:
        kommune_id = res['kommune_id']
        name = res['kommune']
        zeilen: List[Dict[str, Any]] = []

        if res['anzahl_online_dienste'] is not None:
            zeilen.append({
                'kennzahl': 'OZG Online-Dienste verfügbar (Anzahl, PVOG)',
                'wert_num': float(res['anzahl_online_dienste']),
                'score_normiert': None,  # bewusst nicht normiert, siehe Hinweis im Dateikopf
                'quelle': f"{quelle_basis} - /v1beta2/onlineservices?ars={res['ars']}",
            })

        if res.get('anzahl_lokal') is not None:
            zeilen.append({
                'kennzahl': 'OZG Online-Dienste lokal registriert (Anzahl, PVOG)',
                'wert_num': float(res['anzahl_lokal']),
                'score_normiert': None,
                'quelle': (
                    f"{quelle_basis} - Filter: serviceDescriptions[].ars == {res['ars']} "
                    "(nur Einträge, die exakt für diese Kommune hinterlegt sind, ohne "
                    "von Bund/Land/Kreis vererbte Einträge)"
                ),
            })
            zeilen.append({
                'kennzahl': 'OZG Online-Dienste geerbt von Bund/Land/Kreis (Anzahl, PVOG)',
                'wert_num': float(res['anzahl_geerbt']),
                'score_normiert': None,
                'quelle': f"{quelle_basis} - totalHits abzüglich lokal registrierter Einträge",
            })

        # Eine Zeile je lokal registriertem Dienst - nur für WIRKLICH lokale
        # Einträge, da deren Anzahl im Gegensatz zu totalHits überschaubar
        # sein sollte. Sicherheitsgrenze gegen unerwartete Ausreißer.
        MAX_EINZELDIENSTE = 100
        for d in res.get('lokale_dienste', [])[:MAX_EINZELDIENSTE]:
            zeilen.append({
                'kennzahl': f"OZG lokaler Online-Dienst: {d['name']}",
                'wert_num': 1.0,
                'score_normiert': None,
                'quelle': f"{quelle_basis} - PVOG-ID {d['id']}" + (f" - {d['url']}" if d['url'] else ''),
            })
        if len(res.get('lokale_dienste', [])) > MAX_EINZELDIENSTE:
            log.warning(
                f"  ⚠ {name}: {len(res['lokale_dienste'])} lokale Dienste gefunden, "
                f"nur die ersten {MAX_EINZELDIENSTE} werden als Einzelzeilen gespeichert "
                "(Summenkennzahl 'lokal registriert' bleibt korrekt)"
            )

        for eintrag in res['leika_korb']:
            zeilen.append({
                'kennzahl': f"OZG: {eintrag['name']} online verfügbar",
                'wert_num': 1.0 if eintrag['verfuegbar'] else 0.0,
                'score_normiert': None,
                'quelle': f"{quelle_basis} - /v3/servicedescriptions/leikaid (LeiKa {eintrag['id']})",
            })

        if res['pct_korb_verfuegbar'] is not None:
            zeilen.append({
                'kennzahl': 'OZG Online-Verfügbarkeit Stichprobe (%, PVOG-Korb)',
                'wert_num': res['pct_korb_verfuegbar'],
                'score_normiert': round(res['pct_korb_verfuegbar'] / 10, 2),
                'quelle': f"{quelle_basis} - Stichprobe aus {len(LEIKA_KORB)} verifizierten LeiKa-Schlüsseln",
            })

        for zeile in zeilen:
            try:
                sb.table('benchmark').upsert({
                    'kommune_id': kommune_id, 'sicht_nr': 7,
                    'kennzahl': zeile['kennzahl'], 'wert_num': zeile['wert_num'],
                    'score_normiert': zeile['score_normiert'], 'erhebungsjahr': jahr,
                    'quelle': zeile['quelle'], 'quelle_typ': 'automatisch',
                    'letzter_abruf': datetime.now(timezone.utc).isoformat(),
                }, on_conflict='kommune_id,sicht_nr,kennzahl,erhebungsjahr').execute()
            except Exception as e:
                log.error(f"  ✗ {name}: Supabase-Fehler (benchmark, {zeile['kennzahl']}): {e}")

        log.info(f"  ✓ {name}: {len(zeilen)} Kennzahlen → Supabase")


def main() -> int:
    results = process_all()
    if not results:
        log.error('Keine Ergebnisse — Abbruch. (Bestehende Benchmark-Werte in Supabase bleiben unverändert.)')
        return 1

    log.info('\n══ Résumé final ══')
    for res in results:
        log.info(
            f"  {res['kommune']}: ARS={res['ars']} · "
            f"Online-Dienste={res['anzahl_online_dienste']} "
            f"(lokal={res.get('anzahl_lokal')} · geerbt={res.get('anzahl_geerbt')}) · "
            f"Korb-Verfügbarkeit={res['pct_korb_verfuegbar']}%"
        )

    push_to_supabase(results)
    return 0


if __name__ == '__main__':
    sys.exit(main())
