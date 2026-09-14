import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { FigureKind } from "@/modules/wiki/domain/blocks";
import type { Guide, Perspective, Station } from "@/modules/wiki/domain/guide";
import { CADENCE_LABEL, CADENCE_HINT } from "@/modules/wiki/domain/cadence";
import { isOwnPerspective } from "@/modules/wiki/domain/guide-filter";
import { guideBySlug } from "@/modules/wiki/domain/guides";
import type { Role } from "@/modules/core/kernel/domain/roles";
import { Blocks } from "@/modules/wiki/features/wiki/components/block-renderer";
import { inline } from "@/modules/wiki/features/wiki/components/inline";

/**
 * Eine Anleitung, Entwurf B: **Perspektiven untereinander, mit Sprungleiste**.
 *
 * Alles auf einer Seite — durchsuchbar mit der Browser-Suche, verlinkbar bis auf
 * die einzelne Station, und die Uebergaben zwischen den Rollen bleiben sichtbar.
 * Der Preis ist die Laenge; die Sprungleiste traegt ihn.
 *
 * Serverkomponente. Die eigene Perspektive wird **markiert**, nicht
 * vorselektiert-und-versteckt: ein Wiki soll auch erklaeren, was die anderen
 * tun, sonst versteht niemand die Uebergaben.
 */
export function GuideView({
  guide,
  roles,
  figures,
}: {
  guide: Guide;
  roles: readonly Role[];
  figures: Partial<Record<FigureKind, ReactNode>>;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start">
      <GuideToc guide={guide} roles={roles} />

      <article className="space-y-8">
        <header className="space-y-3">
          <p className="font-mono text-meta uppercase tracking-[0.14em] text-muted-foreground">
            <Link href="/wiki" className="hover:text-foreground">
              Wiki
            </Link>
            <span className="px-1.5" aria-hidden>
              /
            </span>
            {CADENCE_LABEL[guide.cadence]} · {CADENCE_HINT[guide.cadence]}
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{guide.title}</h1>
          <p className="max-w-[var(--reading-max-w)] text-prose-lede leading-relaxed text-muted-foreground">
            {inline(guide.standfirst)}
          </p>
        </header>

        <section id="mechanik" className="scroll-mt-24 space-y-4">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Die gemeinsame Mechanik
          </h2>
          <Blocks blocks={guide.mechanics} figures={figures} />
        </section>

        {guide.perspectives.map((p, i) => (
          <PerspectiveSection
            key={p.label}
            perspective={p}
            index={i + 1}
            own={isOwnPerspective(p, roles)}
            figures={figures}
          />
        ))}

        {guide.misconceptions.length > 0 && (
          <section id="irrtuemer" className="scroll-mt-24 space-y-4">
            <h2 className="font-heading text-xl font-semibold tracking-tight">
              Sätze, die naheliegen und nicht stimmen
            </h2>
            <div className="overflow-x-auto rounded-lg bg-card shadow-card">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b px-4 py-2.5 text-left font-mono text-meta uppercase tracking-[0.1em] text-muted-foreground">
                      Satz
                    </th>
                    <th className="border-b px-4 py-2.5 text-left font-mono text-meta uppercase tracking-[0.1em] text-muted-foreground">
                      Warum er nicht stimmt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {guide.misconceptions.map((m, i) => (
                    <tr key={i}>
                      <td className="border-b border-border/60 px-4 py-2.5 align-top font-medium text-foreground last:border-b-0">
                        „{m.claim}“
                      </td>
                      <td className="border-b border-border/60 px-4 py-2.5 align-top text-muted-foreground last:border-b-0">
                        {inline(m.why)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {guide.who.length > 0 && (
          <section id="wer-was" className="scroll-mt-24 space-y-4">
            <h2 className="font-heading text-xl font-semibold tracking-tight">
              Wer welchen Schritt macht
            </h2>
            <div className="overflow-x-auto rounded-lg bg-card shadow-card">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["Schritt", "Wer", "Recht"].map((h) => (
                      <th
                        key={h}
                        className="border-b px-4 py-2.5 text-left font-mono text-meta uppercase tracking-[0.1em] text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guide.who.map((w, i) => (
                    <tr key={i}>
                      <td className="border-b border-border/60 px-4 py-2.5 align-top font-medium text-foreground last:border-b-0">
                        {w.step}
                      </td>
                      <td className="border-b border-border/60 px-4 py-2.5 align-top text-muted-foreground last:border-b-0">
                        {w.who}
                      </td>
                      <td className="border-b border-border/60 px-4 py-2.5 align-top last:border-b-0">
                        {w.capability ? (
                          <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs">
                            {w.capability}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <SeeAlso guide={guide} />
      </article>
    </div>
  );
}

/**
 * Die **Naehte**: wohin dieser Ablauf weitergeht.
 *
 * Aufgeloest wird ueber den Slug, nicht ueber eine mitgeschriebene Ueberschrift
 * — sonst stuende hier irgendwann ein Titel, den es nicht mehr gibt. Ein Slug,
 * der ins Leere zeigt, faellt weg; dass es keinen gibt, sichert der Test.
 */
function SeeAlso({ guide }: { guide: Guide }) {
  const targets = guide.seeAlso.map(guideBySlug).filter((g): g is Guide => g != null);
  if (targets.length === 0) return null;

  return (
    <section id="weiter" className="scroll-mt-24 space-y-3 border-t pt-6">
      <h2 className="font-heading text-xl font-semibold tracking-tight">Weiter lesen</h2>
      <ul className="grid gap-2 border-l-2 pl-4 md:grid-cols-2">
        {targets.map((g) => (
          <li key={g.slug}>
            <Link href={`/wiki/${g.slug}`} className="group block">
              <span className="text-sm font-medium text-foreground group-hover:underline">
                {g.title}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{g.teaser}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Ein Anker-Slug, der auch mit Umlauten und Punkten stabil bleibt. */
function anchorId(prefix: string, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefix}-${slug}`;
}

function PerspectiveSection({
  perspective,
  index,
  own,
  figures,
}: {
  perspective: Perspective;
  index: number;
  own: boolean;
  figures: Partial<Record<FigureKind, ReactNode>>;
}) {
  return (
    <section id={anchorId("p", perspective.label)} className="scroll-mt-24 space-y-5">
      <div className="space-y-1 border-t pt-6">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            {index} · {perspective.label}
          </h2>
          {own && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-label uppercase tracking-[0.1em] text-primary">
              deine Rolle
            </span>
          )}
        </div>
        <p className="text-prose text-muted-foreground">
          Meine Frage lautet: <strong className="text-foreground">{perspective.question}</strong>
        </p>
      </div>

      <ol className="space-y-0">
        {perspective.stations.map((s, i) => (
          <StationView
            key={s.title}
            station={s}
            n={i + 1}
            id={anchorId(anchorId("p", perspective.label), s.title)}
            figures={figures}
          />
        ))}
      </ol>
    </section>
  );
}

function StationView({
  station,
  n,
  id,
  figures,
}: {
  station: Station;
  n: number;
  id: string;
  figures: Partial<Record<FigureKind, ReactNode>>;
}) {
  return (
    <li id={id} className="relative scroll-mt-24 list-none pb-8 pl-11 last:pb-0">
      {/* Die Linie verbindet die Stationen; die letzte traegt keine. */}
      <span
        aria-hidden
        className="absolute bottom-0 left-[11px] top-7 w-px bg-border [li:last-child>&]:hidden"
      />
      <span className="absolute left-0 top-0 flex size-[23px] items-center justify-center rounded-full border bg-card font-mono text-meta text-muted-foreground">
        {n}
      </span>

      <div className="space-y-3">
        <h3 className="font-heading text-lg font-semibold">{station.title}</h3>
        <Blocks blocks={station.body} figures={figures} />
        {station.route && (
          <Link
            href={station.route}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
          >
            Hier entlang
            <code className="font-mono text-xs text-muted-foreground">{station.route}</code>
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </li>
  );
}

/**
 * Die Sprungleiste. Reine Anker-Links — kein Scroll-Spy, also keine
 * Client-Komponente: die Seite bleibt vollstaendig serverseitig, und die
 * Browser-Suche findet jeden Abschnitt, weil nichts eingeklappt ist.
 */
function GuideToc({ guide, roles }: { guide: Guide; roles: readonly Role[] }) {
  return (
    <nav aria-label="Auf dieser Seite" className="top-24 space-y-2 border-l pl-4 text-xs lg:sticky">
      <p className="font-mono text-label uppercase tracking-[0.14em] text-muted-foreground">
        Auf dieser Seite
      </p>
      <ul className="space-y-1.5">
        <li>
          <a href="#mechanik" className="text-muted-foreground hover:text-foreground">
            Die gemeinsame Mechanik
          </a>
        </li>
        {guide.perspectives.map((p, i) => (
          <li key={p.label}>
            <a
              href={`#${anchorId("p", p.label)}`}
              className={
                isOwnPerspective(p, roles)
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }
            >
              {i + 1} · {p.label}
            </a>
            <ul className="mt-1 space-y-1 pl-3">
              {p.stations.map((s) => (
                <li key={s.title}>
                  <a
                    href={`#${anchorId(anchorId("p", p.label), s.title)}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
        {guide.misconceptions.length > 0 && (
          <li>
            <a href="#irrtuemer" className="text-muted-foreground hover:text-foreground">
              Sätze, die nicht stimmen
            </a>
          </li>
        )}
        {guide.who.length > 0 && (
          <li>
            <a href="#wer-was" className="text-muted-foreground hover:text-foreground">
              Wer welchen Schritt macht
            </a>
          </li>
        )}
        {guide.seeAlso.length > 0 && (
          <li>
            <a href="#weiter" className="text-muted-foreground hover:text-foreground">
              Weiter lesen
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
}
