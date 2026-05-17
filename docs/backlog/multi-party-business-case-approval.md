# Backlog: Strukturierte Mehrparteien-Freigabe für den Business Case

**Status:** Geparkt — bei Bedarf reaktivieren.

## Kontext

Das LHT-Business-Case-Template hat eine Freigabezeile mit fünf Parteien
(MGMT, Business Owner, Finance, IRT-Owner, LACE/VMO). In der ersten Umsetzung wird
dies als einfache Checkliste (Häkchen + Namensfeld) im Business-Case-Formular
abgebildet, ohne eigene Workflow-Logik.

## Verschobener Ausbau

Jede der fünf Freigaben als eigenständiges Objekt mit:

- Status (`pending` / `approved` / `rejected`)
- verknüpftem Genehmiger-User (statt freiem Namensfeld)
- Zeitstempel
- Kommentar

Gekoppelt an den L2→L3-Stage-Gate-Übergang: Der Übergang ist erst möglich, wenn alle
fünf Freigaben erteilt sind. Audit-Events je Freigabe.

Betroffene Stellen:

- `src/features/portfolio/actions/stage-gate.ts` — Transition-Guard für L2→L3
- neue Freigabe-Struktur (eigene Entität oder erweitertes JSON im `businessCase`)
- Benachrichtigungen an offene Genehmiger

## Warum geparkt

Deutlich größerer Aufwand; die einfache Checkliste deckt den Dokumentationsbedarf
zunächst ab. Entscheidung getroffen bei der Erstumsetzung der Epic-Artefakte
(Benefit Hypothese & Business Case).
