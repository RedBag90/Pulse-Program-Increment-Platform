import type { PracticeChip } from "@/server/views/transformation-cockpit";
import type { RagTier } from "@/domain/transformation-delta";

interface Props {
  practices: PracticeChip[];
}

const TIER_CHIP: Record<RagTier, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  done: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const TIER_DOT: Record<RagTier, string> = {
  green: "🟢",
  amber: "🟡",
  red: "🔴",
  done: "✓",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * One chip per enabled practice, RAG-coloured by adoption rate. Replaces the
 * six-stacked-bar "Praktiken (Adoption)" section. The detail string (e.g.
 * "95/105 Features bewertet") is shown beneath each chip; the structure mimics
 * a definition list so a screen reader gets value + detail in the right order.
 */
export function PracticesChipRow({ practices }: Props) {
  if (practices.length === 0) return null;

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 font-heading text-sm font-medium">Praktiken</h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {practices.map((p) => (
          <div key={p.key} className={`rounded-md border px-3 py-2 ${TIER_CHIP[p.tier]}`}>
            <dt className="flex items-baseline justify-between text-sm font-medium">
              <span>{p.label}</span>
              <span className="tabular-nums">
                {TIER_DOT[p.tier]} {pct(p.value)}
              </span>
            </dt>
            <dd className="mt-0.5 text-xs opacity-80">{p.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
