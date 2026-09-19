import { Link } from "@/i18n/navigation";
import { formatCompactEUR, formatEUR } from "@/lib/formatting";
import {
  ALLOCATION_STATE_LABELS,
  allocationShare,
  type AllocationState,
} from "@/modules/budgeting/domain/allocation-state";
import { potStanding } from "@/modules/budgeting/domain/art-epic-budget";
import { ArtPotSection } from "@/modules/budgeting/features/components/art-budget/art-pot-section";
import { AllocationCourseChart } from "@/modules/budgeting/features/components/art-budget/allocation-course-chart";
import {
  type ArtCoverage,
  coverageVerdict,
  UNFUNDED_REASON_LABELS,
  UNFUNDED_REMEDIES,
  type ArtBudgetDetail,
  type UnfundedCandidate,
  type UnfundedReason,
} from "@/modules/budgeting/domain/art-budget-model";

/**
 * Der Budget-Reiter eines ARTs: was zugeteilt ist, in welchem Zustand es steht,
 * und was an der Datenlage hakt.
 *
 * „Nicht begonnen" ist das Restbudget — aber ausdrücklich **nicht** frei
 * verfügbar: das Geld hängt an konkreten Epics und wird ohne neue Budget-Kachel
 * nicht umgewidmet. Die Fläche sagt das, statt es der Leserin zu überlassen.
 */

/**
 * **Die fünfte Kachel: was vom Rahmen noch nicht vergeben ist.**
 *
 * Die vier daneben beschreiben allesamt dasselbe Geld — das bereits an Epics
 * verteilte, aufgeschlüsselt nach seinem Zustand. Der unverteilte Rest stand
 * bisher nur im Reiter *Verteilen*, also dort, wo man schon hingegangen sein
 * muss, um zu erfahren, dass man hingehen sollte.
 *
 * Sie rechnet mit `pot.remaining` und nicht mit `total − breakdown.total`: der
 * Topf ist die Größe, die darüber entscheidet, was sich noch verteilen lässt.
 * Die Nachbarkachel *Zugeteilt* zählt die Zuteilungen dieses ARTs; beide
 * Summen können auseinanderlaufen, wenn ein Epic nach der Zuteilung den ART
 * gewechselt hat (`detail.switchedArt` weist diese Fälle gesondert aus).
 *
 * Der Link erscheint nur, wenn tatsächlich verteilt werden darf — einer, der
 * auf ein gesperrtes Formular führt, wäre eine falsche Auskunft.
 */
function RemainingTile({
  detail,
  distributeHref,
  canDistribute,
}: {
  detail: ArtBudgetDetail;
  /**
   * Wohin „Verteilen →" führt. **Fertig hereingereicht, nicht hier gebaut:**
   * vorher stand hier `${basePath}?tab=verteilen`, und die Kachel wusste damit,
   * wie der Reiter ihrer Seite heisst. Seit derselbe Falter auch in einer
   * aufgeklappten Zeile der Wertstromseite steht, stimmte das nicht mehr — dort
   * heisst der Reiter `betrieb`, und der Link führte still ins Leere.
   */
  distributeHref: string;
  canDistribute: boolean;
}) {
  const standing = potStanding(detail.pot?.pot ?? null);
  const showAmount = standing.state === "open" || standing.state === "closed";
  const note =
    standing.state === "open"
      ? `${Math.round(standing.share * 100)} % des Rahmens`
      : standing.state === "fully_distributed"
        ? "vollständig verteilt"
        : standing.state === "closed"
          ? standing.reason
          : "kein Rahmen zugesprochen";

  return (
    <div className="rounded-lg bg-card shadow-card p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Noch zu verteilen
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {showAmount ? formatCompactEUR(standing.remaining) : "—"}
      </div>
      <div className="text-xs text-muted-foreground">{note}</div>
      {standing.state === "open" && canDistribute && (
        <Link
          href={distributeHref}
          className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
        >
          Verteilen →
        </Link>
      )}
    </div>
  );
}

const STATE_COLOR: Record<AllocationState, string> = {
  notStarted: "var(--muted-foreground)",
  committed: "#60a5fa",
  consumed: "var(--primary)",
};

/** Reihenfolge der Kacheln: das Ganze, dann die Staffel von fertig nach offen. */
const TILE_ORDER: AllocationState[] = ["consumed", "committed", "notStarted"];

/**
 * Geschnitten nach **Modus, nicht nach Thema**: „Übersicht" ist alles zum Lesen,
 * „Verteilen" ist die Arbeit. Ein dritter Reiter für Run the Business wäre dünn
 * gewesen, und seine Tabellen beantworten dieselbe Frage wie die
 * Quellen-Staffel — woher kommt das Geld.
 *
 * Es gab einmal eine dritte Fassung, `view: "all"`, für die alte
 * Struktur-Fläche — mit eigenem Halbjahres-Umschalter, der auf `?tab=budget`
 * zeigte. Diesen Reiter gibt es hier nicht; die Fläche ist mit dem Umzug
 * verschwunden, die Fassung blieb. Sie ist entfernt (REQ-13).
 */
export function ArtBudgetTab({
  detail,
  distributeHref,
  canDistribute = false,
  view,
}: {
  detail: ArtBudgetDetail;
  /** Wohin „Verteilen →" führt — die Fläche kennt ihren eigenen Reiter nicht. */
  distributeHref: string;
  canDistribute?: boolean;
  view: "overview" | "distribute";
}) {
  const showRead = view !== "distribute";
  const showWork = view !== "overview";
  return (
    /*
      `space-y-4`, nicht `space-y-8`. Der Falter steckt jetzt in einer Karte —
      und trennte seine Unterabschnitte vorher **stärker** (32 px) als die Seite
      ihre Hauptabschnitte (24 px). Die Leiter stand auf dem Kopf: das
      Untergeordnete wirkte gewichtiger als das Übergeordnete.
    */
    <div className="space-y-4">
      {showRead && detail.coverage && <CoverageSection coverage={detail.coverage} />}

      {showRead &&
        detail.sources.map((s) => (
          <section key={s.source} className="space-y-3">
            <div className="flex items-baseline gap-3">
              <h3 className="text-sm font-medium">{s.label}</h3>
              <span className="text-sm text-muted-foreground">
                {detail.cycles.find((c) => c.key === detail.cycleKey)?.label}
              </span>
            </div>

            <div
              className={`grid gap-4 ${s.source === "art" ? "md:grid-cols-5" : "md:grid-cols-4"}`}
            >
              <div className="rounded-lg bg-card shadow-card p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Zugeteilt
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {s.breakdown.total > 0 ? formatCompactEUR(s.breakdown.total) : "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.breakdown.rows.length} {s.breakdown.rows.length === 1 ? "Epic" : "Epics"}
                </div>
              </div>

              {TILE_ORDER.map((state) => (
                <div key={state} className="rounded-lg bg-card shadow-card p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {ALLOCATION_STATE_LABELS[state]}
                  </div>
                  <div
                    className="mt-1 text-2xl font-semibold tabular-nums"
                    style={{ color: STATE_COLOR[state] }}
                  >
                    {s.breakdown.byState[state] > 0
                      ? formatCompactEUR(s.breakdown.byState[state])
                      : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {allocationShare(s.breakdown, state)} % · {s.breakdown.countByState[state]}{" "}
                    {s.breakdown.countByState[state] === 1 ? "Epic" : "Epics"}
                  </div>
                </div>
              ))}

              {s.source === "art" && (
                <RemainingTile
                  detail={detail}
                  distributeHref={distributeHref}
                  canDistribute={canDistribute}
                />
              )}
            </div>

            {s.breakdown.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Für dieses Halbjahr ist diesem ART nichts zugeteilt.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                <li className="flex items-center gap-3 bg-surface-frame px-3 py-2 text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  <span className="flex-1">Epic</span>
                  <span className="w-32">Zustand</span>
                  <span className="w-28 text-right">Zuteilung</span>
                  <span className="w-12 text-right">Anteil</span>
                </li>
                {s.breakdown.rows.map((r) => (
                  <li key={r.epicId} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="flex-1 truncate">
                      <Link
                        href={`/portfolio/epics/${r.epicId}`}
                        className="font-medium hover:underline"
                      >
                        {s.titles[r.epicId] ?? r.epicId}
                      </Link>{" "}
                      <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {r.stageGate}
                      </span>
                    </span>
                    <span className="flex w-32 items-center gap-1.5 text-xs">
                      <span
                        className="inline-block size-2 shrink-0 rounded-sm"
                        style={{ background: STATE_COLOR[r.state] }}
                      />
                      {ALLOCATION_STATE_LABELS[r.state]}
                    </span>
                    <span className="w-28 text-right tabular-nums">{formatEUR(r.amount)}</span>
                    <span className="w-12 text-right tabular-nums text-muted-foreground">
                      {s.breakdown.total > 0 ? Math.round((r.amount / s.breakdown.total) * 100) : 0}{" "}
                      %
                    </span>
                  </li>
                ))}
                <li className="flex items-center gap-3 bg-surface-frame px-3 py-2 text-sm font-semibold">
                  <span className="flex-1">Σ</span>
                  <span className="w-32" />
                  <span className="w-28 text-right tabular-nums">
                    {formatEUR(s.breakdown.total)}
                  </span>
                  <span className="w-12 text-right tabular-nums">100 %</span>
                </li>
              </ul>
            )}

            <p className="text-sm text-muted-foreground">
              „{ALLOCATION_STATE_LABELS.notStarted}" ist das Restbudget — es hängt an diesen Epics
              und wird ohne neue Budget-Kachel nicht umgewidmet.
            </p>
          </section>
        ))}

      {showRead && detail.course.portfolio && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Verlauf</h3>
          <p className="text-xs text-muted-foreground">
            Die Halbjahres-Zuteilung auf ihre Monate verteilt — die Höhe ist konstant, die
            Zusammensetzung wandert.
          </p>
          <AllocationCourseChart course={detail.course.portfolio} todayIndex={detail.todayIndex} />
        </section>
      )}

      {/* Einen ART-Rahmen gibt es nur in einer ART-Sicht — dort trägt
          `artId` immer einen Wert. */}
      {showWork && detail.pot && detail.artId != null && (
        <ArtPotSection view={detail.pot} artId={detail.artId} canDistribute={canDistribute} />
      )}

      {showWork && <ReallocationView detail={detail} />}

      {showRead && (detail.rtb.run.length > 0 || detail.rtb.change.length > 0) && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Run the Business</h3>
          <p className="text-sm text-muted-foreground">
            Diesem ART zugerechnet. Verantwortet wird das Budget im Wertstrom. Betrieb und
            ART-Rahmen stehen getrennt — das eine ist Run, das andere Grow.
          </p>
          {(
            [
              ["Betrieb", detail.rtb.run],
              ["ART-Rahmen", detail.rtb.change],
            ] as const
          ).map(([label, items]) =>
            items.length === 0 ? null : (
              <ul key={label} className="divide-y rounded-lg border">
                <li className="flex items-center gap-3 bg-surface-frame px-3 py-2 text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  <span className="flex-1">{label}</span>
                  <span className="w-28 text-right">je Kachel</span>
                  <span className="w-28 text-right">p. a.</span>
                </li>
                {items.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="flex-1 truncate">{i.name}</span>
                    <span className="w-28 text-right tabular-nums">{formatEUR(i.cycleAmount)}</span>
                    <span className="w-28 text-right tabular-nums text-muted-foreground">
                      {formatEUR(i.annualAmount)}
                    </span>
                  </li>
                ))}
                <li className="flex items-center gap-3 bg-surface-frame px-3 py-2 text-sm font-semibold">
                  <span className="flex-1">Σ</span>
                  <span className="w-28 text-right tabular-nums">
                    {formatEUR(items.reduce((s, i) => s + i.cycleAmount, 0))}
                  </span>
                  <span className="w-28 text-right tabular-nums">
                    {formatEUR(items.reduce((s, i) => s + i.annualAmount, 0))}
                  </span>
                </li>
              </ul>
            ),
          )}
        </section>
      )}

      {(detail.switchedArt.length > 0 || detail.epicsWithoutArt.count > 0) && (
        /*
          **Zugeklappt.** Das sind Vorbehalte zur Datenlage, keine Zahlen — sie
          standen gleichrangig neben der Deckung und haben die Fläche mit grauen
          Kästen gefüllt. Wer sie braucht, klappt sie auf; `<details>` ist im
          Haus das Mittel dafür, weil es ohne Client-Zustand tastaturbedienbar
          ist.
        */
        <details className="group/notes space-y-3 border-t pt-3">
          <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground marker:content-[''] hover:text-foreground">
            <span className="group-open/notes:hidden">▸ </span>
            <span className="hidden group-open/notes:inline">▾ </span>
            Anmerkungen zur Datenlage (
            {detail.switchedArt.length + (detail.epicsWithoutArt.count > 0 ? 1 : 0)})
          </summary>
          {detail.switchedArt.map((e) => (
            <p key={e.epicId} className="text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">{e.title}</strong> gehört inzwischen
              {e.currentArtName ? ` zum ART ${e.currentArtName}` : " keinem ART mehr"}. Das Budget
              zählt weiterhin hier — die Kachel hat es hier entschieden.
            </p>
          ))}
          {detail.epicsWithoutArt.count > 0 && (
            <p className="text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">
                {formatEUR(detail.epicsWithoutArt.amount)}
              </strong>{" "}
              sind im Wertstrom an {detail.epicsWithoutArt.count}{" "}
              {detail.epicsWithoutArt.count === 1 ? "Epic" : "Epics"} ohne ART-Zuordnung vergeben
              und erscheinen in keiner ART-Sicht.
            </p>
          )}
        </details>
      )}

      <p className="border-t pt-3 text-meta text-muted-foreground">
        Abgeleitet aus den finalisierten Budget-Kacheln. Pulse führt keine Ist-Kosten — der Zustand
        kommt aus den Reifegrad-Stempeln der Epics.
      </p>
    </div>
  );
}

/**
 * Angebot und Nachfrage nebeneinander: was zugeteilt, aber nicht begonnen ist —
 * und was beantragt, aber leer ausgegangen ist.
 *
 * Zwei getrennte Listen zwingen die Leserin, zwei Summen im Kopf zu behalten.
 * Genau hier würde jemand arbeiten wollen, deshalb steht die Differenz darunter.
 *
 * Die Fläche **bucht nichts um**: Beträge des Portfolio-Budgets ändern sich
 * ausschließlich beim Festschreiben einer Kachel. Sie zeigt, womit man in die
 * nächste Runde geht.
 */
function ReallocationView({ detail }: { detail: ArtBudgetDetail }) {
  const portfolio = detail.sources.find((s) => s.source === "portfolio");
  const free = portfolio?.breakdown.rows.filter((r) => r.state === "notStarted") ?? [];
  const freeSum = free.reduce((acc, r) => acc + r.amount, 0);
  const wantedSum = detail.unfunded.reduce((acc, u) => acc + u.ask, 0);
  if (free.length === 0 && detail.unfunded.length === 0) return null;

  const gap = wantedSum - freeSum;
  const byReason = new Map<UnfundedReason, UnfundedCandidate[]>();
  for (const u of detail.unfunded) byReason.set(u.reason, [...(byReason.get(u.reason) ?? []), u]);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">Was sich verschieben ließe</h3>

      <div className="grid overflow-hidden rounded-lg border md:grid-cols-2">
        <div className="border-b md:border-b-0 md:border-r">
          <div className="flex items-baseline gap-2 border-b bg-surface-frame px-3 py-2">
            <span className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Zugeteilt, nicht begonnen
            </span>
            <span className="ml-auto text-sm font-semibold tabular-nums">{formatEUR(freeSum)}</span>
          </div>
          {free.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Jede Zuteilung ist bereits in Arbeit.
            </p>
          ) : (
            free.map((r) => (
              <div
                key={r.epicId}
                className="flex items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0"
              >
                <Link
                  href={`/portfolio/epics/${r.epicId}`}
                  className="flex-1 truncate font-medium hover:underline"
                >
                  {portfolio?.titles[r.epicId] ?? r.epicId}
                </Link>
                <span className="tabular-nums">{formatEUR(r.amount)}</span>
              </div>
            ))
          )}
        </div>

        <div>
          <div className="flex items-baseline gap-2 border-b bg-surface-frame px-3 py-2">
            <span className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Beantragt, nicht finanziert
            </span>
            <span className="ml-auto text-sm font-semibold tabular-nums">
              {formatEUR(wantedSum)}
            </span>
          </div>
          {detail.unfunded.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Alles Beantragte wurde finanziert.
            </p>
          ) : (
            [...byReason.entries()].map(([reason, items]) => (
              <div key={reason}>
                <div className="border-b bg-surface-frame px-3 py-1.5 text-meta uppercase tracking-[0.1em] text-muted-foreground">
                  {UNFUNDED_REASON_LABELS[reason]} · {UNFUNDED_REMEDIES[reason]}
                </div>
                {items.map((u) => (
                  <div
                    key={u.epicId}
                    className="flex items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0"
                  >
                    <span className="flex-1 truncate">
                      <Link
                        href={`/portfolio/epics/${u.epicId}`}
                        className="font-medium hover:underline"
                      >
                        {u.title}
                      </Link>
                      {u.stageGate && (
                        <span className="ml-1.5 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {u.stageGate}
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums">{formatEUR(u.ask)}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {detail.unfunded.length > 0 && (
        <p className="rounded-lg border bg-surface-frame px-3 py-2 text-sm">
          {gap > 0 ? (
            <>
              Selbst wenn alles Nichtbegonnene umgewidmet würde, fehlten{" "}
              <strong className="font-semibold tabular-nums">{formatEUR(gap)}</strong>.
            </>
          ) : (
            <>
              Das Nichtbegonnene würde für alles Beantragte reichen —{" "}
              <strong className="font-semibold tabular-nums">{formatEUR(-gap)}</strong> blieben
              übrig.
            </>
          )}
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Umgewidmet wird nicht hier: Beträge des Portfolio-Budgets ändern sich ausschließlich beim
        Festschreiben einer Budget-Kachel. Diese Sicht zeigt, womit man in die nächste Runde geht.
      </p>
    </section>
  );
}

/**
 * Last gegen Deckung — die Zahl, wegen der jemand diese Seite öffnet, und
 * deshalb ganz oben.
 *
 * Eine **führende** Ampel im Klartext statt zweier gleichrangiger Chips: grün
 * und rot nebeneinander lassen die Leserin ratlos, welche zählt.
 *
 * Der Satz je Job-Size-Punkt trägt seine Herkunft und seine Vorbehalte mit. Er
 * ist eine Beobachtung aus der Historie dieses ARTs, keine Vorgabe — und wo er
 * sich nicht ableiten lässt, sagt die Fläche das, statt eine Zahl zu erfinden.
 */
function CoverageSection({ coverage }: { coverage: ArtCoverage }) {
  const { rate, gap } = coverage;
  const verdict = coverageVerdict(coverage);
  // `gap > 0` steht doppelt, damit der Über-Betrag unten ohne `!` auskommt.
  const over = verdict === "over" && gap != null && gap > 0;
  // 0 − 0 ist in IEEE 754 die negative Null: `formatEUR(-gap)` schriebe „-0 €".
  const under = gap == null ? null : gap === 0 ? 0 : -gap;
  const accent = over
    ? "var(--destructive)"
    : verdict === "empty"
      ? "var(--muted-foreground)"
      : "var(--primary)";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-block size-2.5 shrink-0 rounded-full"
          style={{ background: accent }}
        />
        <p className="text-base">
          {verdict === "empty" ? (
            <>
              <strong className="font-semibold">Nichts zugeteilt</strong> — für dieses Halbjahr hat
              dieser ART weder eingeplante Features noch Budget.
            </>
          ) : verdict === "unknown" ? (
            <>
              <strong className="font-semibold">Deckung nicht berechenbar</strong> — für diesen ART
              liegt kein €-Satz je Job-Size-Punkt vor.
            </>
          ) : over ? (
            <>
              <strong className="font-semibold">Überbucht um {formatEUR(gap)}</strong> — die
              eingeplanten Features übersteigen das Budget um{" "}
              {coverage.allocated > 0 ? Math.round((gap / coverage.allocated) * 100) : 100} %.
            </>
          ) : (
            <>
              <strong className="font-semibold">Gedeckt</strong> — die eingeplanten Features bleiben{" "}
              {formatEUR(under ?? 0)} unter dem Budget.
            </>
          )}
        </p>
      </div>

      {/*
        **Kein eigener Behälter mehr.** Hier stand eine Karte mit einer inline
        gefärbten 3-px-Kante — ein Container-Stil, den es genau einmal im ganzen
        Haus gab. Die Ampelfarbe trägt jetzt der Punkt oben und die Lücke unten;
        eine Farbe braucht keinen Kasten, um zu sprechen.
      */}
      <div className="rounded-lg border">
        <dl className="divide-y text-sm">
          <div className="flex justify-between gap-4 px-3 py-2">
            <dt>
              Eingeplante Feature-Last{" "}
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {coverage.plannedJobSize} JS
              </span>
              {rate.rate != null && <> × {formatEUR(rate.rate)}</>}
            </dt>
            <dd className="font-semibold tabular-nums">
              {coverage.loadEuro == null ? "—" : formatEUR(coverage.loadEuro)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-3 py-2">
            <dt>Zugeteiltes Budget</dt>
            <dd className="font-semibold tabular-nums">{formatEUR(coverage.allocated)}</dd>
          </div>
          <div className="flex justify-between gap-4 px-3 py-2">
            <dt className={over ? "font-semibold text-destructive" : "font-semibold"}>Lücke</dt>
            <dd className={`font-semibold tabular-nums ${over ? "text-destructive" : ""}`}>
              {under == null ? "—" : formatEUR(under)}
            </dd>
          </div>
        </dl>
      </div>

      {/*
        **Die Herleitung ist zugeklappt, der Satz steht im Deckel.** Drei graue
        und gelbe Kästen untereinander erklärten eine Zahl, die eine Zeile höher
        schon stand. Wer wissen will, woher sie kommt, klappt auf.
      */}
      <details className="group/rate rounded-lg border">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm text-muted-foreground marker:content-[''] hover:text-foreground">
          <span className="group-open/rate:hidden">▸ </span>
          <span className="hidden group-open/rate:inline">▾ </span>
          <strong className="font-medium text-foreground">
            {rate.rate == null
              ? "Kein Satz je Job Size"
              : `Satz je Job Size · ${formatEUR(rate.rate)}`}
          </strong>
          {rate.caveats.length > 0 && (
            <span className="ml-1.5 text-warning">
              · {rate.caveats.length} {rate.caveats.length === 1 ? "Vorbehalt" : "Vorbehalte"}
            </span>
          )}
        </summary>
        <p className="border-t px-3 py-2 text-sm text-muted-foreground">
          {rate.source === "empirical" ? (
            <>
              — Ø Budget aus {rate.cycles.map((c) => c.cycleKey).join(" und ")} (
              {formatEUR(rate.budgetSum)}) ÷ {rate.jobSizeSum} Job-Size-Punkte aus{" "}
              {rate.featureCount} fertiggestellten Features. Empirisch aus der Historie dieses ARTs.
              {/*
              Herkunft, nicht Rechnung: der Satz bleibt unverändert — das
              ART-Budget finanziert alles, was das ART tut. Die Zeile
              beantwortet die andere Frage: wie viel unserer Lieferung hing an
              keinem Vorhaben.
            */}
              {rate.standaloneFeatureCount > 0 && (
                <>
                  {" "}
                  Davon {rate.standaloneJobSizeSum} Punkte aus {rate.standaloneFeatureCount}{" "}
                  eigenständigen Features — ART-eigene Arbeit ohne Epic.
                </>
              )}
            </>
          ) : rate.source === "tenantDefault" ? (
            <>
              — der tenant-weite Vorgabewert, weil sich kein Satz aus der Historie ableiten lässt.
            </>
          ) : (
            <>— weder aus der Historie ableitbar noch als Vorgabewert gesetzt.</>
          )}
        </p>

        {rate.caveats.length > 0 && (
          <ul className="space-y-1 border-t px-3 py-2 text-sm text-warning">
            {rate.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
