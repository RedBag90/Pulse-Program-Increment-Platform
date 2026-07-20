# ADR-0007: Goal-Zugriffsstufen komponieren additiv über Capabilities

Status: Accepted
Date: 2026-07-20

## Context

Die geplante Asana-Adaption der Ziele (Backlog `docs/backlog/goals-asana-adoption.md`,
Epic 6) führt pro Ziel **Zugriffsstufen** (Admin/Editor/Viewer) ein — das Pendant zu
Asanas Access-Levels. Heute wird jede Ziel-Mutation über die Capability
`target.manage` gegated (TENANT_ADMIN + LPM + PORTFOLIO_MANAGER), scope-aware
geprüft über den Permission-Seam (`POLICIES` → `authorize`/`authorizeResource`,
siehe ADR-0002). Es gibt keine ziel-individuelle Rechtevergabe.

Frage: Wie soll die neue ziel-individuelle Zugriffsstufe mit dem bestehenden,
capability-basierten Seam zusammenspielen, ohne bestehende Rechte zu brechen?

Betrachtete Optionen:

1. **Additiv** — Capability bleibt oberste Ebene; eine `goal_access`-Zeile
   verfeinert nur nach unten (delegiert Editor/Viewer an einzelne User).
2. **Ersetzen** — nur noch `goal_access` entscheidet; `target.manage` verliert
   die Ziel-Hoheit.
3. **Scope-abgeleitet** — Editor ist, wer im zugeordneten Wertstrom/ART (Epic 6
   VS/ART-Zuordnung) einen passenden Scope besitzt.

## Decision

**Option 1 (additiv).**

- Wer `target.manage` im passenden Scope hat, darf ein Ziel weiterhin
  vollständig bearbeiten — unverändert.
- `goal_access` **erweitert nur nach unten**: Es kann einzelnen Usern, die sonst
  kein `target.manage` hätten, `editor` oder `viewer` auf ein einzelnes Ziel
  geben. Es **entzieht nie** ein bestehendes Recht.
- Das Vergeben/Entziehen von `goal_access` wird durch eine neue Capability
  `goal.share` gegated.
- Der Effektiv-Zugriff eines Users auf ein Ziel ist das **Maximum** aus
  (a) capability-basiertem Zugriff (`target.manage` via `authorizeResource`) und
  (b) expliziter `goal_access`-Zeile.
- Optionale spätere Anreicherung: die VS/ART-Zuordnung eines Ziels kann einen
  Default-`editor` für Personen mit passendem Scope ableiten (Option 3 als
  additiver Zusatz, nicht als Ersatz).

## Consequences

- **Kein Rechteverlust bei Migration** — ohne jede `goal_access`-Zeile ist das
  Verhalten identisch zu heute. Das ist die Definition-of-Done von Epic 6.
- Der Effektiv-Check bleibt im Service-Seam (`authorizeResource`-Stil, nach dem
  Laden des Ziels), erweitert um ein `goal_access`-Lookup; die UI-Affordances
  richten sich nach dem Effektiv-Level (`viewer` ⇒ read-only, kein „Update").
- `goal_access` ist ein zusätzliches, tenant-scoped Modell mit RLS-Policy
  (Cross-Cutting C1). Keine Änderung an `POLICIES` außer der neuen Capability
  `goal.share`.
- Verworfen: **Ersetzen** (unnötiger Bruch + Rechte-Migration aller Ziele),
  **rein scope-abgeleitet** (zu grob für individuelle Freigaben).
