# Module: `work`

Epic-Definition/Dokumentation/Freigabe + Epic-Timeline + Feature-Breakdown + Ökonomie. Benötigt `core`.

- **Darf importieren von:** core.
- **Darf NICHT importieren von:** drumbeat, budgeting (obere Schichten).
- **Wird importiert von:** drumbeat, budgeting, `src/app`.
- **Stellt bereit:** Read-Ports `EpicSchedule`, `EpicEconomics`, `FeatureBreakdown`. Die in
  [ADR-0015](../../../docs/adr/0015-cross-module-write-through-via-events.md) geplanten
  Event-Handler (`FeatureStarted`, `FundedWindowDecided`) entfallen **beide**: die
  Reifegrad-Schreibkopplung ist mit
  [ADR-0018](../../../docs/adr/0018-stage-gate-transitions-are-requested-and-approved.md), die
  Fenster-Schreibkopplung mit
  [ADR-0019](../../../docs/adr/0019-epic-window-follows-the-maturity-plan.md) ersatzlos gestrichen
  statt event-ifiziert. Kein oberes Modul schreibt noch in Work hinein.

## Reifegrad-Wechsel (L0–L5)

Das Gate bewegt sich **ausschliesslich** über einen beantragten und von namentlich benannten Personen
abgenommenen `StageGateTransition` — nie als Nebenwirkung eines anderen Vorgangs.

| Datei                                      | Rolle                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `domain/gate-readiness.ts`                 | Kriterien je Ziel-Gate, **beim Lesen abgeleitet**, nie geschrieben               |
| `domain/gate-policy.ts`                    | Wer nimmt ab: Präzedenz Wertstrom → Tenant → Code-Default, Platzhalter-Auflösung |
| `domain/gate-transition.ts`                | `planGateRequest` / `decideGateTransitionOutcome` / `planGateRevert` + Stempel   |
| `domain/approval-primitives.ts`            | Von BC- und Gate-Achse geteiltes Vokabular (`assertAssignedApprover`, Quorum)    |
| `server/services/stage-gate-transition.ts` | Der impure Rand: laden, entscheiden lassen, persistieren, auditieren             |

Status: produktiv. Der Modul-Container ist vollständig befüllt (die frühere
„Skelett (Phase P1)"-Notiz war veraltet).
