import { ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { PeriodAmounts } from "@/modules/budgeting/domain/period-map";
import type { Period } from "@/modules/budgeting/domain/period-window";
import type { ArtFeatureLoad } from "@/modules/budgeting/domain/art-budget";
import type { ArtGridModel } from "@/modules/budgeting/server/views/art-budget-breakdown";
import { AllocationBar } from "@/modules/budgeting/features/components/round/allocation-bar";
import { formatEUR } from "@/lib/formatting";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * **Das Geld eines Wertstroms, aufgeschlüsselt je ART** — eine Tabelle, in der
 * die Zeilen aufklappen.
 *
 * Die Form kommt aus der Frage, für die es die Fläche gibt: wer einen Business
 * Case für einen Wertstrom rechnet, baut sich eine Tabelle mit **Halbjahren als
 * Spalten**. Niemand baut eine Übersicht mit einer Zeitspalte. Und eine
 * Excel-Gruppe klappt **in denselben Spalten** auf — deshalb bleibt die Matrix,
 * und das Detail hängt darunter, statt sie zu ersetzen.
 *
 * Hier standen **zwei** Tabellen untereinander: „Zugeteilt je ART" mit dem Geld
 * und „Feature-Last je ART" mit der Last, beide mit denselben Spalten und
 * denselben Zeilen. Wer beides vergleichen wollte — und das ist die einzige
 * interessante Frage —, sprang zwischen ihnen hin und her. Jetzt steht die Last
 * klein unter dem Betrag, in derselben Zelle.
 *
 * **Server-Komponente, kein Client-State.** Der Schalter ist ein `<Link>` auf
 * `?art=`, wie Reiter und Halbjahr es auf dieser Seite ohnehin sind. Damit
 * überlebt der aufgeklappte Zustand das Teilen einer Adresse, den Zurück-Knopf
 * und den Reiterwechsel — und der Server lädt das Detail nur, wenn wirklich
 * eine Zeile offen ist.
 */
interface Props {
  model: ArtGridModel;
  /** Wohin die Links zeigen — ohne Query, die baut diese Fläche selbst. */
  basePath: string;
  /** Der Reiter, der erhalten bleiben soll. */
  tab: string;
  /** Das gewählte Halbjahr: seine Spalte ist markiert, sein Detail steht im Kasten. */
  cycleKey: string;
  /** Welche Zeile offen ist — `null`, wenn keine. */
  /**
   * Welche Zeile gerade offen ist — **nur zur Markierung**. Das Detail selbst
   * stand bis 2026-09-19 als `<tr><td colSpan={9}>` mitten in dieser Tabelle
   * und konnte deshalb keine eigene Fläche tragen: eine ganze Seite in einer
   * leicht getönten Tabellenzeile. Es steht jetzt als eigene Karte unter der
   * Tabelle — die Spalten hat es ohnehin nie benutzt.
   */
  expandedArtId: string | null;
  /**
   * ARTs, für die der Betrachter Beträge sehen darf (REQ-3). Die übrigen Zeilen
   * stehen mit Namen da: **dass** es sie gibt, ist keine Geheimhaltung wert,
   * was sie kosten, schon.
   */
  visibleArtIds: ReadonlySet<string>;
  /** Budgetplan, „Nicht zugeordnet" und Auslastung — nur mit Wertstrom-Recht. */
  showTotals: boolean;
}

export function ArtBudgetBreakdown({
  model,
  basePath,
  tab,
  cycleKey,
  expandedArtId,
  visibleArtIds,
  showTotals,
}: Props) {
  const { periods } = model;

  /** Zeile auf- oder zuklappen; eine Zelle wählt zusätzlich ihr Halbjahr. */
  const href = (artId: string | null, cycle: string = cycleKey) => {
    const q = new URLSearchParams({ tab, cycle });
    if (artId != null) q.set("art", artId);
    return `${basePath}?${q.toString()}`;
  };

  if (model.isEmpty) {
    return (
      <SectionCard title="Zugeteilt je ART">
        <EmptyState
          title="Noch kein ART"
          body="Ohne ART gibt es nichts, worauf sich ein Budget verteilen liesse. ARTs entstehen unter „Organisation“."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Zugeteilt je ART"
      description="Je Halbjahr der zugeteilte Betrag, darunter klein die Feature-Last. Eine Zeile öffnet das Halbjahr der angeklickten Spalte."
      bleed
      contentClassName="space-y-3"
    >
      <div className="overflow-x-auto border-y">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-surface-frame text-meta uppercase tracking-[0.1em] text-muted-foreground">
              <th className="p-2 text-left font-medium">ART</th>
              {periods.map((p) => (
                <th
                  key={p.key}
                  scope="col"
                  aria-current={p.key === cycleKey ? "true" : undefined}
                  className={`p-2 text-right font-medium ${
                    p.key === cycleKey ? "bg-primary/5 text-primary" : ""
                  }`}
                >
                  {p.label}
                </th>
              ))}
              <th className="p-2 text-right font-medium">Backlog</th>
              <th className="p-2 text-right font-medium">Σ</th>
              {/*
                **Betrieb steht neben der Rechnung, nicht darin.** Das Geld
                gehört dem ART, aber es bezahlt kein Feature: Deckung, Lücke und
                der €-Satz je Job-Size-Punkt rechnen ohne es (REQ-10). Deshalb
                eine eigene Spalte, abgesetzt, mit eigener Überschrift — und
                nicht ein zweiter Summand in einer bestehenden.
              */}
              <th className="border-l p-2 text-right font-medium">Betrieb · je HJ</th>
            </tr>
          </thead>
          <tbody>
            {showTotals && (
              <tr className="border-b text-xs text-muted-foreground">
                <td className="p-2">Wertstrom-Budget</td>
                {periods.map((p) => (
                  <td
                    key={p.key}
                    className={`p-2 text-right tabular-nums ${
                      p.key === cycleKey ? "bg-primary/5" : ""
                    }`}
                  >
                    {formatEUR(model.vsByPeriod[p.key] ?? 0)}
                  </td>
                ))}
                <td className="p-2" />
                <td className="p-2 text-right tabular-nums">
                  {formatEUR(sumOf(model.vsByPeriod, periods))}
                </td>
                <td className="border-l p-2" />
              </tr>
            )}

            {model.rows.map((a) => {
              const open = expandedArtId === a.artId;
              const maySeeNumbers = visibleArtIds.has(a.artId);
              return (
                <tr key={a.artId} className={`border-b align-top ${open ? "bg-primary/5" : ""}`}>
                  <td className="p-2 font-medium">
                    {maySeeNumbers ? (
                      <Link
                        href={href(open ? null : a.artId)}
                        aria-expanded={open}
                        className="-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {open ? (
                          <ChevronDown className="size-3.5 shrink-0" aria-hidden />
                        ) : (
                          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
                        )}
                        {a.name}
                      </Link>
                    ) : (
                      // Kein Aufklappen und keine Beträge — aber der Name
                      // steht da. Eine Lücke in der Liste wäre die schlechtere
                      // Auskunft (REQ-3).
                      <span className="inline-flex items-center gap-1 pl-[1.125rem] text-muted-foreground">
                        {a.name}
                      </span>
                    )}
                  </td>
                  {periods.map((p) => (
                    <td
                      key={p.key}
                      className={`p-2 text-right tabular-nums ${
                        p.key === cycleKey ? "bg-primary/5" : ""
                      }`}
                    >
                      {!maySeeNumbers ? (
                        <span className="text-muted-foreground">·</span>
                      ) : (
                        <Link
                          href={href(open && p.key === cycleKey ? null : a.artId, p.key)}
                          className="-mx-1 block rounded-md px-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <MoneyAndLoad
                            amount={a.budgetByPeriod[p.key] ?? 0}
                            cell={a.load.byPeriod[p.key]}
                          />
                        </Link>
                      )}
                    </td>
                  ))}
                  <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">
                    {maySeeNumbers ? <LoadOnly cell={a.load.backlog} /> : "·"}
                  </td>
                  <td className="p-2 text-right font-medium tabular-nums">
                    {maySeeNumbers ? (
                      <MoneyAndLoad amount={sumOf(a.budgetByPeriod, periods)} cell={a.load.total} />
                    ) : (
                      <span className="text-muted-foreground">·</span>
                    )}
                  </td>
                  <td className="border-l p-2 text-right tabular-nums text-muted-foreground">
                    {!maySeeNumbers ? (
                      "·"
                    ) : a.operatingPerCycle > 0 ? (
                      formatEUR(a.operatingPerCycle)
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {showTotals && (
              <>
                {/*
                  „Nicht zugeordnet" statt „Rest": die Differenz sind Zuteilungen
                  ohne ART dieses Wertstroms, keine Reserve. `unassignedToArts`
                  rechnet sie; die Zahl stand im Modell und wurde nie gezeigt.
                */}
                <tr className="border-t text-xs text-muted-foreground">
                  <td className="p-2">Nicht zugeordnet</td>
                  {periods.map((p) => (
                    <td
                      key={p.key}
                      className={`p-2 text-right tabular-nums ${
                        p.key === cycleKey ? "bg-primary/5" : ""
                      }`}
                    >
                      {formatEUR(model.unassigned[p.key] ?? 0)}
                    </td>
                  ))}
                  <td className="p-2" />
                  <td className="p-2 text-right tabular-nums">
                    {formatEUR(sumOf(model.unassigned, periods))}
                  </td>
                  {/*
                    Betriebsgeld an einer Solution **ohne** ART. Es steht hier,
                    statt still zu verschwinden — und es ist zugleich der
                    einzige Grund, aus dem `solutions.art_id` zur Pflicht wird.
                  */}
                  <td className="border-l p-2 text-right tabular-nums">
                    {model.operatingUnresolved > 0 ? formatEUR(model.operatingUnresolved) : ""}
                  </td>
                </tr>
                <tr className="border-t">
                  <td className="p-2 align-top text-xs font-medium text-muted-foreground">
                    Auslastung
                  </td>
                  {periods.map((p) => (
                    <td
                      key={p.key}
                      className={`p-2 align-top ${p.key === cycleKey ? "bg-primary/5" : ""}`}
                    >
                      <AllocationBar
                        allocated={model.allocatedByPeriod[p.key] ?? 0}
                        budget={model.vsByPeriod[p.key] ?? 0}
                      />
                    </td>
                  ))}
                  <td className="p-2" />
                  <td className="p-2" />
                  <td className="border-l p-2" />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
      <p className="px-3 text-meta text-muted-foreground">
        Abgeleitet aus der Finalisierung der Budgeting-Zeiträume.{" "}
        <Link href="/budgeting/periods" className="text-primary hover:underline">
          Zu den Zeiträumen →
        </Link>
      </p>
    </SectionCard>
  );
}

/** Σ über die angezeigten Spalten — nicht über alles, was die Karte kennt. */
function sumOf(amounts: PeriodAmounts, periods: readonly Period[]): number {
  return periods.reduce((s, p) => s + (amounts[p.key] ?? 0), 0);
}

/**
 * Betrag oben, Last klein darunter. **Beides in derselben Zelle** — das ist der
 * ganze Grund, die zwei Tabellen zusammenzulegen.
 */
function MoneyAndLoad({
  amount,
  cell,
}: {
  amount: number;
  cell?: { count: number; jobSize: number } | undefined;
}) {
  return (
    <>
      <span className="block">
        {amount > 0 ? formatEUR(amount) : <span className="text-muted-foreground">—</span>}
      </span>
      <span className="block text-meta text-muted-foreground">
        {cell && cell.count > 0 ? `${cell.count} F · ${cell.jobSize} JS` : " "}
      </span>
    </>
  );
}

/** Der Backlog trägt kein Geld — dort steht nur Last. */
function LoadOnly({ cell }: { cell?: ArtFeatureLoad["backlog"] | undefined }) {
  if (!cell || cell.count === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {cell.count} F · {cell.jobSize} JS
    </span>
  );
}
