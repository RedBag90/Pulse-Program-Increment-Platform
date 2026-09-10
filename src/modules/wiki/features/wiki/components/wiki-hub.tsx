import { Link } from "@/i18n/navigation";
import type { Guide } from "@/modules/wiki/domain/guide";
import { CADENCES, CADENCE_LABEL, CADENCE_HINT } from "@/modules/wiki/domain/cadence";
import { guidesForRoles, isOwnPerspective } from "@/modules/wiki/domain/guide-filter";
import type { Role } from "@/modules/core/kernel/domain/roles";

/**
 * Der Hub, Entwurf A: **Der Bogen**.
 *
 * Die Anleitungen liegen nicht alphabetisch, sondern auf ihrem **Rhythmus** —
 * einmalig, je Idee, je Halbjahr, je PI, Querschnitt. Das ist die Ordnung, die
 * sie ohnehin haben, nur bisher nie gezeigt, und sie beantwortet als einzige die
 * Frage, die neue Nutzer zuerst haben: wie haengt das zusammen.
 *
 * Der **Faden** zwischen den Punkten ist nicht Zierrat, sondern die Aussage der
 * Flaeche: die Rhythmen folgen aufeinander. Ohne ihn waeren es fuenf Ueber-
 * schriften untereinander.
 *
 * Ein leerer Rhythmus faellt weg — in einem Mandanten ohne Budgeting gibt es
 * keinen Halbjahres-Takt zu erklaeren. Deshalb wird erst gefiltert und dann
 * gezeichnet: der Faden darf nicht an einer Zeile enden, die gar nicht da ist.
 */
export function WikiHub({ guides, roles }: { guides: readonly Guide[]; roles: readonly Role[] }) {
  const mine = guidesForRoles(guides, roles);

  const rows = CADENCES.map((cadence) => ({
    cadence,
    guides: guides.filter((g) => g.cadence === cadence),
  })).filter((r) => r.guides.length > 0);

  if (rows.length === 0) {
    return (
      <p className="max-w-[var(--reading-max-w)] text-[15px] text-muted-foreground">
        Für die freigeschalteten Module gibt es noch keine Anleitungen.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {mine.length > 0 && (
        <p className="max-w-[var(--reading-max-w)] text-[15px] text-muted-foreground">
          {mine.length === guides.length ? "Alle" : `${mine.length} von ${guides.length}`}{" "}
          {mine.length === 1 ? "Anleitung hat" : "Anleitungen haben"} eine Perspektive für deine
          Rolle — sie {mine.length === 1 ? "ist" : "sind"} unten markiert.
        </p>
      )}

      <div>
        {rows.map((row, i) => (
          <div
            key={row.cadence}
            className="grid gap-4 border-t py-5 first:border-t-0 first:pt-0 sm:grid-cols-[160px_minmax(0,1fr)]"
          >
            <div className="relative pl-5">
              <span
                aria-hidden
                className="absolute left-[3px] top-[7px] size-2 rounded-full bg-muted-foreground"
              />
              {i < rows.length - 1 && (
                // Der Faden zur naechsten Zeile. Er laeuft bewusst ueber die
                // Trennlinie hinaus bis zum naechsten Punkt.
                <span
                  aria-hidden
                  className="absolute bottom-[-2.75rem] left-[6px] top-[19px] w-px bg-border"
                />
              )}
              <h2 className="font-heading text-[15px] font-semibold">
                {CADENCE_LABEL[row.cadence]}
              </h2>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {CADENCE_HINT[row.cadence]}
              </p>
            </div>

            <div className="grid gap-2.5 md:grid-cols-2">
              {row.guides.map((g) => (
                <GuideTile key={g.slug} guide={g} roles={roles} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuideTile({ guide, roles }: { guide: Guide; roles: readonly Role[] }) {
  return (
    <Link
      href={`/wiki/${guide.slug}`}
      className="block rounded-lg border bg-card px-3.5 py-3 transition-colors hover:border-foreground/25"
    >
      <h3 className="font-heading text-[14.5px] font-semibold leading-snug">{guide.title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{guide.teaser}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {guide.perspectives.map((p) => (
          <span
            key={p.label}
            className={
              isOwnPerspective(p, roles)
                ? "rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-primary"
                : "rounded bg-muted px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground"
            }
          >
            {p.label}
          </span>
        ))}
      </div>
    </Link>
  );
}
