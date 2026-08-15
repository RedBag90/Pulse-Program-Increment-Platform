# ADR-0017: Rollen-Onboarding ist ein Code-Modul ohne Entitlement-Key

- Status: proposed
- Date: 2026-08-14

## Context

Wer in Pulse eine Rolle zugewiesen bekommt, erfährt heute nichts darüber: `assignRole`
schreibt eine Row und eine Audit-Zeile, sonst passiert nichts Nutzerseitiges. Die Rolle
verändert nur, welche Nav-Einträge und Edit-Affordances erscheinen — ohne Erklärung,
welche Verantwortung daran hängt und wo die zugehörigen Aktivitäten liegen.

Das geplante Rollen-Onboarding (Annahme-Pop-up + Spotlight-Tour, siehe
`src/modules/onboarding/README.md`) ist quer zu allen Fach-Modulen: Es erklärt Epics
(Work), PI-Planung (Drumbeat), Participatory Budgeting (Budgeting), das Risk-Register
(Risks) und die Org-/Ziele-Flächen (Core). Damit standen zwei Fragen an:

1. Wo lebt der Code, ohne die Layering-Regel aus [ADR-0013](./0013-module-layering-and-prerequisites.md)
   zu verletzen („Importe zeigen nur abwärts")?
2. Wird `onboarding` ein Eintrag in `MODULE_KEYS`, also ein pro Tenant abschaltbares,
   verkaufbares Modul?

Für (2) sprach die Symmetrie zu den übrigen Modulen. Dagegen sprachen drei konkrete
Eigenschaften des Bestands:

- `PERSONAL_DEFAULT_MODULES` ist `["core"]`. Ein neuer Entitlement-Key wäre im
  persönlichen Free-Tenant **per Default aus** — also genau dort, wo ein Nutzer ohne
  Einführung am orientierungslosesten ist.
- Der Route-Guard im Dashboard-Layout ist bewusst fail-closed: ein nicht
  freigeschaltetes Segment leitet weg. Ausgerechnet die Erklärung der Anwendung
  fail-closed zu schalten, macht den Fehlerfall schlimmer statt besser.
- Die Registry existiert ausschließlich zum Abschalten. Ein Modul, das man nie
  abschalten will, gehört nicht hinein.

## Decision

**`onboarding` wird ein vollwertiges Code-Modul unter `src/modules/onboarding/` mit
eigener Import-Grenze, aber kein Entitlement-Key.**

1. **Position im Layering: ein Blatt über Core.** `onboarding` importiert
   ausschließlich aus `@/modules/core/**` (plus app-weite Nicht-Modul-Bausteine wie
   `@/components/ui/*`, `@/server/http/*`, `@/server/auth/*`). Kein Fach-Modul
   importiert seinerseits ins Onboarding — der einzige Konsument ist der
   Composition-Root `src/app`, konform zu ADR-0013 Regel 2.

2. **Verweise nach oben laufen über Strings, nicht über Importe.** Ein Playbook nennt
   eine Route (`"/controlling/budgeting"`), einen `data-tour`-Anker
   (`"budget-slider"`) und einen Capability-Namen (`"budget.manage"`). Damit bleibt
   die Import-Richtung ohne Ausnahme abwärts.

3. **Die Konsistenz dieser Strings ist testpflichtig.** Was der Compiler bei Strings
   nicht sieht, sichern Tests in `domain/__tests__/role-playbook.test.ts`: jede Route
   löst über `moduleForPath` auf ein registriertes, real existierendes Segment auf;
   jede Capability ist der Rolle in `POLICIES` tatsächlich gewährt. Die
   Capability-Felder sind als `Action` (geschlossene Union) typisiert, damit das
   Löschen einer Action schon `tsc` rot macht.

4. **Kein `MODULE_KEYS`-Eintrag.** Die Route `/meine-rolle` wird in `CORE_SEGMENTS`
   registriert — der vorhandene Mechanismus für „immer verfügbar, kein Entitlement",
   den `start`, `my-tasks` und `my-approvals` bereits nutzen. Die Capability
   `role.onboarding.manage` wird `MODULES.core.actions` zugeordnet, damit die
   Invariante „jede Action hat ein Modul" erhalten bleibt.

5. **Die Modul-Achse bleibt trotzdem wirksam — als Filter, nicht als Schalter.** Der
   Tour-Inhalt wird serverseitig gegen Entitlement ∧ Practice ∧ Capability gefiltert:
   ein Schritt zu einem nicht freigeschalteten Modul wird nicht gezeigt und nicht
   erwähnt (konsistent zur Nav-Entscheidung „kein Upsell-Schloss"). Der Fortschritt
   wird als Menge gesehener Schritte gespeichert, nicht als „Tour erledigt" — so
   bringt ein nachträglich freigeschaltetes Modul genau seine neuen Schritte als
   offen mit.

## Consequences

- Das Onboarding funktioniert in jedem Tenant, auch im persönlichen Free-Bereich —
  das war der Zweck der Entscheidung.
- `MODULE_KEYS` bleibt eine reine Verkaufs-/Abschalt-Achse und vermischt sich nicht
  mit „Code-Container". Die beiden Bedeutungen von „Modul" bleiben unterscheidbar:
  `src/modules/*` ist der Code-Schnitt, `MODULE_KEYS` das Entitlement.
- Preis: Die Verweise auf obere Module sind nicht compilergeprüft. Die Tests aus
  Punkt 3 sind deshalb nicht Beiwerk, sondern tragen die Kapselung — wer sie
  abschwächt, hebt die Entscheidung faktisch auf.
- Sollte das Onboarding später doch verkaufbar werden, ist der Weg offen: Code-Schnitt
  und Import-Grenze bleiben, es kämen nur `MODULE_KEYS`/`MODULES`-Einträge dazu und
  `/meine-rolle` würde von `CORE_SEGMENTS` in `MODULES.onboarding.segments` wandern.
