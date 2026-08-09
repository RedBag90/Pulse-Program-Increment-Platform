"use client";

import { useActionState, useState } from "react";
import { Lock, Lightbulb, ArrowRight, ChevronRight, AlertTriangle } from "lucide-react";
import { saveBusinessCaseAction } from "@/features/portfolio/actions/business-case";
import { submitEpicBusinessCaseAction } from "@/features/portfolio/actions/epic-approval";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  costSliceLabel,
  type BusinessCaseFields,
  type BusinessCaseVersion,
} from "@/domain/business-case";
import type { EpicCascadeContribution } from "@/modules/core/goals/domain/goals-rollup";
import { buildCascadeTree, type CascadeTreeNode } from "@/features/portfolio/lib/cascade-tree";

interface BusinessCaseEditorProps {
  epicId: string;
  current: BusinessCaseFields;
  history: BusinessCaseVersion[];
  /** When true the form is rendered for review only — fields are disabled and
   *  the save button is hidden. Used by reviewer roles (e.g. Portfolio Manager). */
  readOnly?: boolean;
  /** Why the form is locked (the current approval phase) — shown as a hint. */
  lockReason?: string;
  /** When true, renders the "Fertig zum Einreichen"-Checkbox + Submit-Button
   *  next to the save button. Aktiv nur in `approvalPhase = business_case`
   *  und mit `epic.businesscase.submit`-Capability — Sichtbarkeistlogik
   *  liegt auf der Page. */
  canSubmit?: boolean;
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
  canSubmit = false,
  kpiNames = [],
  cascade = [],
}: BusinessCaseEditorProps) {
  const [state, action, isPending] = useActionState(saveBusinessCaseAction, {});
  const [submitState, submitAction, submitPending] = useActionState(
    submitEpicBusinessCaseAction,
    {},
  );
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const submitDisabled = !readyToSubmit || submitPending;
  const [slices, setSlices] = useState<string[]>(() => initialSlices(current.costSlices));

  const costTotal = slices.reduce((sum, v) => sum + (parseNum(v) ?? 0), 0);

  return (
    <div className="space-y-6">
      {readOnly && lockReason && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{lockReason}</span>
        </div>
      )}
      <form action={action} className="space-y-6">
        <input type="hidden" name="epicId" value={epicId} />

        <fieldset disabled={readOnly} className="space-y-6 border-0 p-0 m-0 min-w-0">
          <div>
            <label htmlFor="bc-stakeholders" className="block text-sm font-medium mb-1">
              Key Stakeholders
            </label>
            <Input
              id="bc-stakeholders"
              name="keyStakeholders"
              defaultValue={current.keyStakeholders}
            />
          </div>

          <div>
            <label htmlFor="bc-description" className="block text-sm font-medium mb-1">
              Initiative Description
            </label>
            <Textarea
              id="bc-description"
              name="initiativeDescription"
              rows={4}
              defaultValue={current.initiativeDescription}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bc-outcome" className="block text-sm font-medium mb-1">
                Business Outcome Hypothesis
              </label>
              <Textarea
                id="bc-outcome"
                name="businessOutcomeHypothesis"
                rows={4}
                defaultValue={current.businessOutcomeHypothesis}
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <label className="block text-sm font-medium">Leading Indicators</label>
                <a
                  href="?tab=kpis"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Im KPI-Tab pflegen <ArrowRight className="size-3" />
                </a>
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
                <p className="rounded border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                  Noch keine KPI erfasst — pflege sie im KPI-Tab.
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

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="bc-inscope" className="block text-sm font-medium mb-1">
                In Scope
              </label>
              <Textarea id="bc-inscope" name="inScope" rows={3} defaultValue={current.inScope} />
            </div>
            <div>
              <label htmlFor="bc-outscope" className="block text-sm font-medium mb-1">
                Out of Scope
              </label>
              <Textarea
                id="bc-outscope"
                name="outOfScope"
                rows={3}
                defaultValue={current.outOfScope}
              />
            </div>
            <div>
              <label htmlFor="bc-believe" className="block text-sm font-medium mb-1">
                What you need to believe in
              </label>
              <Textarea
                id="bc-believe"
                name="whatYouNeedToBelieve"
                rows={3}
                defaultValue={current.whatYouNeedToBelieve}
              />
            </div>
          </div>

          {/* Implementation cost — 6-month demand calculation */}
          <section className="rounded-lg border p-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-2">
                <div>
                  <p className="text-sm font-medium">Implementierungskosten — Bedarfskalkulation</p>
                  <p className="text-xs text-muted-foreground">
                    Geschätzter Kostenbedarf je 6-Monats-Periode.
                  </p>
                </div>

                <input type="hidden" name="costSliceCount" value={slices.length} />

                <div className="space-y-2">
                  {slices.map((amount, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-sm text-muted-foreground">
                        {costSliceLabel(i)}
                      </span>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        name={`costSlice_${i}`}
                        aria-label={costSliceLabel(i)}
                        value={amount}
                        onChange={(e) =>
                          setSlices((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                        }
                        placeholder="0"
                        className="max-w-[12rem]"
                      />
                      <button
                        type="button"
                        onClick={() => setSlices((prev) => prev.filter((_, j) => j !== i))}
                        disabled={slices.length <= 1}
                        className="text-sm text-muted-foreground hover:text-destructive disabled:opacity-40"
                      >
                        Entfernen
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setSlices((prev) => [...prev, ""])}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  + Periode hinzufügen
                </button>

                <div className="flex items-center gap-3 border-t pt-2 text-sm font-medium">
                  <span className="w-32 shrink-0">Gesamtkosten</span>
                  <span>{costTotal.toLocaleString("de-DE")}</span>
                </div>
              </div>

              <aside className="self-start rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="space-y-2">
                    <p className="text-xs leading-snug text-muted-foreground">
                      Zur besseren Konkretisierung brich das Epic in Deliverables herunter —
                      Features mit Aufwand machen die Kostenkalkulation belastbarer.
                    </p>
                    <Link
                      href={`/portfolio/epics/${epicId}?tab=breakdown` as never}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Zu den Deliverables <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          {/* Nutzen: zwei Kacheln (einmalig / wiederkehrend), je Effekt in Top-Ziel-Einheit
              + Explorer-Baum, der die Kaskade Ebene für Ebene bis zu den KPIs aufschlüsselt. */}
          <section className="space-y-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Nutzen</p>
              <p className="text-xs text-muted-foreground">
                Was dieses Epic über seine Erfolgs-KPIs beiträgt — in der Einheit des Top-Ziels,
                über die Ziel-Kaskade hochgerechnet, getrennt nach einmalig und wiederkehrend.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <EffectTile
                title="Einmaliger Effekt"
                epicId={epicId}
                cascade={cascade}
                kind="one_time"
              />
              <EffectTile
                title="Wiederkehrender Effekt"
                epicId={epicId}
                cascade={cascade}
                kind="recurring"
              />
            </div>
          </section>

          <div>
            <label htmlFor="bc-customers" className="block text-sm font-medium mb-1">
              Which internal and/or external customers are affected, and how?
            </label>
            <Textarea
              id="bc-customers"
              name="customersAffected"
              rows={3}
              defaultValue={current.customersAffected}
            />
          </div>

          <div>
            <label htmlFor="bc-impact" className="block text-sm font-medium mb-1">
              What is the potential impact on solutions, programs and services?
            </label>
            <Textarea
              id="bc-impact"
              name="impactOnSolutions"
              rows={3}
              defaultValue={current.impactOnSolutions}
            />
          </div>

          <div>
            <label htmlFor="bc-summary" className="block text-sm font-medium mb-1">
              Analysis Summary
            </label>
            <Textarea
              id="bc-summary"
              name="analysisSummary"
              rows={4}
              defaultValue={current.analysisSummary}
            />
          </div>

          <div className="rounded border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
            Business-Case-Freigaben werden im Tab <span className="font-medium">„Freigaben"</span>{" "}
            verwaltet (Mehrparteien-Workflow mit Status, Genehmiger und Datum).
          </div>
        </fieldset>

        {state.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-emerald-600 text-sm">
            Business Case gespeichert.
          </p>
        )}

        {!readOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Speichern…" : "Business Case speichern"}
            </Button>
          </div>
        )}
      </form>

      {canSubmit && !readOnly && (
        // Separate form, damit Submit (epic.businesscase.submit) nicht
        // versehentlich die Save-Felder mitschickt. Auf gleicher Hoehe
        // wie der Save-Knopf, rechts ausgerichtet — analog zur Hypothese.
        <form
          action={submitAction}
          className="flex flex-wrap items-center justify-end gap-3 border-t pt-4"
        >
          <input type="hidden" name="epicId" value={epicId} />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={readyToSubmit}
              onChange={(e) => setReadyToSubmit(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Fertig zum Einreichen
          </label>
          <Button type="submit" disabled={submitDisabled}>
            {submitPending ? "Einreichen…" : "Business Case einreichen"}
          </Button>
          {submitState.error && (
            <p role="alert" className="w-full text-right text-sm text-destructive">
              {submitState.error}
            </p>
          )}
          {submitState.success && (
            <p role="status" className="w-full text-right text-sm text-emerald-600">
              Business Case eingereicht — die Stakeholder entscheiden jetzt.
            </p>
          )}
        </form>
      )}

      {history.length > 0 && (
        <details className="rounded-lg border bg-muted/50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground/80">
            Versionshistorie ({history.length})
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
    <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {roots.length === 0 ? (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="space-y-2">
            <p className="leading-snug">
              Kein {title.toLowerCase()} — verknüpfe im Tab „KPIs" ein Ziel (Erfolgs-KPI) und pflege
              die Einheiten-Umrechnung je Ziel-Ebene, damit die Kaskade bis zum Top-Ziel rechnet.
            </p>
            <Link
              href={`/portfolio/epics/${epicId}?tab=kpis` as never}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Zu den KPIs <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {roots.map((root) => (
            <div key={root.goalId} className="space-y-1.5">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tabular-nums">
                    +{fmtUnit(root.planned)}
                  </span>
                  <span className="text-sm text-muted-foreground">{root.unit ?? ""}</span>
                  {root.brokenHere && (
                    <AlertTriangle
                      className="size-3.5 text-amber-600"
                      aria-label="Einheiten-Umrechnung fehlt."
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
                  className="flex size-4 shrink-0 items-center justify-center rounded hover:bg-muted"
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
                <span className="text-muted-foreground">· KPI: {node.kpiNames.join(", ")}</span>
              )}
              {node.brokenHere && (
                <AlertTriangle
                  className="size-3.5 shrink-0 text-amber-600"
                  aria-label="Ab hier keine Einheiten-Umrechnung hinterlegt — Beitrag bricht ab."
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
