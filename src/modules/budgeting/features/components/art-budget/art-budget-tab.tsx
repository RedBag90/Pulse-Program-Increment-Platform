import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatCompactEUR, formatEUR } from "@/lib/formatting";
import {
  ALLOCATION_STATE_KEYS,
  allocationShare,
  type AllocationState,
} from "@/modules/budgeting/domain/allocation-state";
import { potStanding } from "@/modules/budgeting/domain/art-epic-budget";
import { ArtPotSection } from "@/modules/budgeting/features/components/art-budget/art-pot-section";
import { ownWorkGuide } from "@/modules/budgeting/domain/art-own-work";
import { SectionCard } from "@/components/ui/section-card";
import { CoverageOneLiner } from "@/modules/budgeting/features/components/art-budget/coverage-card";
import {
  UNFUNDED_REASON_KEYS,
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
  const t = useTranslations();
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
        {t("budgeting.art.nochZuVerteilen")}
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
          {t("budgeting.art.verteilen")}
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
 * **Eine Folge von Karten, kein Reiterinhalt mehr.**
 *
 * Diese Fläche war einmal in zwei Reiter geschnitten — „Übersicht" zum Lesen,
 * „Verteilen" zum Arbeiten — und trug dafür ein `view`-Kennzeichen. Der Schnitt
 * ist weg: die Naht liegt heute zwischen Wertstrom und ART, und auf dem
 * ART-Reiter gehören beide Hälften **demselben** Handelnden. Ein Kennzeichen
 * mit einem einzigen Wert ist kein Kennzeichen; es ist entfallen.
 *
 * Was bleibt, ist die Reihenfolge: **Nachschlagewerk vor Handlung** (REQ-4).
 * Was zugeteilt ist, steht über dem, was zu verteilen ist — und die
 * Verteilfläche ist die einzige Karte mit Akzentschiene und Schrittnummer.
 */
export function ArtBudgetTab({
  detail,
  distributeHref,
  kpiHref,
  canDistribute = false,
}: {
  detail: ArtBudgetDetail;
  /** Wohin „Verteilen →" führt — die Fläche kennt ihren eigenen Reiter nicht. */
  distributeHref: string;
  /** Wohin die Deckungszeile führt — der Reiter mit der Herleitung. */
  kpiHref: string;
  canDistribute?: boolean;
}) {
  const t = useTranslations();
  const cycleLabel = detail.cycles.find((c) => c.key === detail.cycleKey)?.label ?? detail.cycleKey;
  return (
    // `space-y-6` wie zwischen allen Abschnittskarten dieser Seite.
    <div className="space-y-6">
      {/*
        **Von der Deckungskarte bleibt hier eine Zeile** — der Rest wohnt im
        Reiter „Budget-KPIs". Das Ergebnis ist keine Detailinformation und
        gehört auf die Arbeitsfläche; die Herleitung ist eine und gehört an
        einen Ort zum Nachschlagen.
      */}
      {detail.coverage && (
        <CoverageOneLiner coverage={detail.coverage} kpiHref={kpiHref} cycleKey={detail.cycleKey} />
      )}

      {detail.sources.map((s) => (
        <SectionCard
          key={s.source}
          title={`${s.label} · ${cycleLabel}`}
          contentClassName="space-y-3"
        >
          <div className={`grid gap-4 ${s.source === "art" ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
            <div className="rounded-lg bg-card shadow-card p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t("budgeting.art.zugeteilt")}
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
                  {t(ALLOCATION_STATE_KEYS[state])}
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
              {t("budgeting.art.fuerDiesesHalbjahrIst")}
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              <li className="flex items-center gap-3 bg-surface-frame px-3 py-2 text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <span className="flex-1">{t("budgeting.art.epic")}</span>
                <span className="w-32">{t("budgeting.art.zustand")}</span>
                <span className="w-28 text-right">{t("budgeting.art.zuteilung")}</span>
                <span className="w-12 text-right">{t("budgeting.art.anteil")}</span>
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
                    {t(ALLOCATION_STATE_KEYS[r.state])}
                  </span>
                  <span className="w-28 text-right tabular-nums">{formatEUR(r.amount)}</span>
                  <span className="w-12 text-right tabular-nums text-muted-foreground">
                    {s.breakdown.total > 0 ? Math.round((r.amount / s.breakdown.total) * 100) : 0} %
                  </span>
                </li>
              ))}
              <li className="flex items-center gap-3 bg-surface-frame px-3 py-2 text-sm font-semibold">
                <span className="flex-1">Σ</span>
                <span className="w-32" />
                <span className="w-28 text-right tabular-nums">{formatEUR(s.breakdown.total)}</span>
                <span className="w-12 text-right tabular-nums">100 %</span>
              </li>
            </ul>
          )}

          <p className="text-sm text-muted-foreground">
            „{t(ALLOCATION_STATE_KEYS.notStarted)}" ist das Restbudget — es hängt an diesen Epics
            und wird ohne neue Budget-Kachel nicht umgewidmet.
          </p>
        </SectionCard>
      ))}

      {/*
        Hier stand „Verlauf" — die Halbjahres-Zuteilung auf ihre Monate
        verteilt. Sechs gleich hohe Balken: die Höhe war konstruktionsbedingt
        konstant, nur die Farbe wanderte. Die Zustandsstaffel eine Karte höher
        beantwortet dieselbe Frage — verbraucht, gebunden, nicht begonnen —
        ohne Monatsachse und ohne die Reifegrad-Historie jedes Epics.
      */}

      {detail.pot && (
        <ArtPotSection
          view={detail.pot}
          artId={detail.artId}
          canDistribute={canDistribute}
          /*
            Der Richtwert wird **hier** zusammengelegt: die eingeplante
            eigenständige Last kommt aus der Deckungsrechnung, der Satz
            ebenfalls. Ohne Deckung gibt es keinen Satz und damit keinen
            Richtwert — die Zeile bleibt trotzdem bedienbar.
          */
          guide={ownWorkGuide(
            detail.coverage?.plannedStandalone ?? { jobSize: 0, count: 0 },
            detail.coverage?.rate.rate ?? null,
          )}
        />
      )}

      <ReallocationView detail={detail} />

      {/*
        Hier stand eine Liste „Run the Business" — die Betriebspositionen, die
        diesen ART **direkt** tragen. Sie ist entfallen, weil die
        Herkunftstabelle über dieser Fläche dieselbe Frage vollständig
        beantwortet: direkt **und** über die Solutions **und** geschlüsselt.
        Nebeneinander wären es zwei Tabellen über dasselbe Geld mit
        verschiedenen Summen — bei Plant Efficiency stand die kleinere hier.

        `detail.rtb` bleibt geladen: `artDetailIsEmpty` entscheidet damit, ob
        ein ART überhaupt eine Fläche bekommt, und ein ART mit Betriebsgeld ist
        nicht leer.
      */}

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
        {t("budgeting.art.abgeleitetAusDenFinalisierten")}
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
  const t = useTranslations();
  const portfolio = detail.sources.find((s) => s.source === "portfolio");
  const free = portfolio?.breakdown.rows.filter((r) => r.state === "notStarted") ?? [];
  const freeSum = free.reduce((acc, r) => acc + r.amount, 0);
  const wantedSum = detail.unfunded.reduce((acc, u) => acc + u.ask, 0);
  if (free.length === 0 && detail.unfunded.length === 0) return null;

  const gap = wantedSum - freeSum;
  const byReason = new Map<UnfundedReason, UnfundedCandidate[]>();
  for (const u of detail.unfunded) byReason.set(u.reason, [...(byReason.get(u.reason) ?? []), u]);

  return (
    <SectionCard title={t("budgeting.art.wasSichVerschiebenLiesse")} contentClassName="space-y-3">
      <div className="grid overflow-hidden rounded-lg border md:grid-cols-2">
        <div className="border-b md:border-b-0 md:border-r">
          <div className="flex items-baseline gap-2 border-b bg-surface-frame px-3 py-2">
            <span className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t("budgeting.art.zugeteiltNichtBegonnen")}
            </span>
            <span className="ml-auto text-sm font-semibold tabular-nums">{formatEUR(freeSum)}</span>
          </div>
          {free.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {t("budgeting.art.jedeZuteilungIstBereits")}
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
              {t("budgeting.art.beantragtNichtFinanziert")}
            </span>
            <span className="ml-auto text-sm font-semibold tabular-nums">
              {formatEUR(wantedSum)}
            </span>
          </div>
          {detail.unfunded.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {t("budgeting.art.allesBeantragteWurdeFinanziert")}
            </p>
          ) : (
            [...byReason.entries()].map(([reason, items]) => (
              <div key={reason}>
                <div className="border-b bg-surface-frame px-3 py-1.5 text-meta uppercase tracking-[0.1em] text-muted-foreground">
                  {t(UNFUNDED_REASON_KEYS[reason])} · {UNFUNDED_REMEDIES[reason]}
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
              <strong className="font-semibold tabular-nums">{formatEUR(-gap)}</strong>{" "}
              {t("budgeting.art.bliebenUebrig")}
            </>
          )}
        </p>
      )}

      <p className="text-sm text-muted-foreground">{t("budgeting.art.umgewidmetWirdNichtHier")}</p>
    </SectionCard>
  );
}
