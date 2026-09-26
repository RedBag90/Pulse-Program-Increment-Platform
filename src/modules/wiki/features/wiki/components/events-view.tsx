import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ROLE_LABELS } from "@/modules/core/kernel/domain/roles";
import {
  seatKey,
  type EventCatalog,
  type EventLevel,
  type EventParticipant,
  type EventPart,
  type WikiEvent,
} from "@/modules/wiki/domain/events";
import { inline } from "@/modules/wiki/features/wiki/components/inline";

/**
 * **Welche Termine es braucht** — die zweite Nachschlage-Fläche des Wikis,
 * neben „Wer was verantwortet".
 *
 * Gleiche Bauart wie `role-sheets-view.tsx`: Sprungleiste links, Artikel
 * rechts, reine Anker-Links, kein Client-JS, nichts eingeklappt — Strg+F
 * findet die ganze Seite.
 *
 * Die eigene Rolle wird **markiert, nicht gefiltert**: wer zu einem Termin
 * kommt, muss auch wissen, was die anderen mitbringen.
 */

const PART_SYMBOL: Record<EventPart, string> = {
  lead: "●",
  active: "○",
  optional: "(○)",
};

const PART_KEY: Record<EventPart, string> = {
  lead: "wiki.ui.terminLeitet",
  active: "wiki.ui.terminNimmtTeil",
  optional: "wiki.ui.terminOptional",
};

export function EventsView({
  catalog,
  own,
  guideTitles,
}: {
  catalog: EventCatalog;
  /**
   * Was der Leser selbst ist: seine Rollen und seine Benennungen
   * (`seatKey`, z. B. `rte`, `solution.product`).
   */
  own: readonly string[];
  /** Slug → Titel der Anleitungen, auf die ein Event verweist. */
  guideTitles: Readonly<Record<string, string>>;
}) {
  const t = useTranslations();
  return (
    // `minmax(0,1fr)` auch schmal: sonst schiebt die breiteste Tabelle die
    // ganze Spalte über den Bildschirmrand, statt selbst zu scrollen.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start">
      <EventsToc catalog={catalog} />

      <article className="space-y-8">
        <header className="space-y-3">
          <p className="font-mono text-meta uppercase tracking-[0.14em] text-muted-foreground">
            <Link href="/wiki" className="hover:text-foreground">
              {t("wiki.ui.wiki")}
            </Link>
            <span className="px-1.5" aria-hidden>
              /
            </span>
            {t("wiki.ui.nachschlagen")}
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{catalog.title}</h1>
          <p className="max-w-[var(--reading-max-w)] text-prose-lede leading-relaxed text-muted-foreground">
            {inline(catalog.lede)}
          </p>
          <Legend />
        </header>

        {catalog.levels.map((level) => (
          <LevelSection
            key={level.key}
            level={level}
            own={own}
            labelOf={(p) =>
              "role" in p ? ROLE_LABELS[p.role] : (catalog.dutyLabels[p.duty] ?? p.duty)
            }
            guideTitles={guideTitles}
          />
        ))}
      </article>
    </div>
  );
}

function Legend() {
  const t = useTranslations();
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {(["lead", "active", "optional"] as const).map((part) => (
        <span key={part}>
          <span className="font-mono text-foreground" aria-hidden>
            {PART_SYMBOL[part]}
          </span>{" "}
          {t(PART_KEY[part])}
        </span>
      ))}
    </p>
  );
}

function LevelSection({
  level,
  own,
  labelOf,
  guideTitles,
}: {
  level: EventLevel;
  own: readonly string[];
  labelOf: (p: EventParticipant) => string;
  guideTitles: Readonly<Record<string, string>>;
}) {
  return (
    <section id={level.key} className="scroll-mt-24 space-y-6">
      <div className="space-y-2 border-t pt-6">
        <h2 className="font-heading text-xl font-semibold tracking-tight">{level.title}</h2>
        {level.note && (
          <p className="max-w-[var(--reading-max-w)] text-prose text-muted-foreground">
            {inline(level.note)}
          </p>
        )}
      </div>
      {level.events.map((event) => (
        <EventCard
          key={event.key}
          event={event}
          own={own}
          labelOf={labelOf}
          guideTitles={guideTitles}
        />
      ))}
    </section>
  );
}

function EventCard({
  event,
  own,
  labelOf,
  guideTitles,
}: {
  event: WikiEvent;
  own: readonly string[];
  labelOf: (p: EventParticipant) => string;
  guideTitles: Readonly<Record<string, string>>;
}) {
  const t = useTranslations();
  const links = (event.seeAlso ?? []).filter((slug) => guideTitles[slug] != null);
  return (
    <section id={event.key} className="scroll-mt-24 space-y-3">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h3 className="font-heading text-lg font-semibold tracking-tight">{event.name}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-label uppercase tracking-[0.1em] text-muted-foreground">
            {event.cadence}
          </span>
        </div>
        <p className="max-w-[var(--reading-max-w)] text-prose leading-relaxed">
          {inline(event.purpose)}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg bg-card shadow-card">
        {/* Feste Spaltenbreiten, in jeder Tabelle dieselben — sonst springt
            „Anteil" von Event zu Event. Schmal wird jede Zeile ein Block:
            Rolle und Anteil oben, die Vorbereitung darunter — eine Tabelle,
            die seitlich scrollt, versteckte genau die Vorbereitung. */}
        <table className="w-full border-collapse text-sm max-md:block md:table-fixed">
          <colgroup>
            <col className="w-[12rem]" />
            <col className="w-[13rem]" />
            <col />
          </colgroup>
          <thead className="max-md:hidden">
            <tr>
              {[
                t("wiki.ui.terminRolle"),
                t("wiki.ui.terminAnteil"),
                t("wiki.ui.terminVorbereitung"),
              ].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap border-b px-4 py-2.5 text-left font-mono text-meta uppercase tracking-[0.1em] text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-md:block">
            {event.participants.map((p) => {
              const eigen = own.includes(seatKey(p));
              return (
                <tr
                  key={seatKey(p)}
                  data-own={eigen || undefined}
                  className={`max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:border-b max-md:border-border/60 max-md:last:border-b-0 ${eigen ? "bg-primary/5" : ""}`}
                >
                  <td className="px-4 py-2.5 align-top font-medium text-foreground max-md:pb-1 md:border-b md:border-border/60">
                    <span className="block">{labelOf(p)}</span>
                    {eigen && (
                      <span className="mt-1 inline-block whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 font-mono text-label uppercase tracking-[0.1em] text-primary">
                        {t("wiki.ui.deineRolle")}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 align-top max-md:pb-1 max-md:text-right md:border-b md:border-border/60">
                    <span className="font-mono" aria-hidden>
                      {PART_SYMBOL[p.part]}
                    </span>{" "}
                    {t(PART_KEY[p.part])}
                  </td>
                  <td className="px-4 py-2.5 align-top text-muted-foreground max-md:col-span-2 max-md:pt-1 md:border-b md:border-border/60">
                    {p.prep.length === 1 ? (
                      inline(p.prep[0]!)
                    ) : (
                      <ul className="space-y-1">
                        {p.prep.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span
                              className="mt-[0.5rem] size-1 shrink-0 rounded-full bg-muted-foreground"
                              aria-hidden
                            />
                            <span>{inline(item)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {links.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("wiki.ui.terminMehrDazu")}{" "}
          {links.map((slug, i) => (
            <span key={slug}>
              {i > 0 && " · "}
              <Link href={`/wiki/${slug}`} className="text-primary hover:underline">
                {guideTitles[slug]}
              </Link>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

function EventsToc({ catalog }: { catalog: EventCatalog }) {
  const t = useTranslations();
  return (
    <nav
      aria-label={t("wiki.ui.aufDieserSeite")}
      className="top-24 space-y-2 border-l pl-4 text-xs lg:sticky"
    >
      <p className="font-mono text-label uppercase tracking-[0.14em] text-muted-foreground">
        {t("wiki.ui.aufDieserSeite")}
      </p>
      <ul className="space-y-1.5">
        {catalog.levels.map((level) => (
          <li key={level.key}>
            <a href={`#${level.key}`} className="text-muted-foreground hover:text-foreground">
              {level.title}
            </a>
            <ul className="mt-1 space-y-1 pl-3">
              {level.events.map((e) => (
                <li key={e.key}>
                  <a href={`#${e.key}`} className="text-muted-foreground hover:text-foreground">
                    {e.name}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
