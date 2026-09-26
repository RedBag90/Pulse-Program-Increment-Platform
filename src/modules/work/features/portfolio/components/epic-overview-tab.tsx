import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { SectionCard } from "@/components/ui/section-card";
import { Stat, StatStrip } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  EpicAllocationStateView,
  EpicBudgetStandingView,
} from "@/modules/work/server/views/epic-detail";
import { EpicClassificationForm } from "./epic-classification-form";
import { EpicSolutionsSection } from "./solutions/epic-solutions-section";
import { EpicEditForm } from "./epic-edit-form";
import { EpicGovernanceFlags } from "./epic-governance-flags";
import { EpicClassBadge } from "./epic-class-badge";
import type { ClassificationSlice } from "@/modules/work/server/views/epic-detail";
import type { GuardrailTargetsSource } from "@/modules/work/domain/portfolio-guardrails";
import { EpicPlannedWindowForm } from "./epic-planned-window-form";
import { EpicBudgetPanel } from "./epic-budget-panel";
import { formatCompactEUR } from "@/lib/formatting";
import { buildInitiativeSummary } from "@/modules/core/kernel/domain/initiative-summary";
import { STAGE_GATE_KEYS } from "@/components/detail/initiative-labels";
import type { BusinessCaseTotals } from "@/modules/work/domain/business-case";
import type { StageGate, InitiativeStatus } from "@/modules/core/kernel/domain/types";

/** Compress the Epic's children-with-PIs into the derived Ist-Fenster (or null). */
function deriveIstWindow(
  children: { pi: { startDate: Date; endDate: Date } | null }[],
): { start: Date; end: Date } | null {
  let start: Date | null = null;
  let end: Date | null = null;
  for (const c of children) {
    if (!c.pi) continue;
    if (!start || c.pi.startDate < start) start = c.pi.startDate;
    if (!end || c.pi.endDate > end) end = c.pi.endDate;
  }
  return start && end ? { start, end } : null;
}

export interface EpicOverviewTabProps {
  epic: {
    id: string;
    title: string;
    description: string | null;
    stageGate: string;
    status: string;
    ownerId: string | null;
    updatedAt: Date;
    approvedAt: Date | null;
    plannedStartAt: Date | null;
    plannedEndAt: Date | null;
    valueStream: { id: string; name: string } | null;
    /** Direkte ART-Zuordnung (Pflichtfeld beim Anlegen). */
    artId: string | null;
    art: { id: string; name: string } | null;
    portfolioOverrideAt: Date | null;
    /** Die Primär-Solution — sie liefert den Horizont, solange am Epic keiner steht. */
    primarySolution: { id: string; horizon: string } | null;
    /** Der am Epic gesetzte Horizont; friert mit der Business-Case-Freigabe ein. */
    investmentHorizon: string | null;
    /** Der L3.1-Stempel — er entscheidet über das Einfrieren. */
    businessCaseApprovedAt: Date | null;
    /** Alle Solution-Zuordnungen (n:m). */
    solutionLinks: {
      solution: { id: string; name: string; horizon: string; deletedAt: Date | null };
    }[];
    businessCase: unknown;
    children: {
      status: string;
      pi: { startDate: Date; endDate: Date } | null;
    }[];
    needsSteeringAttention: boolean;
    stagedForBudgeting: boolean;
    /** Reifegrad-Modell v2: Stempel für die L5-Bestätigung. */
    impactRecognizedAt: Date | null;
    /** SAFe-Guardrails (Capacity): Solution/Epic/Enabler. */
    epicType: string | null;
  };
  canEdit: boolean;
  /**
   * Der Stand des Epics auf der Reifegrad-Achse (`currentGateStep`). Die Seite
   * reicht denselben Wert durch, der auch Kopf-Abzeichen, Leiter und
   * Reiterschiene speist — nachgerechnet würde er hier ungenau, weil
   * `implementationCompletedAt` in diesen Props fehlt.
   */
  currentGate?: string;
  /** `epic.portfolio_override` — zusätzliche Hürde für den eingefrorenen Horizont. */
  canOverrideHorizon: boolean;
  /**
   * Guardrail 3: Portfolio- oder ART-Epic — als **Scheibe**.
   *
   * War bis September 2026 `X | null | undefined`, und genau daran ist es
   * gescheitert: das Abzeichen stand hinter `classification &&`, das
   * Eingabefeld daneben ohne Bedingung, und `classification?.intended ?? null`
   * machte aus „Practice aus" ein „noch nicht eingeordnet". Jetzt eine
   * Bedingung für beides, vom Typ erzwungen. Siehe `Gated`.
   */
  classification: ClassificationSlice;
  /** Nutzen bei 100 % KPI-Zielerreichung — direkt aus den KPIs berechnet. */
  /**
   * Die im Read-Model bereits gebildeten Summen (`epic-detail.ts:heroTotals`).
   * Vorher rechnete diese Komponente sie ein zweites Mal aus denselben
   * Eingaben — numerisch gleich, aber ueber einen zweiten Pfad, den kein Test
   * gegen den ersten haelt.
   */
  totals: BusinessCaseTotals;
  /** Zuordenbare Solutions (im Value Stream des Epics) für die Zuordnung. */
  solutions: { id: string; name: string; horizon: string }[];
  /**
   * Der Owner-Block. Er stand bis zur Überarbeitung **nur** im Reifegrad-Reiter
   * — während das Tor-Kriterium „Epic Owner ist benannt" hierher verlinkte. Der
   * Deep-Link lief damit ins Leere.
   *
   * Seit September 2026 ist es umgekehrt vollständig: die Timeline hat die
   * Zuweisung abgegeben, hier ist die einzige Stelle, an der man den Owner setzt.
   */
  ownerSlot?: ReactNode;
  /** Realisierter Mehrwert; die Seite reicht ihn durch, weil sie die KPIs hält. */
  realizedSlot?: ReactNode;
  /** Strategische Beiträge (Ziel-Verknüpfungen). */
  goalsSlot?: ReactNode;
  /**
   * Der Budget-Stand. Er stand bis zur Überarbeitung im Kernfakten-Band des
   * Unterkopfs — also über jedem Reiter, statt bei den Zahlen, zu denen er
   * gehört. Beim Umzug hierher verlor er seinen **Zeitraum**, weil in die
   * `Stat`-Kachel nur eine Zeile passt; seit dem Panel „Budget" ist er wieder
   * vollständig. `null` = Modul aus oder kein Budget.
   */
  budgetStanding?: EpicBudgetStandingView | null;
  /** „Nicht begonnen" · „Gebunden" · „Verbraucht" — aus dem Budget-Port. */
  allocationState?: EpicAllocationStateView | null;
  /** Ab welchem Schritt dieses Epic überhaupt Geld halten darf. */
  fundable?: { may: boolean; firstStep: string };
}

/**
 * Eine Karte — **ein** Kartenstil für die ganze Fläche.
 *
 * Vorher standen hier vier nebeneinander: `rounded-lg border bg-card p-4
 * shadow-xs`, `rounded-lg border bg-muted/30 px-3 py-2`, ein gestrichelter
 * Kasten und gar kein Container.
 *
 * Das Bauteil stand hier lokal, weil es hier gebraucht wurde. Es wird anderswo
 * genauso gebraucht — die Budget-Flächen hatten **acht** Kartenstile — und
 * wohnt deshalb seit 2026-09-19 in `components/ui/section-card.tsx`. Hier
 * bleibt nur der Name und die Voreinstellung `grid gap-3`.
 */
function Panel({
  label,
  action,
  atGate = false,
  children,
}: {
  label: string;
  action?: ReactNode;
  /** Diese Kachel gehört zum Reifegrad, auf dem das Epic gerade steht. */
  atGate?: boolean;
  children: ReactNode;
}) {
  return (
    <SectionCard
      title={label}
      {...(action ? { action } : {})}
      atGate={atGate}
      contentClassName="grid gap-3"
    >
      {children}
    </SectionCard>
  );
}

/**
 * **Der Reifegrad, zu dem die Kacheln dieser Fläche gehören.**
 *
 * Auf L0 ist das Epic noch nicht eingeordnet: Typ und Horizont fehlen, Titel und
 * Wertstrom sind roh, Owner und Solution unbesetzt, Ziele unverknüpft. Genau das
 * tut man hier — und genau deshalb leuchten **Einordnung**, **Vorhaben
 * bearbeiten**, **Zuordnung** und **Strategische Beiträge**, sobald ein Epic
 * dort steht. Ab L1 führt die Reiterschiene weiter; die Kacheln sind dann still.
 *
 * **Das ist die zweite Reifegrad-Zuordnung im Haus** — die erste hängt als
 * `gate` an `EPIC_TABS` (`epic-detail-shell.tsx`) und beschriftet die Reiter.
 * Beide beschreiben denselben Weg auf verschiedenen Ebenen: die Schiene sagt
 * *welcher Reiter*, die Kacheln *welche Stelle darin*. Sie dürfen sich
 * ergänzen, aber nicht widersprechen — wer eine ändert, sieht bei der anderen
 * nach.
 *
 * Exportiert, weil „Strategische Beiträge" als Slot von der Seite kommt: die
 * Festlegung steht hier, nicht zweimal.
 */
export const OVERVIEW_PANELS_GATE = "L0";

/** Eine Zeile der Akte: Feldname links, Wert rechts. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] items-baseline gap-2 border-b border-border py-1.5 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

/** „Steht nichts da" — als Auskunft, nicht als Gedankenstrich. */
function None({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

/**
 * Der Reiter **Overview** — zwei Zonen statt eines Stapels.
 *
 * Links steht, was man **liest**: wo das Vorhaben steht, was es kostet und
 * bringt, was schon realisiert ist, worum es geht. Rechts, was man
 * **nachschlägt**: Einordnung, Zuordnung, Merker, Termin.
 *
 * Vorher lagen hier neun Blöcke voller Breite in einem `space-y-8` —
 * mehrere davon so flach, dass drei nebeneinander gepasst hätten. Und die
 * Wirtschaftlichkeit rechnete dieselben Summen noch einmal, die das
 * Kernfakten-Band im Unterkopf bereits zeigte.
 */
export function EpicOverviewTab({
  epic,
  canEdit,
  canOverrideHorizon,
  totals,
  solutions,
  classification,
  budgetStanding,
  allocationState = null,
  fundable = { may: true, firstStep: "" },
  currentGate,
  ownerSlot,
  realizedSlot,
  goalsSlot,
}: EpicOverviewTabProps) {
  const t = useTranslations();
  const completedChildren = epic.children.filter((c) => c.status === "completed").length;
  const amZug = currentGate === OVERVIEW_PANELS_GATE;

  const summary = buildInitiativeSummary({
    stageGate: epic.stageGate as StageGate,
    stageLabel: t(STAGE_GATE_KEYS[epic.stageGate] ?? epic.stageGate),
    status: epic.status as InitiativeStatus,
    childCount: epic.children.length,
    completedChildCount: completedChildren,
    approvedAt: epic.approvedAt,
    updatedAt: epic.updatedAt,
  });

  const hasFigures =
    totals.implementationCost > 0 || totals.recurringBenefit > 0 || totals.oneTimeBenefit > 0;
  const eur = (n: number): string => (n > 0 ? formatCompactEUR(n) : "—");
  const linkedSolutions = epic.solutionLinks.filter((l) => l.solution.deletedAt == null);

  /**
   * **Habe ich Geld, und fuer wann?** Der geltende Rahmen ist etwas anderes als
   * eine Zuteilung, die erst anlaeuft oder schon abgelaufen ist — deshalb tritt
   * dort der Zustandssatz an die Stelle des Betrags.
   */
  const budget: { value: string; hint: string } =
    budgetStanding == null || budgetStanding.state === "none"
      ? { value: "—", hint: "kein Budget" }
      : budgetStanding.state === "applies"
        ? {
            value: formatCompactEUR(budgetStanding.currentAmount),
            hint:
              budgetStanding.cycleCount > 1
                ? `gesamt ${formatCompactEUR(budgetStanding.totalAmount)} über ${budgetStanding.cycleCount} Zyklen`
                : "zugeteilt, gilt jetzt",
          }
        : {
            value: formatCompactEUR(budgetStanding.totalAmount),
            hint:
              budgetStanding.state === "upcoming" ? "zugeteilt, gilt später" : "Rahmen abgelaufen",
          };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
      {/* ── Die Erzählung ────────────────────────────────────────────── */}
      <div className="grid content-start gap-4">
        <Panel label={t("work.epic.woDasVorhabenSteht")}>
          <p className="text-sm">{summary}</p>
        </Panel>

        <Panel label={t("work.epic.wirtschaftlichkeit")}>
          {hasFigures ? (
            <StatStrip className="flex-col sm:flex-row sm:divide-x divide-y sm:divide-y-0">
              <Stat
                label={t("work.epic.kosten")}
                value={eur(totals.implementationCost)}
                delta={{ tone: "flat", text: "Σ Kostenscheiben" }}
              />
              <Stat
                label={t("work.epic.budget")}
                value={budget.value}
                delta={{ tone: "flat", text: budget.hint }}
              />
              <Stat
                label={t("work.epic.nutzenPA")}
                value={eur(totals.recurringBenefit)}
                valueClassName={
                  totals.recurringBenefit > 0 ? "text-emerald-600 dark:text-emerald-400" : ""
                }
                delta={{ tone: "flat", text: "wiederkehrend" }}
              />
              <Stat
                label={t("work.epic.einmalig")}
                value={eur(totals.oneTimeBenefit)}
                delta={{ tone: "flat", text: "einmaliger Effekt" }}
              />
            </StatStrip>
          ) : (
            <EmptyState
              className="p-5"
              title={t("work.epic.nochKeineZahlen")}
              body={t("work.epic.kostenUndNutzenEntstehen")}
            />
          )}
        </Panel>

        {realizedSlot}

        {/*
          Ohne Bearbeitungsrecht heisst die Kachel „Beschreibung" und ist reine
          Anzeige — eine Aufforderung an eine Fläche, auf der man nichts tun
          kann, wäre eine Lüge.
        */}
        <Panel label={canEdit ? "Vorhaben bearbeiten" : "Beschreibung"} atGate={amZug && canEdit}>
          {canEdit ? (
            <EpicEditForm
              id={epic.id}
              currentTitle={epic.title}
              currentDescription={epic.description ?? ""}
              currentValueStreamId={epic.valueStream?.id ?? ""}
              currentArtId={epic.artId ?? ""}
              currentArtName={epic.art?.name ?? null}
            />
          ) : (
            <p className="text-sm">
              {epic.description ?? <None>{t("work.epic.keineBeschreibung")}</None>}
            </p>
          )}
        </Panel>

        {goalsSlot}
      </div>

      {/* ── Die Akte ─────────────────────────────────────────────────── */}
      <div className="grid content-start gap-4">
        {/**
         * **Einordnung — ein Block, nicht zwei.** „Einordnung" (Portfolio- gegen
         * ART-Epic) stand bis zur Überarbeitung direkt über „Portfolio-
         * Klassifikation" (Typ und Horizont): zwei fast gleich benannte
         * Abschnitte, die dieselbe Frage beantworten — wohin dieses Vorhaben
         * gehört. Die Klasse ist das Ergebnis, Typ und Horizont sind die
         * Eingaben; sie stehen jetzt untereinander in einer Karte.
         */}
        <Panel label={t("work.epic.einordnung")} atGate={amZug}>
          {classification.disabled ? null : (
            <EpicClassBadge
              classification={{
                epicClass: classification.epicClass,
                cost: classification.cost,
                threshold: classification.threshold,
                overridden: classification.overridden,
              }}
              source={classification.source as GuardrailTargetsSource}
              fundingGap={classification.fundingGap}
              intended={classification.intended}
            />
          )}
          <EpicClassificationForm
            epicId={epic.id}
            epicType={epic.epicType}
            ownHorizon={epic.investmentHorizon}
            solutionHorizon={epic.primarySolution?.horizon ?? null}
            businessCaseApprovedAtIso={epic.businessCaseApprovedAt?.toISOString() ?? null}
            canEdit={canEdit}
            canOverrideHorizon={canOverrideHorizon}
            classification={
              classification.disabled
                ? { disabled: true }
                : {
                    disabled: false,
                    intended: classification.intended,
                    derived: classification.epicClass,
                    threshold: classification.threshold,
                  }
            }
            portfolioOverrideAtIso={epic.portfolioOverrideAt?.toISOString() ?? null}
            valueStreamId={epic.valueStream?.id ?? null}
          />
        </Panel>

        <Panel label={t("work.epic.zuordnung")} atGate={amZug}>
          {/**
           * Der Owner steht **über** der Akte, nicht in einer ihrer Wertzellen:
           * er bringt einen Personen-Picker mit, und der kollabiert in einer
           * Spalte, die nach dem Feldnamen noch gut zwei Zentimeter übrig hat.
           */}
          {/* `data-tour`: Ziel der Wiki-Station „Den Epic Owner benennen" — seit
              die Timeline ihre Zuweisung abgegeben hat, ist das hier die einzige. */}
          <div className="grid gap-1.5" data-tour="epic-owner-field">
            <p className="text-xs text-muted-foreground">{t("work.epic.owner")}</p>
            {ownerSlot ?? <None>{t("work.epic.nichtZugewiesen")}</None>}
          </div>
          <dl className="grid border-t border-border pt-1">
            <Row label={t("work.epic.wertstrom")}>
              {epic.valueStream?.name ?? <None>{t("work.epic.keinerZugeordnet")}</None>}
            </Row>
            <Row label={t("work.epic.solution")}>
              {linkedSolutions.length > 0 ? (
                <span>
                  {epic.primarySolution
                    ? (linkedSolutions.find((l) => l.solution.id === epic.primarySolution?.id)
                        ?.solution.name ?? linkedSolutions[0]!.solution.name)
                    : linkedSolutions[0]!.solution.name}
                  {epic.primarySolution && (
                    <span className="text-muted-foreground">{t("work.epic.primaer")}</span>
                  )}
                  {linkedSolutions.length > 1 && (
                    <span className="text-muted-foreground"> +{linkedSolutions.length - 1}</span>
                  )}
                </span>
              ) : (
                <None>keine — ein R&amp;D-Vorhaben hat keine</None>
              )}
            </Row>
          </dl>
          <EpicSolutionsSection
            epicId={epic.id}
            solutions={solutions}
            linkedIds={linkedSolutions.map((l) => l.solution.id)}
            primaryId={epic.primarySolution?.id ?? null}
            canEdit={canEdit}
            hasArt={epic.artId != null}
          />
        </Panel>

        <Panel label={t("work.epic.governance")}>
          {canEdit ? (
            <EpicGovernanceFlags
              epicId={epic.id}
              needsSteeringAttention={epic.needsSteeringAttention}
              stagedForBudgeting={epic.stagedForBudgeting}
            />
          ) : epic.needsSteeringAttention || epic.stagedForBudgeting ? (
            <ul className="flex flex-wrap gap-1.5">
              {epic.needsSteeringAttention && (
                <li className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  {t("work.epic.steeringMeeting")}
                </li>
              )}
              {epic.stagedForBudgeting && (
                <li className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  {t("work.epic.budgetMeeting")}
                </li>
              )}
            </ul>
          ) : (
            <EmptyState
              className="p-5"
              title={t("work.epic.keineMarkierung")}
              body={t("work.epic.wederFuersSteeringNoch")}
            />
          )}
        </Panel>

        {/* Budget und Zeitfenster stehen absichtlich nebeneinander: beide
            heissen fast gleich und meinen Verschiedenes — die Geltung des
            Geldes und das Lieferfenster. Die Frage „reicht mein Budget ueber
            meine Umsetzung?" laesst sich nur so beantworten. */}
        <Panel label={t("work.epic.budget")}>
          <EpicBudgetPanel
            standing={budgetStanding ?? null}
            allocationState={allocationState}
            fundable={fundable}
          />
        </Panel>

        <Panel label={t("work.epic.zeitfenster")}>
          <EpicPlannedWindowForm
            epicId={epic.id}
            plannedStartAt={epic.plannedStartAt}
            plannedEndAt={epic.plannedEndAt}
            derived={deriveIstWindow(epic.children)}
            canEdit={canEdit}
          />
        </Panel>
      </div>
    </div>
  );
}
