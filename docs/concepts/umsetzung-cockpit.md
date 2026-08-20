# Umsetzung-Modul: Delivery-Cockpit

Status: konsolidiert (Refactor „Umsetzung-Konsolidierung"). Ersetzt die zuvor nur in Code-
Kommentaren verstreute „P1–P7"-Redesign-Story.

## Zielbild

Es gibt **genau eine** Delivery-Oberfläche: das **Cockpit** unter `/umsetzung`. PI und ART sind
**Scopes** darin, keine eigenen Seiten mehr. Der Lebenszyklus **Planen → Umsetzen → Abschließen**
passiert am selben Ort, ohne Layout-Bruch und ohne Doppel-Oberflächen.

Eine Page, ein konsolidiertes Read-Model (`umsetzung-cockpit-view.ts`, Loader/Builder-Split), vier
Sichten:

| Sicht (`?view=`) | Zweck |
|---|---|
| `board` (Default) | Feature-Matrix PI × Status, Drag = PI/Status, optimistisch |
| `table` | Inline-Edit + Bulk-Aktionen |
| `roadmap` | Gantt über die PIs, gruppiert nach Epic, Dependency-Kanten |
| `network` | Dependency-Netzplan (dagre/ReactFlow) |

## URL-Contract (`/umsetzung`)

| Param | Bedeutung |
|---|---|
| `?art=<id>` | ART-Scope (Picker nur bei >1 ART) |
| `?pi=<id>` | Governance-Scope: wählt das PI für die **Kontext-Leiste**; Default = aktives PI |
| `?view=` | board \| table \| roadmap \| network |
| `?piw=<n>` | Verschiebung des PI-Strip-Fensters gegenüber dem Anker (aktives PI) |
| `?status=,?blocker=,?owner=,?epic=` | Filter (server-seitig honoriert; UI für Status + Blocker in der Top-Bar) |
| `?featureId=<id>` | öffnet den Feature-Slide-Over |

`?pi=` filtert **nicht** die Feature-Menge (das Board *ist* nach PIs gespalten) — es steuert die
PI-Kontext-Leiste (Fakten + Aktionen) und die Strip-Hervorhebung.

## PI-Lebenszyklus & Abschluss

- Zustände `planned → active → completed` (`domain/pi-lifecycle.ts`, `PI_TRANSITIONS`/`canTransition`),
  eine-aktive-PI-pro-Timeline-Invariante in `startPi`.
- **Abschließen läuft ausschließlich über „PI abschließen & nächstes öffnen"** (`advanceCadence`):
  schließt das aktive PI ab und öffnet das nächste (erzeugt es aus der Kadenz, falls keins existiert).
  Offene ROAM-Issues erscheinen als **nicht-blockierende Warnung**, nicht als Gate.
- Der strenge `completePi` (mit Closure-Gate `evaluateClosure`: System-Demo/Inspect&Adapt/Retro) ist
  **aus dem UI entfernt**. Er bleibt als **programmatischer Weg** über die v1-REST-API
  (`POST /api/v1/pis/[id]/complete`, Capability `pi.complete`). Solange es keine UI zum Setzen der
  Ceremony-Termine gibt, ist das der einzige Ort, an dem das Gate greift.

Berechtigung: `pi.start` / `pi.advance` sind für RTE **und** Value-Stream-Owner freigegeben (+ Admin-Bypass).

## Was diese Konsolidierung abgelöst hat

- **PI-Detailseiten** `/pi/[piId]`, `/pi/[piId]/v2`, `/pi/[piId]/dependencies` → gelöscht; `/pi/[piId]`
  ist ein **weicher Redirect** ins Cockpit (Scope aufgelöst), damit Bestands-Links weiter funktionieren.
- **ART-v2-Parallelwelt** (`/art/[artId]/v2` + Tab-Shell) und die **LayoutToggle-Routen-Maschinerie**
  (`layout-toggle-routes.ts`) → gelöscht. (Die `LayoutToggle`-Komponente bleibt — Ziele nutzt sie.)
- Toter Closure-Wizard-Code (`setPiClosureMeta`, `evaluatePiClosure`) und verwaiste PI-Detail-
  Komponenten (`pi-detail.ts`, `pi-overview-summary`, `pi-features-by-art`, `pi-art-chips`,
  `assign-features-dialog`) → entfernt.

## Bewusst außerhalb dieses Refactors (Backlog)

- **ART overview/pi → Cockpit-Redirect-Kollaps**: die v1-ART-Seiten (Overview/PI/Settings/History)
  bestehen weiter. Der Kollaps auf reine Cockpit-Scopes würde die ART-Settings verwaisen (Struktur-/
  Chip-Links zeigen auf `/art/[id]`) und muss in `structure` nachgezogen werden.
- **Governance** (SAFe-PI-Objectives, System-Demo-Tracking): Schema-Reste (`SystemDemo*`,
  `systemDemoAt` u. a.) existieren, aber ohne UI — bewusst nicht wiederbelebt.
- **Seam-Feinschliff**: Board-Typen leben im Read-Model statt in der Domain (`domain/board-matrix.ts`
  importiert sie „nach oben"); der Epic-Breakdown-Netzplan wird als **Client**-Komponente von `work`
  „nach oben" importiert (der Server-Pfad ist bereits über einen Port entkoppelt); die zwei PI-Action-
  Stile (hand-gerollt vs. `createServerAction`) sind noch nicht vereinheitlicht.
- **Owner-/Epic-Filter-Picker**: die Params werden serverseitig honoriert, ein UI-Picker dafür fehlt noch.
