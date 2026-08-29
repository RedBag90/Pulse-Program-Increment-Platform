"use client";

import { useActionState, startTransition, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { goalNodeTimeframeLabel } from "@/modules/core/goals/features/lib/goal-node-view";
import type {
  ZieleModel,
  RelatedEpic,
  RelatedWorkItem,
  ScopeRef,
  GoalNode,
  GoalCustomFieldEntry,
} from "@/modules/core/goals/server/views/ziele-view";
import {
  createGoalNodeAction,
  updateGoalNodeAction,
  deleteObjectiveAction,
  linkEpicToGoalAction,
  unlinkEpicFromGoalAction,
  addGoalRelatedWorkAction,
  removeGoalRelatedWorkAction,
  linkGoalValueStreamAction,
  unlinkGoalValueStreamAction,
  linkGoalArtAction,
  unlinkGoalArtAction,
  setGoalCustomFieldValueAction,
  reparentGoalNodeAction,
  setGoalRollupInclusionAction,
} from "@/modules/core/goals/features/actions/ziele";
import { GoalDetailPanel } from "@/modules/core/goals/features/components/goal-status/goal-detail-panel";
import { EntitySelect } from "@/features/create/entity-select";
import { GoalPeriodField } from "@/modules/core/goals/features/components/goal-period-field";
import { UserPicker } from "@/components/detail/user-picker";
import { LinkList, type LinkChip } from "@/modules/core/goals/features/components/link-list";
import {
  RelatedWorkSearch,
  type RelatedWorkResult,
} from "@/modules/core/goals/features/components/related-work-search";
import { formatMetricValue } from "@/modules/core/goals/domain/goal-metric";

/**
 * Ziele-Edit-Drawer — flach 2-Ebenen (Refactor §Hierarchie-Vereinfachung).
 *
 * Zwei Entitaeten in der UI: **Theme** (= Objective im Schema) und
 * **Key Result**. Vision + alter Strategic-Theme + Theme-Epic-Link
 * sind raus. URL-State:
 *
 *   ?entity=goal&id=<uuid>            → Edit (jede Ebene)
 *   ?entity=goal&new=1[&parent=<id>]  → Create (parent = Eltern-Ziel)
 *
 * `theme`/`kr` werden als Alias weiter akzeptiert (alte Deeplinks). Ein
 * einziger `GoalPane` bedient jede Ebene; die Fortschrittsquelle (manuell /
 * aus Unterzielen / aus verknüpften KPIs) wird im Formular gewählt.
 * KPI-Bindungen werden read-only angezeigt; Pflege im Controlling-Modul.
 */
type Entity = "theme" | "kr" | "goal";

/** Rekursive Knoten-Suche im Goal-Baum (Kaskade); liefert Knoten + Eltern. */
function findNode(
  nodes: GoalNode[],
  id: string,
  parent: GoalNode | null = null,
): { node: GoalNode; parent: GoalNode | null } | null {
  for (const n of nodes) {
    if (n.id === id) return { node: n, parent };
    const deeper = findNode(n.children, id, n);
    if (deeper) return deeper;
  }
  return null;
}

/** Ahnen-Pfad (Wurzel … Elternteil) zum Knoten `id`, ohne den Knoten selbst. */
function findPath(nodes: GoalNode[], id: string, trail: GoalNode[] = []): GoalNode[] | null {
  for (const n of nodes) {
    if (n.id === id) return trail;
    const deeper = findPath(n.children, id, [...trail, n]);
    if (deeper) return deeper;
  }
  return null;
}

interface Props {
  model: ZieleModel;
  canEdit: boolean;
  /** Tenant-User (Id → Anzeigename) für den Owner-Picker. */
  userLabels?: Record<string, string>;
}

export function ZieleEditDrawer({ model, canEdit, userLabels = {} }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const entity = searchParams.get("entity") as Entity | null;
  const id = searchParams.get("id");
  const isNew = searchParams.get("new") === "1";
  const parentId = searchParams.get("parent");

  const open = Boolean(entity && (id || isNew));

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("entity");
    next.delete("id");
    next.delete("new");
    next.delete("parent");
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="!max-w-3xl overflow-y-auto p-0 sm:!max-w-3xl">
        <div className="p-5">
          {entity && (
            <GoalPane
              key={isNew ? "new" : (id ?? "new")}
              model={model}
              id={isNew ? null : id}
              parentId={parentId}
              canEdit={canEdit}
              userLabels={userLabels}
              onClose={close}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Goal-Knoten — ein Pane für jede Ebene ────────────────────────────────

type GoalProgressMode = "manual" | "rollup" | "kpi_tree";

/**
 * Ein einziger Pane für Anlegen + Bearbeiten jedes Goal-Knotens (Theme wie
 * Unterziel). Die Fortschrittsquelle wird im Formular gewählt:
 *  - manuell         → Ist-Wert von Hand;
 *  - aus Unterzielen → gewichteter Rollup der Kinder;
 *  - KPI-Baum        → Blatt: Ist aus verknüpften Epic-KPIs; Ast: Kaskade.
 */
function GoalPane({
  model,
  id,
  parentId,
  canEdit,
  userLabels,
  onClose,
}: {
  model: ZieleModel;
  id: string | null;
  parentId: string | null;
  canEdit: boolean;
  userLabels: Record<string, string>;
  onClose: () => void;
}) {
  const found = useMemo(() => (id ? findNode(model.themes, id) : null), [model, id]);
  const node = found?.node ?? null;
  const isNew = !id;
  // Ahnen-Pfad für die Breadcrumb im Drawer-Kopf (Ortungs-Hinweis).
  const ancestors = useMemo(() => (id ? (findPath(model.themes, id) ?? []) : []), [model, id]);

  const [createState, createRun, createPending] = useActionState(createGoalNodeAction, {});
  const [updateState, updateRun, updatePending] = useActionState(updateGoalNodeAction, {});
  const [deleteState, deleteRun, deletePending] = useActionState(deleteObjectiveAction, {});
  const pending = createPending || updatePending || deletePending;
  const err = createState.error || updateState.error || deleteState.error;

  // Einheitliche Benennung: jeder Knoten heißt „Ziel" (Top-Level wie Unterebene).
  const depth = node ? node.depth : parentId ? 1 : 0;
  const isTopLevel = depth === 0;
  const kindLabel = "Ziel";

  // Anlegen zeigt für Top-Goal UND Unterziel dasselbe volle Formular: Default
  // „manual" ⇒ Metrik-Block sichtbar (Rollup würde ihn ausblenden). Ein
  // aggregierendes Theme wählt „Aus Unterzielen" explizit.
  const [mode, setMode] = useState<GoalProgressMode>(
    (node?.progressMode as GoalProgressMode | undefined) ?? "manual",
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Edit-Drawer-Tabs (B2): Überblick / Verknüpfungen / Einstellungen.
  const [tab, setTab] = useState<"overview" | "links" | "settings">("overview");

  function submit(fd: FormData) {
    fd.set("progressMode", mode);
    if (isNew) {
      if (parentId) fd.set("parentObjectiveId", parentId);
      startTransition(() => createRun(fd));
    } else {
      fd.set("id", id!);
      startTransition(() => updateRun(fd));
    }
  }

  // Löschen fragt erst über einen Dialog nach (statt native confirm()).
  function performDelete() {
    if (!id) return;
    const fd = new FormData();
    fd.set("id", id);
    setConfirmOpen(false);
    startTransition(() => {
      deleteRun(fd);
      onClose();
    });
  }

  // „Erweitert" — beim Anlegen eingeklappt (Progressive Disclosure), beim
  // Bearbeiten offen im Einstellungen-Tab. Felder bleiben im DOM ⇒ submitten mit.
  const advancedFields = (
    <div className="space-y-3">
      <Field label="Narrativ">
        <textarea
          name="narrative"
          defaultValue={node?.narrative ?? ""}
          rows={3}
          className={TEXTAREA}
          disabled={!canEdit}
        />
      </Field>
      <Field label="Fällig am">
        <input
          name="dueDate"
          type="date"
          defaultValue={node?.dueDate ? node.dueDate.slice(0, 10) : ""}
          className={INPUT}
          disabled={!canEdit}
        />
      </Field>
      {mode !== "rollup" && (
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <Field label="Einheit (Label)">
            <input
              name="metricUnit"
              defaultValue={node?.metricUnit ?? ""}
              className={INPUT}
              disabled={!canEdit}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Metriktyp">
              <select
                name="metricType"
                defaultValue={node?.metricType ?? "number"}
                className={INPUT}
                disabled={!canEdit}
                onChange={(e) => {
                  // Bei „Prozent" leere Baseline/Target auf 0/100 vorbelegen.
                  if (e.target.value !== "percent") return;
                  const form = e.currentTarget.form;
                  if (!form) return;
                  const b = form.elements.namedItem("baseline") as HTMLInputElement | null;
                  const t = form.elements.namedItem("target") as HTMLInputElement | null;
                  if (b && b.value === "") b.value = "0";
                  if (t && t.value === "") t.value = "100";
                }}
              >
                <option value="number">Zahl</option>
                <option value="percent">Prozent</option>
                <option value="currency">Währung</option>
              </select>
            </Field>
            <Field label="Nachkomma (0–6)">
              <input
                name="precision"
                type="number"
                min={0}
                max={6}
                defaultValue={node?.precision ?? 0}
                className={INPUT}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Währung (ISO)">
              <input
                name="currencyCode"
                defaultValue={node?.currencyCode ?? ""}
                placeholder="EUR"
                className={INPUT}
                disabled={!canEdit}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Baseline">
              <input
                name="baseline"
                type="number"
                step="any"
                defaultValue={node?.baseline ?? ""}
                className={INPUT}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Target (Zielwert)">
              <input
                name="target"
                type="number"
                step="any"
                defaultValue={node?.target ?? ""}
                className={INPUT}
                disabled={!canEdit}
              />
            </Field>
            <Field label={mode === "kpi_tree" ? "Ist (abgeleitet)" : "Aktuell"}>
              <input
                name="current"
                type="number"
                step="any"
                defaultValue={node?.current ?? ""}
                className={INPUT}
                disabled={!canEdit || mode === "kpi_tree"}
                title={
                  mode === "kpi_tree"
                    ? "Abgeleitet aus verknüpften KPIs bzw. der Unterziel-Kaskade"
                    : undefined
                }
              />
            </Field>
          </div>
        </div>
      )}
      <Field
        label="Gewicht im Rollup des Elternziels (leer = 1)"
        hint="Wie stark dieses Unterziel im Durchschnitt des Elternziels zählt. Leer = 1 (alle Unterziele gleich gewichtet)."
      >
        <input
          name="rollupWeight"
          type="number"
          step="any"
          min={0}
          defaultValue={node?.rollupWeight ?? ""}
          placeholder="1"
          className={INPUT}
          disabled={!canEdit}
        />
      </Field>
      {!isTopLevel && (
        <Field
          label={`Beitrag zum Elternziel — 1 ${node?.metricUnit || "Einheit"} = ▢ ${
            found?.parent?.metricUnit || "Eltern-Einheit"
          } (leer = kein Wertbeitrag)`}
        >
          <input
            name="parentUnitPerChildUnit"
            type="number"
            step="any"
            defaultValue={node?.parentUnitPerChildUnit ?? ""}
            placeholder="z. B. 10000"
            className={INPUT}
            disabled={!canEdit}
          />
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            Einheiten-Kaskade: Wie viel der Eltern-Einheit trägt 1 {node?.metricUnit || "Einheit"}{" "}
            dieses Ziels bei, wenn du seine KPI bewegst?
          </p>
        </Field>
      )}
    </div>
  );

  const formNode = (
    <FormShell
      title={isNew ? `Neues ${kindLabel}` : (node?.title ?? "Ziel")}
      subtitle={isNew ? "Anlegen" : kindLabel}
      pending={pending}
      error={err}
      onSubmit={submit}
      onDelete={isNew ? null : () => setConfirmOpen(true)}
      canEdit={canEdit}
      confirmDelete={
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ziel löschen?</DialogTitle>
              <DialogDescription>
                „{node?.title ?? "Dieses Ziel"}" und alle Unterziele werden entfernt. Das lässt sich
                nicht rückgängig machen.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Abbrechen</DialogClose>
              <Button variant="destructive" onClick={performDelete} disabled={pending}>
                {pending ? "Löscht…" : "Löschen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Field label="Titel">
        <input
          name="title"
          defaultValue={node?.title ?? ""}
          required
          className={INPUT}
          disabled={!canEdit}
          placeholder="z.B. Konversion verdoppeln"
        />
      </Field>
      <Field label="Zeitraum">
        <GoalPeriodField
          defaultPeriod={node?.period ?? null}
          defaultStart={node?.periodStart ?? null}
          defaultEnd={node?.periodEnd ?? null}
          disabled={!canEdit}
        />
      </Field>
      <Field label="Owner" hint="Verantwortlich für dieses Ziel. Aus den Tenant-Nutzern.">
        <UserPicker
          name="ownerId"
          defaultValue={node?.ownerId ?? ""}
          options={Object.entries(userLabels).map(([uid, label]) => ({ value: uid, label }))}
          ariaLabel="Owner"
          placeholder="— Kein Owner"
          emptyLabel="— Kein Owner"
          disabled={!canEdit}
        />
      </Field>

      <Field
        label="Fortschrittsquelle"
        hint="Woraus sich der Fortschritt berechnet: Manuell (du pflegst den Wert selbst), Aus Unterzielen (Ø der Kinder) oder KPI-Baum (Blatt: Ist aus verknüpften KPIs, Δ × Faktor; Ast: kaskadierte KPI-Werte über die Unterziele)."
      >
        <select
          name="progressMode"
          value={mode}
          onChange={(e) => setMode(e.target.value as GoalProgressMode)}
          className={INPUT}
          disabled={!canEdit}
        >
          <option value="manual">Manuell</option>
          <option value="rollup">Aus Unterzielen</option>
          {/* Epic-KPIs sind Portfolio-Inhalt — Option nur mit Modul (oder wenn bereits gewählt). */}
          {(model.modules.portfolio || mode === "kpi_tree") && (
            <option value="kpi_tree">KPI-Baum</option>
          )}
        </select>
      </Field>
      {mode === "kpi_tree" && (
        <p className="text-xs text-muted-foreground">
          KPI-Baum: als Blatt zieht das Ziel seinen Ist aus verknüpften KPIs (Δ × Faktor); mit
          Unterzielen kaskadiert es deren Werte hoch und misst die Erfüllung wert-basiert
          (erreichter Wert ÷ Zielwert).
        </p>
      )}
      {mode === "rollup" && (
        <p className="text-xs text-muted-foreground">
          Fortschritt = gewichteter Durchschnitt der Unterziele. Eine eigene Metrik wird ignoriert.
        </p>
      )}

      {isNew ? <DrawerSection title="Erweitert">{advancedFields}</DrawerSection> : advancedFields}
    </FormShell>
  );

  if (isNew || !id || !node) {
    return <div className="space-y-5">{formNode}</div>;
  }

  // Messbarer Knoten (eigene Metrik) → Value-Check-in ("kr"); sonst Status ("objective").
  // Aggregierende Knoten (rollup, kpi_tree-Ast) sind Container → "objective".
  const nodeHasChildren = node.children.length > 0;
  const detailTarget: "objective" | "kr" =
    node.isMeasurable &&
    node.progressMode !== "rollup" &&
    !(node.progressMode === "kpi_tree" && nodeHasChildren)
      ? "kr"
      : "objective";
  const metricSpec = {
    metricType: node.metricType,
    precision: node.precision,
    currencyCode: node.currencyCode,
  };
  const currentValueLabel =
    detailTarget === "kr" && node.current != null
      ? `${formatMetricValue(node.current, metricSpec)}${
          node.target != null ? ` / ${formatMetricValue(node.target, metricSpec)}` : ""
        }`
      : "";

  const linkSummary = summarizeLinks(node);

  return (
    <div className="space-y-4">
      <header className="space-y-0.5 border-b pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {isTopLevel
            ? "Ziel"
            : ancestors.length > 0
              ? ancestors.map((a) => a.title).join(" › ")
              : `Ziel · ${found?.parent?.title ?? "—"}`}
        </p>
        <h2 className="font-heading text-xl font-semibold tracking-tight">{node.title}</h2>
      </header>

      {/* Tabs (B2): Überblick / Verknüpfungen / Einstellungen — hält den Drawer fokussiert. */}
      <ToggleGroup
        value={tab}
        onChange={setTab}
        ariaLabel="Ansicht"
        className="text-xs font-medium"
        options={[
          { id: "overview", label: "Überblick" },
          { id: "links", label: "Verknüpfungen" },
          { id: "settings", label: "Einstellungen" },
        ]}
      />

      {/* Überblick — Status, Kennzahlen, Chart, Aktivität. */}
      {tab === "overview" && (
        <div className="space-y-4">
          <GoalDetailPanel
            target={detailTarget}
            id={id}
            status={node.status}
            progress={node.progress ?? 0}
            currentValueLabel={currentValueLabel}
            canEdit={canEdit}
            progressMode={node.progressMode}
            krCurrent={node.current}
            metricType={node.metricType}
            precision={node.precision}
            currencyCode={node.currencyCode}
            {...(node.unitValue.planned > 0
              ? { currentValueHint: "Aus verknüpften KPIs und Unterzielen hochgerechnet." }
              : {})}
          />
        </div>
      )}

      {/* Verknüpfungen — Unterziele, Elternziel, Related work, Wertströme/ARTs. */}
      {tab === "links" && (
        <div className="space-y-4">
          <SubGoals parentId={id} subgoals={node.children} canEdit={canEdit} />
          <ParentGoalSection nodeId={id} parent={found?.parent ?? null} canEdit={canEdit} />

          <DrawerSection title="Related work & Scope" hint={linkSummary}>
            <div className="space-y-3">
              <RelatedWorkUnified
                goalId={id}
                epics={node.relatedEpics}
                items={node.relatedWork}
                canEdit={canEdit}
                searchEnabled={model.modules.portfolio || model.modules.program}
              />
              {node.progressMode === "kpi_tree" && !nodeHasChildren && (
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Die KPIs verknüpfter Epics bilden über Δ × Umrechnungsfaktor den Ist-Wert dieses
                  Ziels (Fortschrittsquelle „KPI-Baum").
                </p>
              )}
              <div className="space-y-3 border-t pt-3">
                <GoalScopeLinks
                  goalId={id}
                  valueStreams={node.valueStreams}
                  arts={node.arts}
                  canEdit={canEdit}
                  vsEnabled={model.modules.portfolio}
                  artEnabled={model.modules.program}
                />
              </div>
            </div>
          </DrawerSection>
        </div>
      )}

      {/* Einstellungen — Custom Fields + vollständiges Formular. */}
      {tab === "settings" && (
        <div className="space-y-4">
          {model.customFieldDefs.length > 0 && (
            <CustomFields
              target={detailTarget}
              goalId={id}
              // Tenant-Defs (einmalig aus dem Modell) + die gesetzten Werte dieses
              // Knotens (sparse) → volle editierbare Feldliste, ohne Defs × alle
              // Knoten im First-Paint-Payload.
              fields={model.customFieldDefs.map((d) => ({
                ...d,
                value: node.customFields.find((f) => f.defId === d.defId)?.value ?? "",
              }))}
              canEdit={canEdit}
            />
          )}
          {formNode}
        </div>
      )}
    </div>
  );
}

/** Baut einen Drawer-Href relativ zum aktuellen URL-State (Query-Patch). */
function withGoalParams(sp: ReadonlyURLSearchParams, patch: Record<string, string | null>): string {
  const p = new URLSearchParams(sp.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) p.delete(k);
    else p.set(k, v);
  }
  const qs = p.toString();
  return qs ? `?${qs}` : "?";
}

/** Kleiner Fortschrittsbalken 0..1 für Kind-/Eltern-Zeilen. */
function MiniBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">{pct}%</span>
    </span>
  );
}

const KIND_LABEL = (k: string) => (k === "key_result" ? "Key result" : "Ziel");

/**
 * Unterziele des geöffneten Ziels (Asana „Sub-goals"): Liste der Kinder mit
 * Fortschritt; „Neues Unterziel" (Create), „Bestehendes Ziel verbinden"
 * (Reparent unter dieses Ziel) und „Trennen" (Reparent auf Top-Level). Alles
 * über die bestehenden Actions; Zyklen verhindert `reparentGoalNode` serverseitig.
 */
function SubGoals({
  parentId,
  subgoals,
  canEdit,
}: {
  parentId: string;
  subgoals: GoalNode[];
  canEdit: boolean;
}) {
  const searchParams = useSearchParams();
  const [connectId, setConnectId] = useState("");
  const [state, run, pending] = useActionState(reparentGoalNodeAction, {});
  const [, runIncl, inclPending] = useActionState(setGoalRollupInclusionAction, {});

  function connect() {
    if (!connectId) return;
    const fd = new FormData();
    fd.set("id", connectId);
    fd.set("newParentId", parentId);
    startTransition(() => run(fd));
    setConnectId("");
  }
  function disconnect(childId: string) {
    const fd = new FormData();
    fd.set("id", childId);
    fd.set("newParentId", "");
    startTransition(() => run(fd));
  }
  function toggleInclusion(childId: string, include: boolean) {
    const fd = new FormData();
    fd.set("id", childId);
    fd.set("include", include ? "true" : "false");
    startTransition(() => runIncl(fd));
  }

  const openHref = (goalId: string) =>
    withGoalParams(searchParams, { entity: "goal", id: goalId, new: null, parent: null });
  const createHref = withGoalParams(searchParams, {
    entity: "goal",
    new: "1",
    parent: parentId,
    id: null,
  });

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Unterziele
      </h3>
      {subgoals.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch keine Unterziele.</p>
      ) : (
        <ul className="space-y-1">
          {subgoals.map((sg) => (
            <li
              key={sg.id}
              className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-xs"
            >
              <Link
                href={openHref(sg.id) as never}
                scroll={false}
                className="min-w-0 flex-1 hover:underline"
              >
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{sg.title}</span>
                  <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] uppercase text-muted-foreground">
                    {KIND_LABEL(sg.nodeKind)}
                  </span>
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {goalNodeTimeframeLabel(sg)}
                  {!sg.includeInParentRollup && (
                    <span
                      className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-800"
                      title="Zählt nicht im automatischen Fortschritt dieses Ziels"
                    >
                      nicht im Rollup
                    </span>
                  )}
                </span>
              </Link>
              <span className={`w-24 shrink-0 ${sg.includeInParentRollup ? "" : "opacity-40"}`}>
                <MiniBar value={sg.progress ?? 0} />
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => toggleInclusion(sg.id, !sg.includeInParentRollup)}
                  disabled={inclPending}
                  aria-label={
                    sg.includeInParentRollup
                      ? `${sg.title} aus automatischem Fortschritt ausnehmen`
                      : `${sg.title} in automatischen Fortschritt aufnehmen`
                  }
                  title={
                    sg.includeInParentRollup
                      ? "Aus automatischem Fortschritt ausnehmen"
                      : "In automatischen Fortschritt aufnehmen"
                  }
                  className={`grid size-5 shrink-0 place-items-center rounded hover:bg-muted disabled:opacity-50 ${
                    sg.includeInParentRollup
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-amber-700"
                  }`}
                >
                  {sg.includeInParentRollup ? "⊘" : "⊕"}
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => disconnect(sg.id)}
                  disabled={pending}
                  aria-label={`${sg.title} trennen`}
                  title="Trennen (auf oberste Ebene)"
                  className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="space-y-1.5 rounded-md border border-dashed p-2">
          <EntitySelect
            kind="goal"
            name="connectSubgoal"
            label="Bestehendes Ziel verbinden"
            value={connectId}
            onChange={setConnectId}
            labelField="name"
            params={{ excludeSubtreeOf: parentId }}
            disabled={pending}
          />
          <div className="flex items-center justify-between gap-2">
            <Link
              href={createHref as never}
              scroll={false}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              + Neues Unterziel
            </Link>
            <button
              type="button"
              onClick={connect}
              disabled={pending || connectId === ""}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Verbinden
            </button>
          </div>
        </div>
      )}
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </section>
  );
}

/**
 * Elternziel des geöffneten Ziels (Asana „Parent goals"): Karte des Elternziels
 * + Setzen/Ändern (Reparent dieses Ziels) / Entfernen (auf Top-Level). Der Picker
 * blendet dieses Ziel + seine Nachfahren aus (`excludeSubtreeOf`, Zyklus-Guard).
 */
function ParentGoalSection({
  nodeId,
  parent,
  canEdit,
}: {
  nodeId: string;
  parent: GoalNode | null;
  canEdit: boolean;
}) {
  const searchParams = useSearchParams();
  const [pickId, setPickId] = useState("");
  const [state, run, pending] = useActionState(reparentGoalNodeAction, {});

  function setParent(newParentId: string) {
    const fd = new FormData();
    fd.set("id", nodeId);
    fd.set("newParentId", newParentId);
    startTransition(() => run(fd));
    setPickId("");
  }

  const openHref = (goalId: string) =>
    withGoalParams(searchParams, { entity: "goal", id: goalId, new: null, parent: null });

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Elternziel
      </h3>
      {parent ? (
        <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
          <Link
            href={openHref(parent.id) as never}
            scroll={false}
            className="min-w-0 flex-1 hover:underline"
          >
            <span className="truncate font-medium">{parent.title}</span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {Math.round((parent.progress ?? 0) * 100)} % · {goalNodeTimeframeLabel(parent)}
            </span>
          </Link>
          {canEdit && (
            <button
              type="button"
              onClick={() => setParent("")}
              disabled={pending}
              className="shrink-0 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              Entfernen
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Kein Elternziel (oberste Ebene).</p>
      )}
      {canEdit && (
        <div className="space-y-1.5 rounded-md border border-dashed p-2">
          <EntitySelect
            kind="goal"
            name="setParentGoal"
            label={parent ? "Elternziel ändern" : "Elternziel setzen"}
            value={pickId}
            onChange={setPickId}
            labelField="name"
            params={{ excludeSubtreeOf: nodeId }}
            disabled={pending}
          />
          <button
            type="button"
            onClick={() => pickId && setParent(pickId)}
            disabled={pending || pickId === ""}
            className="ml-auto block rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Übernehmen
          </button>
        </div>
      )}
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </section>
  );
}

/** Kompakte, nicht-leere Verknüpfungs-Zusammenfassung für die eingeklappte Summary. */
function summarizeLinks(node: GoalNode): string {
  const features = node.relatedWork.filter((w) => w.kind === "feature").length;
  const pis = node.relatedWork.filter((w) => w.kind === "pi").length;
  const parts: string[] = [];
  if (node.relatedEpics.length) parts.push(`${node.relatedEpics.length} Epics`);
  if (features) parts.push(`${features} Features`);
  if (pis) parts.push(`${pis} PIs`);
  if (node.valueStreams.length) parts.push(`${node.valueStreams.length} Value Streams`);
  if (node.arts.length) parts.push(`${node.arts.length} ARTs`);
  return parts.length > 0 ? parts.join(" · ") : "keine";
}

/**
 * Eingeklappter Drawer-Abschnitt (Progressive Disclosure): gestyltes `<details>`
 * mit Titel, optionalem grauem Hinweis (z. B. Zähl-Zusammenfassung) und Chevron.
 * Default zu — hält die Ziel-Übersicht fokussiert.
 */
function DrawerSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-lg border bg-muted/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="text-sm font-medium">{title}</span>
          {hint && <span className="truncate text-xs text-muted-foreground">· {hint}</span>}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t px-4 py-3">{children}</div>
    </details>
  );
}

/**
 * „Related work" vereinheitlicht (Asana-Stil): EIN Suchfeld + EINE Liste über
 * Epics (wertbringend, €), Features und PIs (referenziell). Der Typ des Treffers
 * bestimmt die Action: Epic → GoalEpicLink, Feature/PI → GoalRelatedWork. Der
 * €-Mehrwert der Epics bleibt sichtbar (Trailing); Count-once ggü. KPI-Bindungen
 * bleibt unberührt.
 */
function RelatedWorkUnified({
  goalId,
  epics,
  items,
  canEdit,
  searchEnabled,
}: {
  goalId: string;
  epics: RelatedEpic[];
  items: RelatedWorkItem[];
  canEdit: boolean;
  /** Epics/Features/PIs sind Premium-Inhalt — false ⇒ 🔒 statt Suchfeld. */
  searchEnabled: boolean;
}) {
  const [linkEpicState, linkEpicRun, linkEpicPending] = useActionState(linkEpicToGoalAction, {});
  const [unlinkEpicState, unlinkEpicRun, unlinkEpicPending] = useActionState(
    unlinkEpicFromGoalAction,
    {},
  );
  const [addState, addRun, addPending] = useActionState(addGoalRelatedWorkAction, {});
  const [removeState, removeRun, removePending] = useActionState(removeGoalRelatedWorkAction, {});
  const pending = linkEpicPending || unlinkEpicPending || addPending || removePending;
  const err = linkEpicState.error || unlinkEpicState.error || addState.error || removeState.error;

  function pick(r: RelatedWorkResult) {
    if (r.type === "epic") {
      // Referenzielle Verknüpfung (Einheiten-Kaskade: KPI + Faktor werden im
      // Epic-KPI-Bereich je Ziel definiert).
      const fd = new FormData();
      fd.set("goalId", goalId);
      fd.set("epicId", r.id);
      startTransition(() => linkEpicRun(fd));
    } else {
      const fd = new FormData();
      fd.set("goalId", goalId);
      fd.set("kind", r.type);
      fd.set("refId", r.id);
      startTransition(() => addRun(fd));
    }
  }

  function remove(key: string) {
    const i = key.indexOf(":");
    const type = key.slice(0, i);
    const rid = key.slice(i + 1);
    if (type === "epic") {
      const fd = new FormData();
      fd.set("epicId", rid);
      fd.set("goalId", goalId);
      startTransition(() => unlinkEpicRun(fd));
    } else {
      const fd = new FormData();
      fd.set("goalId", goalId);
      fd.set("kind", type);
      fd.set("refId", rid);
      startTransition(() => removeRun(fd));
    }
  }

  const chips: LinkChip[] = [
    ...epics.map((e) => ({
      key: `epic:${e.epicId}`,
      label: e.title,
      href: e.href,
      subtitle: `Epic · ${e.stageGate}`,
      removeLabel: `Verknüpfung mit ${e.title} entfernen`,
      trailing: (
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {e.trio.planned > 0
            ? `€${Math.round(e.trio.realized).toLocaleString("de-DE")} / ${Math.round(
                e.trio.planned,
              ).toLocaleString("de-DE")}`
            : "—"}
        </span>
      ),
    })),
    ...items.map((it) => ({
      key: `${it.kind}:${it.refId}`,
      label: it.title,
      href: it.href,
      subtitle: it.kind === "feature" ? "Feature" : "PI",
      removeLabel: `Verknüpfung mit ${it.title} entfernen`,
    })),
  ];

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Related work
      </h3>
      <LinkList
        variant="row"
        emptyText="Noch keine Arbeit verbunden."
        canEdit={canEdit}
        onRemove={remove}
        removePending={pending}
        items={chips}
      >
        {canEdit && searchEnabled && (
          <div className="rounded-md border border-dashed p-2">
            <RelatedWorkSearch onPick={pick} disabled={pending} />
          </div>
        )}
      </LinkList>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </section>
  );
}

/**
 * VS/ART-Verantwortung (Epic 6a): n:m-Zuordnung eines Ziels zu Value Streams
 * und/oder ARTs — rein organisatorisch, kein Auth-Eingriff. Chips + Add-Picker
 * (EntitySelect kind="valueStream"/"art" laufen standalone, keine Kaskade).
 */
function GoalScopeLinks({
  goalId,
  valueStreams,
  arts,
  canEdit,
  vsEnabled,
  artEnabled,
}: {
  goalId: string;
  valueStreams: ScopeRef[];
  arts: ScopeRef[];
  canEdit: boolean;
  /** Value Streams = Portfolio-Inhalt; false ⇒ 🔒 statt Picker. */
  vsEnabled: boolean;
  /** ARTs = Programm-Inhalt; false ⇒ 🔒 statt Picker. */
  artEnabled: boolean;
}) {
  const [vsId, setVsId] = useState("");
  const [artId, setArtId] = useState("");
  const [linkVsState, linkVsRun, linkVsPending] = useActionState(linkGoalValueStreamAction, {});
  const [unlinkVsState, unlinkVsRun, unlinkVsPending] = useActionState(
    unlinkGoalValueStreamAction,
    {},
  );
  const [linkArtState, linkArtRun, linkArtPending] = useActionState(linkGoalArtAction, {});
  const [unlinkArtState, unlinkArtRun, unlinkArtPending] = useActionState(unlinkGoalArtAction, {});
  const err =
    linkVsState.error || unlinkVsState.error || linkArtState.error || unlinkArtState.error;

  function addVs() {
    if (!vsId) return;
    const fd = new FormData();
    fd.set("goalId", goalId);
    fd.set("valueStreamId", vsId);
    startTransition(() => linkVsRun(fd));
    setVsId("");
  }
  function removeVs(id: string) {
    const fd = new FormData();
    fd.set("goalId", goalId);
    fd.set("valueStreamId", id);
    startTransition(() => unlinkVsRun(fd));
  }
  function addArt() {
    if (!artId) return;
    const fd = new FormData();
    fd.set("goalId", goalId);
    fd.set("artId", artId);
    startTransition(() => linkArtRun(fd));
    setArtId("");
  }
  function removeArt(id: string) {
    const fd = new FormData();
    fd.set("goalId", goalId);
    fd.set("artId", id);
    startTransition(() => unlinkArtRun(fd));
  }

  const scopeItems = (items: ScopeRef[]) =>
    items.map((it) => ({ key: it.id, label: it.name, removeLabel: `${it.name} entfernen` }));

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Verantwortung · Value Streams &amp; ARTs
      </h3>
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Value Streams</p>
        <LinkList
          variant="pill"
          emptyText="Keine Zuordnung."
          canEdit={canEdit}
          onRemove={removeVs}
          removePending={unlinkVsPending}
          items={scopeItems(valueStreams)}
        >
          {canEdit && vsEnabled && (
            <div className="flex items-end gap-1.5">
              <div className="flex-1">
                <EntitySelect
                  kind="valueStream"
                  name="goalScopeVs"
                  label=""
                  value={vsId}
                  onChange={setVsId}
                  labelField="name"
                  disabled={linkVsPending}
                />
              </div>
              <button
                type="button"
                onClick={addVs}
                disabled={linkVsPending || vsId === ""}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                +
              </button>
            </div>
          )}
        </LinkList>
      </div>
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ARTs</p>
        <LinkList
          variant="pill"
          emptyText="Keine Zuordnung."
          canEdit={canEdit}
          onRemove={removeArt}
          removePending={unlinkArtPending}
          items={scopeItems(arts)}
        >
          {canEdit && artEnabled && (
            <div className="flex items-end gap-1.5">
              <div className="flex-1">
                <EntitySelect
                  kind="art"
                  name="goalScopeArt"
                  label=""
                  value={artId}
                  onChange={setArtId}
                  labelField="name"
                  disabled={linkArtPending}
                />
              </div>
              <button
                type="button"
                onClick={addArt}
                disabled={linkArtPending || artId === ""}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                +
              </button>
            </div>
          )}
        </LinkList>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </section>
  );
}

/**
 * Custom Fields (Epic 7): tenant-weite Zusatzfelder, Werte je Ziel-Knoten.
 * Nur sichtbar, wenn Felder definiert sind. Speichern per Feld (blur/change);
 * leerer Wert löscht den Wert.
 */
function CustomFields({
  target,
  goalId,
  fields,
  canEdit,
}: {
  target: "objective" | "kr";
  goalId: string;
  fields: GoalCustomFieldEntry[];
  canEdit: boolean;
}) {
  if (fields.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Custom Fields
      </h3>
      <div className="space-y-2">
        {fields.map((f) => (
          <CustomFieldRow
            key={f.defId}
            target={target}
            goalId={goalId}
            field={f}
            canEdit={canEdit}
          />
        ))}
      </div>
    </section>
  );
}

function CustomFieldRow({
  target,
  goalId,
  field,
  canEdit,
}: {
  target: "objective" | "kr";
  goalId: string;
  field: GoalCustomFieldEntry;
  canEdit: boolean;
}) {
  const [state, run, pending] = useActionState(setGoalCustomFieldValueAction, {});
  const [val, setVal] = useState(field.value);

  function save(next: string) {
    if (next === field.value) return;
    const fd = new FormData();
    fd.set("target", target);
    fd.set("goalId", goalId);
    fd.set("defId", field.defId);
    fd.set("value", next);
    startTransition(() => run(fd));
  }

  const inputCls =
    "h-8 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{field.name}</span>
      {field.type === "select" ? (
        <select
          value={val}
          disabled={!canEdit || pending}
          onChange={(e) => {
            setVal(e.target.value);
            save(e.target.value);
          }}
          className={inputCls}
        >
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === "number" ? "number" : "text"}
          value={val}
          disabled={!canEdit || pending}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => save(val)}
          className={inputCls}
        />
      )}
      {state.error && <span className="text-[11px] text-destructive">{state.error}</span>}
    </label>
  );
}

// ── Form-Shell + Primitives ───────────────────────────────────────────

const INPUT =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";
const TEXTAREA =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {hint ? <InfoHint text={hint} /> : null}
      </span>
      {children}
    </label>
  );
}

/** Kleines ⓘ mit Erklärungs-Tooltip für Fachbegriffe (klick fokussiert nur das Feld). */
function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label="Erklärung"
        onClick={(e) => e.preventDefault()}
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-normal normal-case leading-none text-muted-foreground hover:border-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        i
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

function FormShell({
  title,
  subtitle,
  children,
  pending,
  error,
  onSubmit,
  onDelete,
  canEdit,
  confirmDelete,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  pending: boolean;
  error: string | undefined;
  onSubmit: (fd: FormData) => void;
  onDelete: (() => void) | null;
  canEdit: boolean;
  confirmDelete?: React.ReactNode;
}) {
  return (
    <form
      action={onSubmit}
      className="space-y-4"
      onSubmit={(e) => {
        if (!canEdit) e.preventDefault();
      }}
    >
      <header className="space-y-0.5 border-b pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {subtitle}
        </p>
        <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
      </header>
      <div className="space-y-3">{children}</div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <footer className="flex items-center justify-between gap-2 border-t pt-3">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending || !canEdit}
            className="text-xs text-destructive hover:underline disabled:opacity-50"
          >
            Löschen
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending || !canEdit}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Speichert…" : "Speichern"}
        </button>
      </footer>
      {confirmDelete}
    </form>
  );
}
