import { APPROVAL_PHASE_LABELS, APPROVAL_PHASE_BADGE } from "./initiative-labels";

/** The Epic's primary status pill — its multi-party approval phase. */
export function PhaseBadge({ phase }: { phase: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        APPROVAL_PHASE_BADGE[phase] ?? "bg-muted text-foreground/80"
      }`}
    >
      {APPROVAL_PHASE_LABELS[phase] ?? phase}
    </span>
  );
}
