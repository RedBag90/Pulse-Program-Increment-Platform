import { Link } from "@/i18n/navigation";
import type { StructureChip } from "@/server/views/transformation-cockpit";
import type { RagTier } from "@/domain/transformation-delta";

interface Props {
  structure: StructureChip[];
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

/** Where to go to close the gap for each structure dimension. */
const ACTION_HREF: Record<string, string> = {
  valueStreams: "/structure",
  arts: "/transformation/art-starten",
  teams: "/structure?tab=arts",
};

const ACTION_LABEL: Record<string, string> = {
  valueStreams: "Wertstrom hinzufügen",
  arts: "ART starten",
  teams: "Team hinzufügen",
};

/**
 * One chip per structure dimension (Wertströme / ARTs / Teams). Replaces the
 * "Strukturfortschritt zum Ziel" + "Struktur (Ist / Soll)" two-section stack
 * (overall bar + 3 dimension bars → 4 bars total) with three chips that each
 * carry their own RAG tier and, if a gap exists, a "→ Aktion" link straight to
 * the place to close it (the gap chip is the call-to-action).
 */
export function StructureChipRow({ structure }: Props) {
  if (structure.length === 0) return null;

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 font-heading text-sm font-medium">Struktur</h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {structure.map((d) => (
          <div key={d.key} className={`rounded-md border px-3 py-2 ${TIER_CHIP[d.tier]}`}>
            <dt className="flex items-baseline justify-between text-sm font-medium">
              <span>{d.label}</span>
              <span className="tabular-nums">
                {TIER_DOT[d.tier]} {d.ist}/{d.soll ?? "—"}
              </span>
            </dt>
            <dd className="mt-0.5 text-xs">
              {d.gap > 0 ? (
                <Link href={ACTION_HREF[d.key] ?? "/structure"} className="underline opacity-90">
                  noch {d.gap} — {ACTION_LABEL[d.key] ?? "anlegen"} →
                </Link>
              ) : (
                <span className="opacity-80">Ziel erreicht</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
