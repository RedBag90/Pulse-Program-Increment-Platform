# Module: `onboarding`

Rollen-Onboarding: Wer eine Rolle zugewiesen bekommt, erfährt hier, welche
Verantwortung daran hängt und wo in der App die zugehörigen Aktivitäten liegen —
als Pop-up bei Zuweisung plus interaktive Spotlight-Tour.

- **Darf importieren von:** core (plus app-weite Nicht-Modul-Bausteine:
  `@/components/ui/*`, `@/server/http/*`, `@/server/auth/*`, `@/i18n/*`).
- **Darf NICHT importieren von:** work, drumbeat, budgeting, risks.
- **Wird importiert von:** ausschließlich `src/app` (Composition-Root montiert den
  Mount im Dashboard-Layout und die Seite `/meine-rolle`). Kein Fach-Modul importiert
  hierher — auch das ist per ESLint gesperrt.

**Kein Entitlement-Modul.** `onboarding` steht nicht in `MODULE_KEYS`; die Route
`/meine-rolle` läuft über `CORE_SEGMENTS` und ist damit in jedem Tenant erreichbar.
Begründung in [ADR-0017](../../../docs/adr/0017-onboarding-module-without-entitlement.md).

**Wie das Blatt-Sein funktioniert:** Ein Playbook verweist auf Funktionen der oberen
Module nur über **Strings** — Route (`"/controlling/budgeting"`), Anker
(`"budget-slider"`), Capability (`"budget.manage"`). Kein Import zeigt nach oben.
Was der Compiler bei Strings nicht prüfen kann, prüfen die Konsistenz-Tests in
`domain/__tests__/role-playbook.test.ts`: jede Route muss auf ein registriertes,
real existierendes Segment zeigen, jede Capability muss der Rolle in `POLICIES`
tatsächlich gewährt sein.

## Wo liegt was

| Pfad | Inhalt |
| --- | --- |
| `domain/role-playbook.ts` | `ROLE_PLAYBOOKS` — je Rolle Mission, Verantwortung, Handoffs, Tour-Schritte. Pure Daten, nichts berechnen. |
| `domain/role-tour.ts` | `resolveTour` (Filter über Entitlement ∧ Practice ∧ Capability), `openSteps`, `onboardingNotices`. Pure. |
| `domain/spotlight.ts` | Reine Geometrie des Overlays (Loch-Rect, Kartenplatzierung). |
| `features/onboarding/actions/` | Server-Actions (`role.onboarding.manage`). |
| `features/onboarding/components/` | Mount, Welcome-Dialog, Tour-Overlay, Playbook-Panel. |
| `server/services/role-onboarding.ts` | `RoleOnboarding`-Rows lesen/schreiben, auditiert. |
| `server/views/role-onboarding.ts` | Page-Model: unreiner Loader + reiner Builder (`onboardingNotices`). |

## Leitprinzip

Persistiert wird **nicht** „Tour für Rolle X abgeschlossen", sondern die Menge der
gesehenen Schritte (`RoleOnboarding.seenStepKeys`). Damit fallen zwei Fälle aus
derselben Rechnung: eine frisch zugewiesene Rolle hat alle Schritte offen, und ein
nachträglich freigeschaltetes Modul bringt genau seine neuen Schritte als offen mit.
