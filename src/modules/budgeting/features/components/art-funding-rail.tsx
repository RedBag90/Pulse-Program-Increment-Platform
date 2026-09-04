import { Link } from "@/i18n/navigation";
import type { FundingPhase } from "@/modules/budgeting/domain/art-funding-phases";

/**
 * Der Leitfaden der ART-Budget-Kette — sitzt tab-unabhängig im Sub-Header
 * beider Detailflächen und beantwortet „wo stehe ich".
 *
 * Zwei Dinge unterscheiden ihn von `PeriodPhaseRail`, dem er nachgebaut ist:
 *
 *  - Die Sprungziele sind **ganze Routen**. Die Schritte liegen auf drei
 *    Flächen; erst seit alle drei unter `/budgeting` wohnen, ist das eine
 *    Leiste und keine Reise durch die Navigation.
 *  - Die Unterzeile nennt **wer dran ist**, wenn es nicht der Betrachter der
 *    Fläche ist. Für vier von fünf Schritten handelt jemand anderes; eine
 *    Leiste, die nur „offen" sagt, ließe den ART im Unklaren, worauf er wartet.
 */

const ACTOR_LABEL: Record<FundingPhase["actor"], string> = {
  value_stream: "Wertstrom",
  period: "Kachel",
  art: "ART",
};

/** Was unter dem Schritt steht — aus der Sicht der Fläche, auf der die Leiste sitzt. */
function subLabel(p: FundingPhase, surface: FundingPhase["actor"]): string {
  if (p.detail != null) return p.detail;
  if (p.state === "done") return "erledigt";
  if (p.state === "blocked") return p.blockedBy ?? "gesperrt";
  const mine = p.actor === surface;
  if (p.state === "current") return mine ? "dran · Sie" : `wartet auf: ${ACTOR_LABEL[p.actor]}`;
  return mine ? "offen" : ACTOR_LABEL[p.actor];
}

export function ArtFundingRail({
  phases,
  surface,
}: {
  phases: readonly FundingPhase[];
  /** Auf welcher Fläche die Leiste sitzt — entscheidet über „Sie" vs. „wartet auf". */
  surface: FundingPhase["actor"];
}) {
  return (
    <nav
      aria-label="ART-Budget — Schritte"
      className="flex overflow-x-auto rounded-lg border bg-card"
    >
      {phases.map((p, i) => {
        const blocked = p.state === "blocked";
        const mine = p.actor === surface && p.state === "current";
        const inner = (
          <>
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                p.state === "done"
                  ? "bg-emerald-500 text-white"
                  : p.state === "current"
                    ? "border-[1.5px] border-primary bg-primary/10 text-primary"
                    : "border-[1.5px] border-dashed border-border text-muted-foreground"
              }`}
            >
              {p.state === "done" ? "✓" : i + 1}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[12px] font-medium">{p.label}</span>
              <span
                className={`truncate text-[10px] ${mine ? "font-semibold text-primary" : "text-muted-foreground"}`}
              >
                {subLabel(p, surface)}
              </span>
            </span>
          </>
        );
        const shell = `flex min-w-[140px] flex-1 items-center gap-2.5 px-3 py-2.5 ${
          i > 0 ? "border-l" : ""
        } ${p.state === "current" ? "bg-primary/5" : ""} ${blocked ? "opacity-60" : ""}`;

        // Gesperrte Schritte springen nicht — und wo es keine Kachel gibt, gibt
        // es auch kein Ziel. Genau daran scheiterte die Vorgängerin der
        // Kachel-Leiste: „wer auf Schritt 4 klickte, landete auf Schritt 0."
        return p.href == null || blocked ? (
          <div key={p.key} className={shell} title={p.blockedBy}>
            {inner}
          </div>
        ) : (
          <Link
            key={p.key}
            href={p.href}
            aria-current={p.state === "current" ? "step" : undefined}
            className={`${shell} transition-colors hover:bg-muted/50`}
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
