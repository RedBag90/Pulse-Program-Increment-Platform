# Backlog: offene Kanten am eigenständigen Feature

**Status:** 🐞 Gemeldet, nicht behoben — entstanden bei der Umsetzung von
ADR-0023 (2026-09-18).

## 1 · `PATCH /api/v1/features/[id]` prüft keinen ART-Scope

`src/app/api/v1/features/[id]/route.ts` deklariert
`resource: (_input, p) => ({ tenantId: p.tenantId })` — **ohne `artId`** —, und
`updateFeature` hat keinen `loadAndAuthorize`-Seam (nur `assignFeatureOwner`,
`setFeatureSolution` und `setFeatureParent` haben einen).

**Folge:** wer `feature.update` hält, darf über diese Route jedes Feature des
Mandanten ändern, unabhängig von seiner ART-Eingrenzung. Das ist eine
vorbestehende Abweichung von ADR-0002 und wiegt seit ADR-0023 etwas schwerer,
weil `feature.update` jetzt ART-gebunden erteilt wird — die Route umgeht genau
diese Bindung.

Genau deshalb sind Solution- und Epic-Zuordnung **eigene** Services mit eigener
Prüfung geworden, statt Felder in `updateFeature`.

## 2 · Der Budget-Schnappschuss schliesst eigenständige Features aus

`budget-plan-revision.ts` filtert `parentId: { not: null }`, und
`FeatureSnapshotInput.parentEpicId` ist ein nicht-nullable `string`. Sie
aufzunehmen ist eine **Modelländerung**, kein Filterwechsel.

Das ist derzeit **richtig**: ein eigenständiges Feature bekommt kein
zugewiesenes Geld, und der Schnappschuss verteilt genau das. Sollte sich das
ändern (etwa mit einem ART-Topf, der Features direkt finanziert), ist hier der
Ort.

## 3 · `listEpics` liefert volle Epic-Zeilen an eine Options-Liste

`epic.ts:listEpics` speist `/api/v1/initiatives`, das der Anlege-Dialog als
Optionsliste benutzt — mit `businessCase`, `benefitHypothesis` und beiden
`baseline*`-JSON-Blöcken für alle Epics. Mit der ART-zuerst-Kaskade wird die
Liste früher geholt und der Aufwand sichtbarer. Eine schlanke Variante nach dem
Vorbild von `listEpicsForOverview` wäre billig.

## 4 · Die Jira-Statusabbildung schreibt ungültige Status

`src/app/api/integrations/jira/webhook/route.ts` bildet ab:
`new → "draft"`, `indeterminate → "in_progress"`, `done → "done"`. Gültige
Feature-Status sind `approved`, `in_progress`, `blocked`, `completed`,
`cancelled` — **zwei der drei Ziele gibt es nicht**. Ein „done" aus Jira
schriebe einen Status, den keine Beschriftung kennt; die Karte zeigte dann
nichts.

Die Route schreibt ausserdem **direkt** per `db.initiative.update`, am Service
vorbei — also ohne PI-Pflicht und ohne Tor-Prüfung aus `feature-start.ts`.

Im Bestand gibt es keine solchen Zeilen (kein Objekt trägt ein
`external_system`), die Anbindung läuft also offenbar nicht.

## 5 · Das Trennzeichen im materialisierten Pfad

Unverändert der bekannte Defekt aus
`initiative-path-separator-inconsistency.md`: der Anwendungscode schreibt `.`,
die gesäten Daten benutzen `/`. Neu ist nur, dass der Ausdruck jetzt an **einer**
Stelle steht (`derivedInitiativePath`) statt an dreien — die spätere
Vereinheitlichung wird dadurch ein Einzeiler plus Datenmigration.
