import { APPROVAL_PHASE_LABELS, APPROVAL_PHASE_BADGE } from "@/components/detail/initiative-labels";

interface Props {
  /** `Initiative.approvalPhase`: draft | hypothesis_review | business_case | stakeholder_review | approved. */
  phase: string | null;
  /** Compact variant for dense rows (smaller padding + font). */
  compact?: boolean;
}

/**
 * Multi-party approval phase as a small RAG-coloured pill, drawn from the
 * shared `APPROVAL_PHASE_LABELS` + `APPROVAL_PHASE_BADGE` constants the Epic
 * detail page already uses. Surfaced on the portfolio epics list next to the
 * QS status pill so "approved" stops being ambiguous (the phase tells you
 * *what kind* of approved — hypothesis, business case, or fully through the
 * workflow).
 */
export function ApprovalPhasePill({ phase, compact = false }: Props) {
  if (!phase) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-muted px-2 text-muted-foreground ${
          compact ? "py-0 text-[10px]" : "py-0.5 text-xs"
        }`}
      >
        —
      </span>
    );
  }
  const cls = APPROVAL_PHASE_BADGE[phase] ?? "bg-muted text-foreground/80";
  const label = APPROVAL_PHASE_LABELS[phase] ?? phase;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 ${
        compact ? "py-0 text-[10px]" : "py-0.5 text-xs"
      } ${cls}`}
    >
      {label}
    </span>
  );
}
