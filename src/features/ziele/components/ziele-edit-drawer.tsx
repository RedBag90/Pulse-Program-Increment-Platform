"use client";

import { useActionState, startTransition, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type {
  ZieleModel,
  ZieleKrContribution,
  RelatedEpic,
  RelatedWorkItem,
  ScopeRef,
  GoalNode,
  GoalCustomFieldEntry,
} from "@/server/views/ziele-view";
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
} from "@/features/ziele/actions/ziele";
import { GoalDetailPanel } from "@/features/ziele/components/goal-status/goal-detail-panel";
import { EntitySelect } from "@/features/create/entity-select";
import { PeriodPicker } from "@/features/ziele/components/period-picker";
import { formatMetricValue } from "@/domain/goal-metric";

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

interface Props {
  model: ZieleModel;
  canEdit: boolean;
}

export function ZieleEditDrawer({ model, canEdit }: Props) {
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
              onClose={close}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Goal-Knoten — ein Pane für jede Ebene ────────────────────────────────

type GoalProgressMode = "manual" | "rollup" | "auto_kpi";

/**
 * Ein einziger Pane für Anlegen + Bearbeiten jedes Goal-Knotens (Theme wie
 * Unterziel). Die Fortschrittsquelle wird im Formular gewählt:
 *  - manuell        → Ist-Wert von Hand;
 *  - aus Unterzielen→ gewichteter Rollup der Kinder;
 *  - aus KPIs       → Ist = Summe der einheitengleichen KPIs verknüpfter Epics.
 */
function GoalPane({
  model,
  id,
  parentId,
  canEdit,
  onClose,
}: {
  model: ZieleModel;
  id: string | null;
  parentId: string | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const found = useMemo(() => (id ? findNode(model.themes, id) : null), [model, id]);
  const node = found?.node ?? null;
  const isNew = !id;

  const [createState, createRun, createPending] = useActionState(createGoalNodeAction, {});
  const [updateState, updateRun, updatePending] = useActionState(updateGoalNodeAction, {});
  const [deleteState, deleteRun, deletePending] = useActionState(deleteObjectiveAction, {});
  const pending = createPending || updatePending || deletePending;
  const err = createState.error || updateState.error || deleteState.error;

  // Top-Level (depth 0) bleibt „Theme (OKR)"; alle Unterebenen heißen „Ziel".
  const depth = node ? node.depth : parentId ? 1 : 0;
  const isTopLevel = depth === 0;
  const kindLabel = isTopLevel ? "Theme (OKR)" : "Ziel";

  const [mode, setMode] = useState<GoalProgressMode>(
    (node?.progressMode as GoalProgressMode | undefined) ?? (isTopLevel ? "rollup" : "manual"),
  );

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

  function remove() {
    if (!id) return;
    if (!confirm("Ziel löschen? Unterziele werden mitentfernt.")) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      deleteRun(fd);
      onClose();
    });
  }

  const formNode = (
    <FormShell
      title={isNew ? `Neues ${kindLabel}` : (node?.title ?? "Ziel")}
      subtitle={isNew ? "Anlegen" : kindLabel}
      pending={pending}
      error={err}
      onSubmit={submit}
      onDelete={isNew ? null : remove}
      canEdit={canEdit}
    >
      <Field label={isTopLevel ? "Titel (Objective-Statement)" : "Titel"}>
        <input
          name="title"
          defaultValue={node?.title ?? ""}
          required
          className={INPUT}
          disabled={!canEdit}
          placeholder="z.B. Konversion verdoppeln"
        />
      </Field>
      <Field label="Narrativ">
        <textarea
          name="narrative"
          defaultValue={node?.narrative ?? ""}
          rows={3}
          className={TEXTAREA}
          disabled={!canEdit}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Zeitraum">
          <PeriodPicker name="period" defaultValue={node?.period ?? null} disabled={!canEdit} />
        </Field>
        <Field label="Confidence (1-5)">
          <input
            name="confidence"
            type="number"
            min={0}
            max={5}
            defaultValue={node?.confidence ?? ""}
            className={INPUT}
            disabled={!canEdit}
          />
        </Field>
      </div>
      <Field label="Fällig am">
        <input
          name="dueDate"
          type="date"
          defaultValue={node?.dueDate ? node.dueDate.slice(0, 10) : ""}
          className={INPUT}
          disabled={!canEdit}
        />
      </Field>

      <div className="space-y-3 rounded-md border border-dashed p-3">
        <Field label="Fortschrittsquelle">
          <select
            name="progressMode"
            value={mode}
            onChange={(e) => setMode(e.target.value as GoalProgressMode)}
            className={INPUT}
            disabled={!canEdit}
          >
            <option value="manual">Manuell</option>
            <option value="rollup">Aus Unterzielen</option>
            <option value="auto_kpi">Aus verknüpften KPIs</option>
          </select>
        </Field>
        {mode === "rollup" ? (
          <p className="text-xs text-muted-foreground">
            Fortschritt = gewichteter Durchschnitt der Unterziele. Eine eigene Metrik wird
            ignoriert.
          </p>
        ) : (
          <>
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
              <Field label={mode === "auto_kpi" ? "Ist (aus KPIs)" : "Aktuell"}>
                <input
                  name="current"
                  type="number"
                  step="any"
                  defaultValue={node?.current ?? ""}
                  className={INPUT}
                  disabled={!canEdit || mode === "auto_kpi"}
                  title={
                    mode === "auto_kpi"
                      ? "Summe der einheitengleichen KPIs aus verknüpften Epics"
                      : undefined
                  }
                />
              </Field>
            </div>
            {mode === "auto_kpi" && (
              <p className="text-xs text-muted-foreground">
                Ist-Wert = Summe der Ist-Werte aller KPIs mit passender Einheit aus den unten
                verknüpften Epics. KPI besser → Ziel besser.
              </p>
            )}
            {mode === "manual" && (
              <Field label="Geldwert-Formel (KPI-Coverage)">
                <select
                  name="formula"
                  defaultValue={node?.formula ?? "manual"}
                  className={INPUT}
                  disabled={!canEdit}
                >
                  <option value="manual">manuell</option>
                  <option value="auto_from_kpi">aus KPI aggregiert</option>
                </select>
              </Field>
            )}
          </>
        )}
        <Field label="Gewicht im Rollup des Elternziels (leer = 1)">
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
      </div>
    </FormShell>
  );

  if (isNew || !id || !node) {
    return <div className="space-y-5">{formNode}</div>;
  }

  // Messbarer Knoten (eigene Metrik) → Value-Check-in ("kr"); sonst Status ("objective").
  const detailTarget: "objective" | "kr" =
    node.isMeasurable && node.progressMode !== "rollup" ? "kr" : "objective";
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

  return (
    <div className="space-y-6">
      <header className="space-y-0.5 border-b pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {isTopLevel ? "Theme · OKR-Statement" : `Ziel · ${found?.parent?.title ?? "—"}`}
        </p>
        <h2 className="font-heading text-xl font-semibold tracking-tight">{node.title}</h2>
      </header>
      <GoalDetailPanel
        target={detailTarget}
        id={id}
        status={node.status}
        progress={node.progress ?? 0}
        currentValueLabel={currentValueLabel}
        canEdit={canEdit}
        formula={node.formula}
        krBaseline={node.baseline}
        krTarget={node.target}
        krCurrent={node.current}
        metricType={node.metricType}
        precision={node.precision}
        currencyCode={node.currencyCode}
      />
      <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
        <RelatedEpics
          target={detailTarget}
          goalId={id}
          epics={node.relatedEpics}
          canEdit={canEdit}
        />
        {node.progressMode === "auto_kpi" ? (
          <p className="text-[10px] leading-snug text-muted-foreground">
            Die KPIs dieser Epics mit passender Einheit bilden den Ist-Wert dieses Ziels
            (Fortschrittsquelle „aus verknüpften KPIs").
          </p>
        ) : (
          <p className="text-[10px] leading-snug text-muted-foreground">
            Ein verknüpftes Epic bringt den €-Wert all seiner KPIs grob mit. Die KPI-Bindungen unten
            sind die feine Alternative — jede KPI zählt genau einmal.
          </p>
        )}
        <div className="border-t pt-3">
          <KpiBindingsReadOnly contributions={node.contributions} krId={id} />
        </div>
        <div className="border-t pt-3">
          <RelatedWork goalId={id} items={node.relatedWork} canEdit={canEdit} />
        </div>
        <div className="border-t pt-3">
          <GoalScopeLinks
            goalId={id}
            valueStreams={node.valueStreams}
            arts={node.arts}
            canEdit={canEdit}
          />
        </div>
      </div>
      {node.customFields.length > 0 && (
        <div className="rounded-lg border bg-muted/10 p-4">
          <CustomFields
            target={detailTarget}
            goalId={id}
            fields={node.customFields}
            canEdit={canEdit}
          />
        </div>
      )}
      <details className="rounded-lg border bg-muted/10 p-4">
        <summary className="cursor-pointer text-sm font-medium">Details bearbeiten</summary>
        <div className="mt-3">{formNode}</div>
      </details>
    </div>
  );
}

/**
 * "Related work" — Epics direkt an einen Ziel-Knoten (Objective ODER KR)
 * verknüpfen. Referenziell (Deeplink) plus wertbringend: der KPI-Mehrwert des
 * Epics ist bereits im Knoten-€ enthalten. Grobe Alternative zur feinen
 * KPI→KR-Bindung (Count-once: jede KPI zählt genau einmal).
 */
function RelatedEpics({
  target,
  goalId,
  epics,
  canEdit,
}: {
  target: "objective" | "kr";
  goalId: string;
  epics: RelatedEpic[];
  canEdit: boolean;
}) {
  const [epicId, setEpicId] = useState("");
  const [linkState, linkRun, linkPending] = useActionState(linkEpicToGoalAction, {});
  const [unlinkState, unlinkRun, unlinkPending] = useActionState(unlinkEpicFromGoalAction, {});
  const err = linkState.error || unlinkState.error;

  function add() {
    if (!epicId) return;
    const fd = new FormData();
    fd.set("target", target);
    fd.set("goalId", goalId);
    fd.set("epicId", epicId);
    startTransition(() => linkRun(fd));
    setEpicId("");
  }

  function remove(id: string) {
    const fd = new FormData();
    fd.set("epicId", id);
    startTransition(() => unlinkRun(fd));
  }

  return (
    <section className="space-y-2">
      <header className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Related work · Epics
        </h3>
      </header>
      {epics.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch kein Epic verbunden.</p>
      ) : (
        <ul className="space-y-1">
          {epics.map((e) => (
            <li
              key={e.epicId}
              className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                <a href={e.href} className="truncate font-medium text-primary hover:underline">
                  {e.title}
                </a>
                <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                  Epic · {e.stageGate}
                </p>
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {e.trio.planned > 0
                  ? `€${Math.round(e.trio.realized).toLocaleString("de-DE")} / ${Math.round(
                      e.trio.planned,
                    ).toLocaleString("de-DE")}`
                  : "—"}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(e.epicId)}
                  disabled={unlinkPending}
                  aria-label={`Verknüpfung mit ${e.title} entfernen`}
                  className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
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
            kind="epic"
            name="relatedEpicPicker"
            label="Epic verbinden"
            value={epicId}
            onChange={setEpicId}
            labelField="title"
            disabled={linkPending}
          />
          <button
            type="button"
            onClick={add}
            disabled={linkPending || epicId === ""}
            className="ml-auto block rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            + Epic verbinden
          </button>
        </div>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </section>
  );
}

/**
 * Related work · Feature/PI (Epic 5): rein referenzielle Verknüpfungen ohne
 * €-Beitrag — nur Deeplinks. Feature/PI werden über die ART kaskadiert
 * (EntitySelect kind="feature"/"pi" brauchen eine artId).
 */
function RelatedWork({
  goalId,
  items,
  canEdit,
}: {
  goalId: string;
  items: RelatedWorkItem[];
  canEdit: boolean;
}) {
  const [kind, setKind] = useState<"feature" | "pi">("feature");
  const [artId, setArtId] = useState("");
  const [refId, setRefId] = useState("");
  const [addState, addRun, addPending] = useActionState(addGoalRelatedWorkAction, {});
  const [removeState, removeRun, removePending] = useActionState(removeGoalRelatedWorkAction, {});
  const err = addState.error || removeState.error;

  function add() {
    if (!refId) return;
    const fd = new FormData();
    fd.set("goalId", goalId);
    fd.set("kind", kind);
    fd.set("refId", refId);
    startTransition(() => addRun(fd));
    setRefId("");
  }

  function remove(itemKind: string, itemRefId: string) {
    const fd = new FormData();
    fd.set("goalId", goalId);
    fd.set("kind", itemKind);
    fd.set("refId", itemRefId);
    startTransition(() => removeRun(fd));
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Related work · Features &amp; PIs
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch keine Arbeit verbunden.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li
              key={`${it.kind}:${it.refId}`}
              className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                <a href={it.href} className="truncate font-medium text-primary hover:underline">
                  {it.title}
                </a>
                <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                  {it.kind === "feature" ? "Feature" : "PI"}
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(it.kind, it.refId)}
                  disabled={removePending}
                  aria-label={`Verknüpfung mit ${it.title} entfernen`}
                  className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
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
          <div className="flex gap-1">
            {(["feature", "pi"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setRefId("");
                }}
                className={`flex-1 rounded-md border px-2 py-1 text-xs font-medium ${
                  kind === k
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {k === "feature" ? "Feature" : "PI"}
              </button>
            ))}
          </div>
          <EntitySelect
            kind="art"
            name="relatedWorkArt"
            label="ART wählen"
            value={artId}
            onChange={(v) => {
              setArtId(v);
              setRefId("");
            }}
            labelField="name"
            disabled={addPending}
          />
          <EntitySelect
            kind={kind}
            name="relatedWorkRef"
            label={kind === "feature" ? "Feature wählen" : "PI wählen"}
            value={refId}
            onChange={setRefId}
            labelField={kind === "feature" ? "title" : "name"}
            params={{ artId }}
            disabled={addPending || artId === ""}
          />
          <button
            type="button"
            onClick={add}
            disabled={addPending || refId === ""}
            className="ml-auto block rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            + Verbinden
          </button>
        </div>
      )}
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
}: {
  goalId: string;
  valueStreams: ScopeRef[];
  arts: ScopeRef[];
  canEdit: boolean;
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

  function chips(items: ScopeRef[], onRemove: (id: string) => void, removing: boolean) {
    if (items.length === 0) {
      return <p className="text-xs text-muted-foreground">Keine Zuordnung.</p>;
    }
    return (
      <ul className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs"
          >
            <span className="truncate">{it.name}</span>
            {canEdit && (
              <button
                type="button"
                onClick={() => onRemove(it.id)}
                disabled={removing}
                aria-label={`${it.name} entfernen`}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Verantwortung · Value Streams &amp; ARTs
      </h3>
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Value Streams</p>
        {chips(valueStreams, removeVs, unlinkVsPending)}
        {canEdit && (
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
      </div>
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ARTs</p>
        {chips(arts, removeArt, unlinkArtPending)}
        {canEdit && (
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

function KpiBindingsReadOnly({
  contributions,
  krId,
}: {
  contributions: ZieleKrContribution[];
  krId: string;
}) {
  const weightSum = contributions.reduce(
    (s, c) => s + (Number.isFinite(c.weight) ? c.weight : 0),
    0,
  );
  return (
    <section className="space-y-2">
      <header className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          KPI-Bindungen
        </h3>
        <a
          href={`/controlling/kpi-coverage#kr-${krId}`}
          className="text-[11px] text-primary hover:underline"
        >
          Im Controlling pflegen →
        </a>
      </header>
      {contributions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch keine KPI gebunden — Bindung im Controlling-Modul.
        </p>
      ) : (
        <>
          <ul className="space-y-1">
            {contributions.map((c) => (
              <li
                key={c.kpiId}
                className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.kpiName}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    Epic · {c.epicTitle} · Weight {(c.weight * 100).toFixed(0)} %
                  </p>
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {c.achievement != null
                    ? `${Math.round(c.achievement * 100)}% · €${Math.round(c.contributionRealized).toLocaleString("de-DE")}`
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
          <p
            className={`text-right text-[10px] tabular-nums ${
              Math.abs(weightSum - 1) < 0.001 ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            Σ Weights {(weightSum * 100).toFixed(0)} %
          </p>
        </>
      )}
    </section>
  );
}

// ── Form-Shell + Primitives ───────────────────────────────────────────

const INPUT =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";
const TEXTAREA =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
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
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  pending: boolean;
  error: string | undefined;
  onSubmit: (fd: FormData) => void;
  onDelete: (() => void) | null;
  canEdit: boolean;
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
            Loeschen
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
    </form>
  );
}
