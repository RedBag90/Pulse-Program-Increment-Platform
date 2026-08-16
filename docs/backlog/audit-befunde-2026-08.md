# Backlog: Audit-Befunde (August 2026)

**Status:** 📋 Beobachtungen, unbewertet — aufgefallen bei einer Durchsicht der PI-, Auth- und
Event-Pfade. Verifiziert gegen `e98f73c`. Bewusst **ohne** Lösungsentwurf: das sind Befunde, keine
Tickets. Die drei Punkte hängen nicht zusammen und können einzeln aufgegriffen werden.

---

## B1 — `tenant.create` steht faktisch jedem eingeloggten Nutzer offen

**Status:** 🔴 Autorisierungslücke.

Die Policy sagt das eine, das Verhalten das andere:

```ts
// src/server/auth/policies/index.ts:100
"tenant.create": [], // platform_admin only
```

Der Kommentar trifft nicht zu, weil `authorize()` einen Fast-Path hat, der **vor** jeder
Capability-Prüfung greift:

```ts
// src/server/auth/authorize.ts:85-89
if (principal.roles.includes(ROLES.PLATFORM_ADMIN) || principal.roles.includes(ROLES.TENANT_ADMIN))
  return { allow: true };
```

Der Doc-Kommentar darüber nennt das ausdrücklich Absicht („`platform_admin` und `tenant_admin` sind
allmächtig"). Das Problem entsteht erst im Zusammenspiel mit der automatischen Tenant-Anlage:
`ensurePersonalTenant` ([tenant.ts](../../src/server/services/tenant.ts)) legt beim ersten `/start`
für **jeden** Nutzer einen Personal-Tenant an und weist ihm dort `tenant_admin` zu.

**Folge:** Jeder Account, dessen aktiver Tenant der eigene Personal-Bereich ist, ist dort
`tenant_admin` und passiert damit den Fast-Path für `tenant.create`.

Verstärkende Umstände:

- `moduleForAction("tenant.create")` liefert `null` ⇒ kein Modul-Gate
  ([modules.ts](../../src/modules/core/kernel/domain/modules.ts)); im Test explizit als „ungegated"
  festgehalten.
- Angriffsfläche ist ein regulärer Endpunkt:
  [`POST /api/v1/admin/tenants`](../../src/app/api/v1/admin/tenants/route.ts).
- Kein Rate-Limit und kein Tenant-Quota (Suche nach `quota`/`tenantLimit` bleibt leer).
- `Tenant.name` hat kein `@unique` — beliebig viele gleichnamige Tenants sind möglich. Der
  `onUniqueConstraint('Tenant "..." already exists')`-Mapper in `tenant.ts` ist damit toter Code.

Offen ist, welche der beiden Seiten die beabsichtigte ist: der Kommentar (dann muss der Fast-Path für
diese Action ausgenommen werden) oder das Verhalten (dann ist der Kommentar irreführend).

---

## B2 — `completePi` ist über die Oberfläche nicht erreichbar

**Status:** 🐞 Offener Defekt.

Ein PI kann `planned → active`, aber **nie** `→ completed`.

`completePi` ([pi.ts](../../src/modules/drumbeat/server/services/pi.ts)) verlangt vier
Vorbedingungen — sauber modelliert als reine Regel in
[pi-lifecycle.ts](../../src/modules/drumbeat/domain/pi-lifecycle.ts) (`PiClosureSnapshot`):

1. keine `Issue`-Zeile mit `roamStatus: "open"` in den ARTs der Timeline
2. `systemDemoAt` gesetzt
3. `inspectAdaptAt` gesetzt
4. nicht-leere `retrospectiveNotes`

Die drei Stempel aus (2)–(4) kann **niemand mehr setzen**. Der Closure-Wizard wurde beim
Issue-Cutover (`a93ee40`) gelöscht; eine Suche nach `*closure*`/`*wizard*` unter `src/` ist leer, und
keine einzige `.tsx`-Datei berührt `systemDemoAt`, `inspectAdaptAt` oder `retrospectiveNotes`.

Die Schreibseite existiert weiter, aber ohne Aufrufer: `setPiClosureMetaAction`
([actions/pi.ts](../../src/modules/drumbeat/features/pi/actions/pi.ts)) wird von keiner Komponente
verwendet. Übrig ist
[pi-transition-button.tsx](../../src/modules/drumbeat/features/pi/components/pi-transition-button.tsx),
das bei „Complete PI" nur die Fehlermeldung des Services rendert.

Zwei Nebenbefunde an derselben Stelle:

- `evaluatePiClosure` zählt offene Issues über **alle ARTs der Timeline**, ohne Filter auf `piId`
  (`where: { roamStatus: "open", artId: { in: artIds } }`). Ein Issue aus PI 1 blockiert damit den
  Abschluss von PI 3.
- Der JSDoc über `evaluatePiClosure` nennt weiterhin „jedes committed Objective hat eine Confidence
  (1–5)" als Vorbedingung. `PiObjective` ist gedroppt — der Text ist veraltet.

---

## B3 — Vollständiger, aber unbenutzter Code

**Status:** 🧹 Aufräumen, unkritisch.

Rückstände aus dem Issue-Cutover und dem Cockpit-Umbau. Alle Punkte sind funktionsfähiger,
getesteter Code ohne Produktivpfad.

| Artefakt                                                                                         | Befund                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [system-demo.ts](../../src/server/services/system-demo.ts)                                       | 288 Zeilen, sechs Operationen, Capability `pi.demo.manage` registriert, Integrationstests grün — **einziger Importeur ist die eigene Testdatei**. Liegt zudem noch in `src/server/services/` statt im Drumbeat-Modul                                               |
| `PiStarted` / `PiCompleted` in [types.ts](../../src/modules/core/kernel/domain/types.ts):140,146 | Als Domain-Events deklariert und in die `DomainEvent`-Union aufgenommen — aber `publishDomainEvent` kennt sie nicht. Nie gefeuert; PI-Transitionen erzeugen nur Audit-Zeilen                                                                                       |
| `impediment.escalated`-Pfad                                                                      | Route ([publish.ts](../../src/server/events/publish.ts):12), Outbox-Handler und E-Mail-Vorlage sind vollständig — es gibt aber **keinen Producer**. Alle vier `publishDomainEvent`-Aufrufe im Code senden `user.invited`                                           |
| [setup-db.ts](../../src/test/setup-db.ts):25                                                     | Truncatet `impediments` — die Tabelle existiert seit dem Issue-Cutover nicht mehr                                                                                                                                                                                  |
| `prisma/sql/invariants.sql` I4                                                                   | `(level IN (1,2)) = (pi_id IS NOT NULL)` — „jedes Feature hat ein PI" widerspricht dem heutigen Code, der Features ohne PI im Backlog führt (`piId: string \| null`, `deletePi` setzt `piId → null`). Entweder nicht angewandt oder gelockert; welches, ist unklar |

Der letzte Punkt ist der einzige mit möglicher Wirkung über das Aufräumen hinaus: solange offen ist,
ob I4 in der Datenbank aktiv ist, ist auch offen, ob programmatisch angelegte Features ohne PI
durchgehen.
