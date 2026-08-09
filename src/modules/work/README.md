# Module: `work`

Epic-Definition/Dokumentation/Freigabe + Epic-Timeline + Feature-Breakdown + Ökonomie. Benötigt `core`.

- **Darf importieren von:** core.
- **Darf NICHT importieren von:** drumbeat, budgeting (obere Schichten).
- **Wird importiert von:** drumbeat, budgeting, `src/app`.
- **Stellt bereit (Ziel):** Read-Ports `EpicSchedule`, `EpicEconomics`, `FeatureBreakdown`; Event-Handler
  für `FeatureStarted`, `FundedWindowDecided` (siehe
  [ADR-0015](../../../docs/adr/0015-cross-module-write-through-via-events.md)).

Status: **Skelett** (Phase P1). Inhalte wandern in P4 hierher.
