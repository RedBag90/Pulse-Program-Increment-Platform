"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useActionState, useState } from "react";
import { Lock, Lightbulb, ArrowRight, ChevronRight, AlertTriangle } from "lucide-react";
import { saveBusinessCaseAction } from "@/modules/work/features/portfolio/actions/business-case";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { InfoHint } from "@/components/ui/info-hint";
import { Link } from "@/i18n/navigation";
import {
  costSliceMonths,
  type BusinessCaseFields,
  type BusinessCaseVersion,
} from "@/modules/work/domain/business-case";
import type { EpicCascadeContribution } from "@/modules/core/goals/domain/goals-rollup";
import {
  buildCascadeTree,
  type CascadeTreeNode,
} from "@/modules/work/features/portfolio/lib/cascade-tree";
import {
  BUSINESS_CASE_FIELD_HELP,
  type HelpedBusinessCaseField,
} from "@/modules/work/features/portfolio/components/business-case-help";

interface BusinessCaseEditorProps {
  epicId: string;
  current: BusinessCaseFields;
  history: BusinessCaseVersion[];
  /** When true the form is rendered for review only — fields are disabled and
   *  the save button is hidden. Used by reviewer roles (e.g. Portfolio Manager). */
  readOnly?: boolean;
  /** Why the form is locked (the current approval phase) — shown as a hint. */
  lockReason?: string;
  /** KPI-Namen aus dem KPI-Tab. Ersetzen das frueher freie Leading-
   *  Indicators-Feld: Single-Source-of-Truth ist der KPI-Tab. */
  kpiNames?: string[];
  /** Kaskaden-Beitrag je Link, Ebene für Ebene (verknüpftes Ziel → Top-Ziel). */
  cascade?: EpicCascadeContribution[];
}

const fmtUnit = (n: number): string => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

function parseNum(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Cost slice amounts as form strings — defaults to two 6-month periods. */
function initialSlices(slices: BusinessCaseFields["costSlices"]): string[] {
  if (slices && slices.length > 0) {
    return slices.map((s) => (s.amount != null ? String(s.amount) : ""));
  }
  return ["", ""];
}

export function BusinessCaseEditor({
  epicId,
  current,
  history,
  readOnly = false,
  lockReason,
  kpiNames = [],
  cascade = [],
}: BusinessCaseEditorProps) {
  const t = useTranslations();
  const [state, action, isPending] = useActionState(saveBusinessCaseAction, {});
  const [slices, setSlices] = useState<string[]>(() => initialSlices(current.costSlices));

  const costTotal = slices.reduce((sum, v) => sum + (parseNum(v) ?? 0), 0);

  return (
    <div className="space-y-6">
      {readOnly && lockReason && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-surface p-3 text-sm text-warning">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{lockReason}</span>
        </div>
      )}
      <form action={action} className="@container space-y-6">
        <input type="hidden" name="epicId" value={epicId} />

        <fieldset disabled={readOnly} className="space-y-6 border-0 p-0 m-0 min-w-0">
          {/**
           * **Ein Raster für alle drei Zeilen, mit demselben Umbruchpunkt.**
           *
           * Vorher standen hier drei verschiedene Breiten-Regeln: die beiden
           * oberen Felder über die volle Breite, darunter ein Paar, das bei
           * `@md` auf zwei Spalten umbrach, und darunter ein Trio, das erst
           * bei `@lg` auf drei umbrach. Die Raster teilten keine einzige
           * Spaltenkante — nichts stand untereinander, was zusammengehört.
           *
           * Jetzt dreimal `@lg:grid-cols-3`: links jeweils das lange Feld über
           * zwei Spalten (so breit wie *In scope* + *Out of scope* zusammen),
           * rechts das kurze über eine (so breit wie *What you need to believe
           * in*).
           *
           * `items-start`, weil „Key stakeholders" ein einzeiliges Feld neben
           * einem vierzeiligen ist: ohne die Angabe zöge das Raster es auf
           * dieselbe Höhe und liesse ein leeres Kästchen stehen.
           *
           * Container-Queries, nicht Viewport: das `@container` sitzt am
           * `<form>`, weil die Fläche in einer Spalte stehen kann.
           */}
          <div className="grid items-start gap-4 @lg:grid-cols-3">
            <div className="@lg:col-span-2">
              <FieldLabel htmlFor="bc-description" field="initiativeDescription">
                {t("work.epic.initiativeDescription")}
              </FieldLabel>
              <Textarea
                id="bc-description"
                name="initiativeDescription"
                rows={4}
                defaultValue={current.initiativeDescription}
                placeholder={BUSINESS_CASE_FIELD_HELP.initiativeDescription.placeholder}
              />
            </div>
            <div>
              <FieldLabel htmlFor="bc-stakeholders" field="keyStakeholders">
                {t("work.epic.keyStakeholders")}
              </FieldLabel>
              <Input
                id="bc-stakeholders"
                name="keyStakeholders"
                defaultValue={current.keyStakeholders}
                placeholder={BUSINESS_CASE_FIELD_HELP.keyStakeholders.placeholder}
              />
            </div>
          </div>

          <div className="grid items-start gap-4 @lg:grid-cols-3">
            <div className="@lg:col-span-2">
              <FieldLabel htmlFor="bc-outcome" field="businessOutcomeHypothesis">
                {t("work.epic.businessOutcomeHypothesis")}
              </FieldLabel>
              <Textarea
                id="bc-outcome"
                name="businessOutcomeHypothesis"
                rows={4}
                defaultValue={current.businessOutcomeHypothesis}
                placeholder={BUSINESS_CASE_FIELD_HELP.businessOutcomeHypothesis.placeholder}
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <label className="block text-sm font-medium">
                  {t("work.epic.leadingIndicators")}
                </label>
                <Link
                  href={`/portfolio/epics/${epicId}?tab=kpis` as never}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {t("work.epic.inKpiUndNutzenPflegen")} <ArrowRight className="size-3" />
                </Link>
              </div>
              {/* Bestandswert mitsenden, damit der Full-Replace-Save den
                  alten Freitext nicht ueberschreibt (Migration koennte
                  separat folgen). */}
              <input
                type="hidden"
                name="leadingIndicators"
                value={current.leadingIndicators ?? ""}
              />
              {kpiNames.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                  {t("work.epic.nochKeineKpiErfasst")}
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {kpiNames.map((name) => (
                    <li
                      key={name}
                      className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid gap-4 @lg:grid-cols-3">
            <div>
              <FieldLabel htmlFor="bc-inscope" field="inScope">
                {t("work.epic.inScope")}
              </FieldLabel>
              <Textarea
                id="bc-inscope"
                name="inScope"
                rows={3}
                defaultValue={current.inScope}
                placeholder={BUSINESS_CASE_FIELD_HELP.inScope.placeholder}
              />
            </div>
            <div>
              <FieldLabel htmlFor="bc-outscope" field="outOfScope">
                {t("work.epic.outOfScope")}
              </FieldLabel>
              <Textarea
                id="bc-outscope"
                name="outOfScope"
                rows={3}
                defaultValue={current.outOfScope}
                placeholder={BUSINESS_CASE_FIELD_HELP.outOfScope.placeholder}
              />
            </div>
            <div>
              <FieldLabel htmlFor="bc-believe" field="whatYouNeedToBelieve">
                {t("work.epic.whatYouNeedTo")}
              </FieldLabel>
              <Textarea
                id="bc-believe"
                name="whatYouNeedToBelieve"
                rows={3}
                defaultValue={current.whatYouNeedToBelieve}
                placeholder={BUSINESS_CASE_FIELD_HELP.whatYouNeedToBelieve.placeholder}
              />
            </div>
          </div>

          {/* Implementation cost — 6-month demand calculation */}
          <section className="rounded-lg bg-card p-4 shadow-card">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-2">
                <div>
                  <SectionLabel>
                    {t("work.epic.implementierungskostenBedarfskalkulation")}
                  </SectionLabel>
                  <p className="text-xs text-muted-foreground">
                    {t("work.epic.geschaetzterKostenbedarfJeMonats")}
                  </p>
                </div>

                <input type="hidden" name="costSliceCount" value={slices.length} />

                <div className="space-y-2">
                  {slices.map((amount, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm text-muted-foreground @sm:w-32">
                        {t("work.businessCase.kostenscheibe", costSliceMonths(i))}
                      </span>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        name={`costSlice_${i}`}
                        aria-label={t("work.businessCase.kostenscheibe", costSliceMonths(i))}
                        value={amount}
                        onChange={(e) =>
                          setSlices((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                        }
                        placeholder="0"
                        className="max-w-[8rem] @sm:max-w-[12rem]"
                      />
                      <button
                        type="button"
                        onClick={() => setSlices((prev) => prev.filter((_, j) => j !== i))}
                        disabled={slices.length <= 1}
                        className="text-sm text-muted-foreground hover:text-destructive disabled:opacity-40"
                      >
                        {t("work.epic.entfernen")}
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setSlices((prev) => [...prev, ""])}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t("work.epic.periodeHinzufuegen")}
                </button>

                <div className="flex items-center gap-3 border-t pt-2 text-sm font-medium">
                  <span className="w-24 shrink-0 @sm:w-32">{t("work.epic.gesamtkosten")}</span>
                  <span>{costTotal.toLocaleString("de-DE")}</span>
                </div>
              </div>

              <aside className="self-start rounded-lg bg-muted/30 p-3 text-sm shadow-card">
                <div className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-2">
                    <p className="text-xs leading-snug text-muted-foreground">
                      {t("work.epic.zurBesserenKonkretisierungBrich")}
                    </p>
                    <Link
                      href={`/portfolio/epics/${epicId}?tab=breakdown` as never}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      {t("work.epic.zuDenDeliverables")} <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          {/* Nutzen: zwei Kacheln (einmalig / wiederkehrend), je Effekt in Top-Ziel-Einheit
              + Explorer-Baum, der die Kaskade Ebene für Ebene bis zu den KPIs aufschlüsselt. */}
          <section className="space-y-4 rounded-lg bg-card p-4 shadow-card">
            <div>
              <SectionLabel>{t("work.epic.nutzen")}</SectionLabel>
              <p className="text-xs text-muted-foreground">{t("work.epic.wasDiesesEpicUeber")}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <EffectTile
                title={t("work.epic.einmaligerEffekt")}
                epicId={epicId}
                cascade={cascade}
                kind="one_time"
              />
              <EffectTile
                title={t("work.epic.wiederkehrenderEffekt")}
                epicId={epicId}
                cascade={cascade}
                kind="recurring"
              />
            </div>
          </section>

          <div>
            <FieldLabel htmlFor="bc-customers" field="customersAffected">
              {t("work.epic.whichInternalAndOr")}
            </FieldLabel>
            <Textarea
              id="bc-customers"
              name="customersAffected"
              rows={3}
              defaultValue={current.customersAffected}
              placeholder={BUSINESS_CASE_FIELD_HELP.customersAffected.placeholder}
            />
          </div>

          <div>
            <FieldLabel htmlFor="bc-impact" field="impactOnSolutions">
              {t("work.epic.whatIsThePotential")}
            </FieldLabel>
            <Textarea
              id="bc-impact"
              name="impactOnSolutions"
              rows={3}
              defaultValue={current.impactOnSolutions}
              placeholder={BUSINESS_CASE_FIELD_HELP.impactOnSolutions.placeholder}
            />
          </div>

          <div>
            <FieldLabel htmlFor="bc-summary" field="analysisSummary">
              {t("work.epic.analysisSummary")}
            </FieldLabel>
            <Textarea
              id="bc-summary"
              name="analysisSummary"
              rows={4}
              defaultValue={current.analysisSummary}
              placeholder={BUSINESS_CASE_FIELD_HELP.analysisSummary.placeholder}
            />
          </div>

          {/* Es gab einmal einen Reiter „Freigaben"; seit dem Umbau laufen sie
              ueber die Reifegrad-Karte und „Meine Tasks". Der alte Verweis
              zeigte ins Leere. */}
          <div className="rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
            {t.rich("work.epic.freigabenLaufenUeberReifegradKarte", {
              card: (c) => <span className="font-medium text-foreground">{c}</span>,
              link: (c) => (
                <Link
                  href={"/my-tasks" as never}
                  className="font-medium text-primary hover:underline"
                >
                  {c}
                </Link>
              ),
            })}
          </div>
        </fieldset>

        {state.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-emerald-600 dark:text-emerald-400 text-sm">
            {t("work.epic.businessCaseGespeichert")}
          </p>
        )}

        {!readOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? t("common.ui.speichernLaeuft") : t("work.epic.businessCaseSpeichern")}
            </Button>
          </div>
        )}
      </form>

      {history.length > 0 && (
        <details className="rounded-lg bg-muted/50 p-3 shadow-card">
          <summary className="cursor-pointer text-sm font-medium text-foreground/80">
            {t("work.epic.versionshistorieAnzahl", { count: history.length })}
          </summary>
          <div className="mt-3 space-y-2">
            {history.map((v, i) => (
              <p key={i} className="text-xs text-muted-foreground/60">
                {new Date(v.savedAt).toLocaleString("de-DE")}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * Eine Nutzen-Kachel (einmalig / wiederkehrend): der aggregierte Effekt je Top-Ziel
 * in dessen Einheit als große Kennzahl, darunter der Explorer-Baum, der die Kaskade
 * Ebene für Ebene bis zu den treibenden KPIs aufschlüsselt.
 */
function EffectTile({
  title,
  epicId,
  cascade,
  kind,
}: {
  title: string;
  epicId: string;
  cascade: EpicCascadeContribution[];
  kind: string;
}) {
  const t = useTranslations();
  const roots = buildCascadeTree(cascade.filter((c) => c.impactKind === kind));
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-3 rounded-lg bg-muted/10 p-3 shadow-card">
      <SectionLabel>{title}</SectionLabel>
      {roots.length === 0 ? (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-2">
            <p className="leading-snug">
              {t("work.epic.keineKaskade", { art: title.toLowerCase() })}
            </p>
            <Link
              href={`/portfolio/epics/${epicId}?tab=kpis` as never}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {t("work.epic.zuDenKpis")} <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {roots.map((root) => (
            <div key={root.goalId} className="space-y-1.5">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-light leading-none tabular-nums">
                    +{fmtUnit(root.planned)}
                  </span>
                  <span className="text-sm text-muted-foreground">{root.unit ?? ""}</span>
                  {root.brokenHere && (
                    <AlertTriangle
                      className="size-3.5 text-amber-600 dark:text-amber-400"
                      aria-label={t("work.epic.einheitenUmrechnungFehlt")}
                    />
                  )}
                </div>
                <p className="text-xs font-medium">{root.name}</p>
              </div>
              {root.children.length > 0 && (
                <CascadeRows
                  nodes={root.children}
                  depth={0}
                  pathPrefix={root.goalId}
                  collapsed={collapsed}
                  toggle={toggle}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Rekursive Explorer-Zeilen: Einrückung nach Tiefe, ChevronRight zum Auf-/Zuklappen. */
function CascadeRows({
  nodes,
  depth,
  pathPrefix,
  collapsed,
  toggle,
}: {
  nodes: CascadeTreeNode[];
  depth: number;
  pathPrefix: string;
  collapsed: Set<string>;
  toggle: (key: string) => void;
}) {
  const t = useTranslations();
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => {
        const path = `${pathPrefix}/${node.goalId}`;
        const hasChildren = node.children.length > 0;
        const isCollapsed = collapsed.has(path);
        return (
          <li key={path}>
            <div
              className="flex items-center gap-1 text-xs"
              style={{ paddingLeft: `${depth * 14}px` }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggle(path)}
                  className="flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
                  aria-label={isCollapsed ? "Aufklappen" : "Zuklappen"}
                >
                  <ChevronRight
                    className={`size-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                  />
                </button>
              ) : (
                <span className="size-4 shrink-0" />
              )}
              <span className="font-medium">{node.name}:</span>
              <span className="tabular-nums">
                +{fmtUnit(node.planned)} {node.unit ?? ""}
              </span>
              {node.kpiNames.length > 0 && (
                <span className="text-muted-foreground">
                  {t("work.epic.kpiNamenMitPunkt", { names: node.kpiNames.join(", ") })}
                </span>
              )}
              {node.brokenHere && (
                <AlertTriangle
                  className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-label={t("work.epic.abHierKeineEinheiten")}
                />
              )}
            </div>
            {hasChildren && !isCollapsed && (
              <CascadeRows
                nodes={node.children}
                depth={depth + 1}
                pathPrefix={path}
                collapsed={collapsed}
                toggle={toggle}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Beschriftung eines Business-Case-Feldes samt ⓘ.
 *
 * Die Frage kommt aus `BUSINESS_CASE_FIELD_HELP`, damit Beschriftung und
 * Erklärung nicht an zwei Orten gepflegt werden — und damit der Compiler
 * meckert, wenn ein Feld ohne Erklärung dazukommt.
 */
function FieldLabel({
  htmlFor,
  field,
  children,
}: {
  htmlFor: string;
  field: HelpedBusinessCaseField;
  children: ReactNode;
}) {
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {children}
      </label>
      <InfoHint text={BUSINESS_CASE_FIELD_HELP[field].question} />
    </div>
  );
}
