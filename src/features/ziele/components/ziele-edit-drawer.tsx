"use client";

import { useActionState, startTransition, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { ZieleModel } from "@/server/views/ziele-view";
import {
  createThemeAction,
  updateThemeAction,
  deleteThemeAction,
  createObjectiveAction,
  updateObjectiveAction,
  deleteObjectiveAction,
  createKeyResultAction,
  updateKeyResultAction,
  deleteKeyResultAction,
  createVisionAction,
  updateVisionAction,
  bindKpiAction,
  unbindKpiAction,
  linkEpicAction,
  unlinkEpicAction,
} from "@/features/ziele/actions/ziele";
import type {
  ZieleEpicLibraryEntry,
  ZieleEpicLink,
  ZieleKpiLibraryEntry,
  ZieleKrContribution,
} from "@/server/views/ziele-view";

/**
 * Ziele-Edit-Drawer (Konzept §4.1 / V3-V5). URL-State steuert was offen ist:
 *   ?entity=theme|objective|kr|vision&id=<uuid>            → Edit
 *   ?entity=theme|objective|kr|vision&new=1[&parent=<id>]  → Create
 *
 * Phase-1 zeigt einen Overview-Tab mit den editierbaren Kernfeldern; die
 * weiteren Tabs (KPIs / Epics / History) kommen mit den Folge-Phasen.
 */
type Entity = "theme" | "objective" | "kr" | "vision";

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
      <SheetContent side="right" className="!max-w-xl overflow-y-auto p-0 sm:!max-w-xl">
        <div className="p-5">
          {entity === "theme" && (
            <ThemePane
              model={model}
              id={isNew ? null : id}
              visionId={parentId}
              canEdit={canEdit}
              onClose={close}
            />
          )}
          {entity === "objective" && (
            <ObjectivePane
              model={model}
              id={isNew ? null : id}
              themeId={parentId}
              canEdit={canEdit}
              onClose={close}
            />
          )}
          {entity === "kr" && (
            <KeyResultPane
              model={model}
              id={isNew ? null : id}
              objectiveId={parentId}
              canEdit={canEdit}
              onClose={close}
            />
          )}
          {entity === "vision" && (
            <VisionPane model={model} id={isNew ? null : id} canEdit={canEdit} onClose={close} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Theme ─────────────────────────────────────────────────────────────

function ThemePane({
  model,
  id,
  visionId,
  canEdit,
  onClose,
}: {
  model: ZieleModel;
  id: string | null;
  visionId: string | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const theme = id ? model.themes.find((t) => t.id === id) : null;
  const [createState, createRun, createPending] = useActionState(createThemeAction, {});
  const [updateState, updateRun, updatePending] = useActionState(updateThemeAction, {});
  const [deleteState, deleteRun, deletePending] = useActionState(deleteThemeAction, {});

  const isNew = !id;
  const pending = createPending || updatePending || deletePending;
  const err = createState.error || updateState.error || deleteState.error;

  function submit(fd: FormData) {
    if (isNew) startTransition(() => createRun(fd));
    else {
      fd.set("id", id);
      startTransition(() => updateRun(fd));
    }
  }

  function remove() {
    if (!id) return;
    if (!confirm("Theme loeschen? Verlinkte Objectives bleiben Waisen.")) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      deleteRun(fd);
      onClose();
    });
  }

  const formNode = (
    <FormShell
      title={isNew ? "Neues Strategic Theme" : (theme?.title ?? "Theme")}
      subtitle={isNew ? "Anlegen" : `Theme · ${theme?.kind ?? "—"}`}
      pending={pending}
      error={err}
      onSubmit={submit}
      onDelete={isNew ? null : remove}
      canEdit={canEdit}
    >
      <Field label="Titel">
        <input
          name="title"
          defaultValue={theme?.title ?? ""}
          required
          className={INPUT}
          disabled={!canEdit}
        />
      </Field>
      <Field label="Narrativ">
        <textarea
          name="narrative"
          defaultValue={theme?.narrative ?? ""}
          rows={3}
          className={TEXTAREA}
          disabled={!canEdit}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kind">
          <select
            name="kind"
            defaultValue={theme?.kind ?? "business"}
            className={INPUT}
            disabled={!canEdit}
          >
            <option value="business">business</option>
            <option value="enabler">enabler</option>
          </select>
        </Field>
        <Field label="Color">
          <input
            type="color"
            name="color"
            defaultValue={theme?.color ?? "#6366f1"}
            className="h-9 w-full rounded-md border bg-transparent"
            disabled={!canEdit}
          />
        </Field>
      </div>
      <Field label="Budget Planned (€/Jahr)">
        <input
          name="budgetPlanned"
          type="number"
          step="any"
          defaultValue={theme?.budgetPlanned ?? ""}
          className={INPUT}
          disabled={!canEdit}
        />
      </Field>
      <Field label="Vision">
        <select
          name="visionId"
          defaultValue={theme?.visionId ?? visionId ?? ""}
          className={INPUT}
          disabled={!canEdit}
        >
          <option value="">— ohne Vision —</option>
          {model.visions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>
      </Field>
    </FormShell>
  );

  return (
    <div className="space-y-5">
      {formNode}
      {!isNew && id && theme && (
        <div className="rounded-lg border bg-muted/10 p-4">
          <ThemeEpicSection
            themeId={id}
            linked={theme.linkedEpics}
            library={model.epicLibrary}
            canEdit={canEdit}
          />
        </div>
      )}
    </div>
  );
}

// ── Theme ↔ Epic Links (V3 Tab „Epics") ──────────────────────────────

function ThemeEpicSection({
  themeId,
  linked,
  library,
  canEdit,
}: {
  themeId: string;
  linked: ZieleEpicLink[];
  library: ZieleEpicLibraryEntry[];
  canEdit: boolean;
}) {
  const boundIds = new Set(linked.map((l) => l.epicId));
  const available = library.filter((e) => !boundIds.has(e.id));

  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Verlinkte Epics
        </h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">{linked.length}</span>
      </header>

      {linked.length === 0 && (
        <p className="text-xs text-muted-foreground">Noch keine Epics verlinkt.</p>
      )}

      <ul className="space-y-1.5">
        {linked.map((l) => (
          <EpicLinkRow key={l.epicId} themeId={themeId} link={l} canEdit={canEdit} />
        ))}
      </ul>

      {canEdit && available.length > 0 && <EpicPickerRow themeId={themeId} options={available} />}
      {canEdit && available.length === 0 && linked.length > 0 && (
        <p className="text-[11px] text-muted-foreground">Alle Tenant-Epics sind verlinkt.</p>
      )}
    </section>
  );
}

function EpicLinkRow({
  themeId,
  link,
  canEdit,
}: {
  themeId: string;
  link: ZieleEpicLink;
  canEdit: boolean;
}) {
  const [state, run, pending] = useActionState(unlinkEpicAction, {});

  function unlink() {
    if (!confirm(`„${link.epicTitle}" entkoppeln?`)) return;
    const fd = new FormData();
    fd.set("themeId", themeId);
    fd.set("epicId", link.epicId);
    startTransition(() => run(fd));
  }

  return (
    <li className="flex items-center gap-3 rounded-md border bg-card px-2 py-1.5 text-xs">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{link.epicTitle}</p>
        <p className="text-[10px] text-muted-foreground">Status · {link.epicStatus}</p>
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={unlink}
          disabled={pending}
          className="rounded-md border px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          Entfernen
        </button>
      )}
      {state.error && <span className="text-[10px] text-destructive">{state.error}</span>}
    </li>
  );
}

function EpicPickerRow({
  themeId,
  options,
}: {
  themeId: string;
  options: ZieleEpicLibraryEntry[];
}) {
  const [state, run, pending] = useActionState(linkEpicAction, {});

  function submit(fd: FormData) {
    fd.set("themeId", themeId);
    startTransition(() => run(fd));
  }

  return (
    <form
      action={submit}
      className="flex items-center gap-2 rounded-md border border-dashed bg-card/50 p-2"
    >
      <select
        name="epicId"
        required
        defaultValue=""
        disabled={pending}
        className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
      >
        <option value="" disabled>
          + Epic verlinken …
        </option>
        {options.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title} · {e.status}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        Hinzufuegen
      </button>
      {state.error && <span className="text-[10px] text-destructive">{state.error}</span>}
    </form>
  );
}

// ── Objective ─────────────────────────────────────────────────────────

function ObjectivePane({
  model,
  id,
  themeId,
  canEdit,
  onClose,
}: {
  model: ZieleModel;
  id: string | null;
  themeId: string | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const found = useMemo(() => {
    if (!id) return null;
    for (const t of model.themes) {
      const o = t.objectives.find((x) => x.id === id);
      if (o) return { theme: t, objective: o };
    }
    return null;
  }, [model, id]);

  const [createState, createRun, createPending] = useActionState(createObjectiveAction, {});
  const [updateState, updateRun, updatePending] = useActionState(updateObjectiveAction, {});
  const [deleteState, deleteRun, deletePending] = useActionState(deleteObjectiveAction, {});

  const isNew = !id;
  const pending = createPending || updatePending || deletePending;
  const err = createState.error || updateState.error || deleteState.error;
  const o = found?.objective;

  function submit(fd: FormData) {
    if (isNew) {
      if (themeId) fd.set("themeId", themeId);
      startTransition(() => createRun(fd));
    } else {
      fd.set("id", id);
      startTransition(() => updateRun(fd));
    }
  }

  function remove() {
    if (!id) return;
    if (!confirm("Objective loeschen?")) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      deleteRun(fd);
      onClose();
    });
  }

  return (
    <FormShell
      title={isNew ? "Neues Objective" : (o?.title ?? "Objective")}
      subtitle={
        isNew
          ? `Anlegen · Theme ${model.themes.find((t) => t.id === themeId)?.title ?? "?"}`
          : `Theme ${found?.theme.title ?? "—"}`
      }
      pending={pending}
      error={err}
      onSubmit={submit}
      onDelete={isNew ? null : remove}
      canEdit={canEdit}
    >
      <Field label="Titel">
        <input
          name="title"
          defaultValue={o?.title ?? ""}
          required
          className={INPUT}
          disabled={!canEdit}
        />
      </Field>
      <Field label="Narrativ">
        <textarea
          name="narrative"
          defaultValue={o?.narrative ?? ""}
          rows={3}
          className={TEXTAREA}
          disabled={!canEdit}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Periode (z. B. Q2-2026)">
          <input
            name="period"
            defaultValue={o?.period ?? ""}
            className={INPUT}
            disabled={!canEdit}
            placeholder="Q2-2026"
          />
        </Field>
        <Field label="Confidence (1-5)">
          <input
            name="confidence"
            type="number"
            min={0}
            max={5}
            defaultValue={o?.confidence ?? ""}
            className={INPUT}
            disabled={!canEdit}
          />
        </Field>
      </div>
      {!isNew && (
        <Field label="Status">
          <select
            name="status"
            defaultValue={o?.status ?? "active"}
            className={INPUT}
            disabled={!canEdit}
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="achieved">achieved</option>
            <option value="missed">missed</option>
            <option value="stretched">stretched</option>
            <option value="cancelled">cancelled</option>
          </select>
        </Field>
      )}
    </FormShell>
  );
}

// ── KeyResult ─────────────────────────────────────────────────────────

function KeyResultPane({
  model,
  id,
  objectiveId,
  canEdit,
  onClose,
}: {
  model: ZieleModel;
  id: string | null;
  objectiveId: string | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const found = useMemo(() => {
    if (!id) return null;
    for (const t of model.themes) {
      for (const o of t.objectives) {
        const kr = o.keyResults.find((x) => x.id === id);
        if (kr) return { theme: t, objective: o, kr };
      }
    }
    return null;
  }, [model, id]);

  const [createState, createRun, createPending] = useActionState(createKeyResultAction, {});
  const [updateState, updateRun, updatePending] = useActionState(updateKeyResultAction, {});
  const [deleteState, deleteRun, deletePending] = useActionState(deleteKeyResultAction, {});

  const isNew = !id;
  const pending = createPending || updatePending || deletePending;
  const err = createState.error || updateState.error || deleteState.error;
  const kr = found?.kr;

  function submit(fd: FormData) {
    if (isNew) {
      if (objectiveId) fd.set("objectiveId", objectiveId);
      startTransition(() => createRun(fd));
    } else {
      fd.set("id", id);
      startTransition(() => updateRun(fd));
    }
  }

  function remove() {
    if (!id) return;
    if (!confirm("Key Result loeschen?")) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      deleteRun(fd);
      onClose();
    });
  }

  const formNode = (
    <FormShell
      title={isNew ? "Neues Key Result" : (kr?.title ?? "KR")}
      subtitle={
        isNew
          ? `Anlegen · Objective ${objectiveId ? "ausgewaehlt" : "?"}`
          : `Objective ${found?.objective.title ?? "—"}`
      }
      pending={pending}
      error={err}
      onSubmit={submit}
      onDelete={isNew ? null : remove}
      canEdit={canEdit}
    >
      <Field label="Titel">
        <input
          name="title"
          defaultValue={kr?.title ?? ""}
          required
          className={INPUT}
          disabled={!canEdit}
        />
      </Field>
      <Field label="Einheit">
        <input
          name="metricUnit"
          defaultValue={kr?.metricUnit ?? ""}
          className={INPUT}
          disabled={!canEdit}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Baseline">
          <input
            name="baseline"
            type="number"
            step="any"
            defaultValue={kr?.baseline ?? ""}
            className={INPUT}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Target">
          <input
            name="target"
            type="number"
            step="any"
            defaultValue={kr?.target ?? ""}
            className={INPUT}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Aktuell">
          <input
            name="current"
            type="number"
            step="any"
            defaultValue={kr?.current ?? ""}
            className={INPUT}
            disabled={!canEdit || kr?.formula === "auto_from_kpi"}
            title={kr?.formula === "auto_from_kpi" ? "Aus KPI aggregiert" : undefined}
          />
        </Field>
      </div>
      <Field label="Formel">
        <select
          name="formula"
          defaultValue={kr?.formula ?? "manual"}
          className={INPUT}
          disabled={!canEdit}
        >
          <option value="manual">manuell</option>
          <option value="auto_from_kpi">aus KPI aggregiert</option>
        </select>
      </Field>
    </FormShell>
  );

  return (
    <div className="space-y-5">
      {formNode}
      {/* prettier-ignore */}
      {!isNew && id && kr && (
        <div className="rounded-lg border bg-muted/10 p-4">
          <KrKpiSection
            keyResultId={id}
            contributions={kr.contributions}
            library={model.kpiLibrary}
            canEdit={canEdit}
          />
        </div>
      )}
    </div>
  );
}

// ── KR ↔ KPI Bindungen (V5) ──────────────────────────────────────────

function KrKpiSection({
  keyResultId,
  contributions,
  library,
  canEdit,
}: {
  keyResultId: string;
  contributions: ZieleKrContribution[];
  library: ZieleKpiLibraryEntry[];
  canEdit: boolean;
}) {
  const boundIds = new Set(contributions.map((c) => c.kpiId));
  const available = library.filter((k) => !boundIds.has(k.id));
  const weightSum = contributions.reduce(
    (s, c) => s + (Number.isFinite(c.weight) ? c.weight : 0),
    0,
  );

  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          KPI-Bindungen
        </h3>
        <span
          className={`text-[11px] tabular-nums ${
            Math.abs(weightSum - 1) < 0.001 ? "text-emerald-600" : "text-amber-600"
          }`}
          title="Soll-Summe 100 %"
        >
          Σ Weights {(weightSum * 100).toFixed(0)} %
        </span>
      </header>

      {contributions.length === 0 && (
        <p className="text-xs text-muted-foreground">Noch keine KPI gebunden.</p>
      )}

      <ul className="space-y-2">
        {contributions.map((c) => (
          <ContributionRow key={c.kpiId} keyResultId={keyResultId} c={c} canEdit={canEdit} />
        ))}
      </ul>

      {canEdit && available.length > 0 && (
        <PickerRow keyResultId={keyResultId} options={available} />
      )}
      {canEdit && available.length === 0 && (
        <p className="text-[11px] text-muted-foreground">Alle Tenant-KPIs sind bereits gebunden.</p>
      )}
    </section>
  );
}

function ContributionRow({
  keyResultId,
  c,
  canEdit,
}: {
  keyResultId: string;
  c: ZieleKrContribution;
  canEdit: boolean;
}) {
  const [bindState, bindRun, bindPending] = useActionState(bindKpiAction, {});
  const [unbindState, unbindRun, unbindPending] = useActionState(unbindKpiAction, {});
  const pending = bindPending || unbindPending;
  const err = bindState.error || unbindState.error;

  function rebind(fd: FormData) {
    fd.set("keyResultId", keyResultId);
    fd.set("kpiId", c.kpiId);
    startTransition(() => bindRun(fd));
  }

  function unbind() {
    if (!confirm(`„${c.kpiName}" entkoppeln?`)) return;
    const fd = new FormData();
    fd.set("keyResultId", keyResultId);
    fd.set("kpiId", c.kpiId);
    startTransition(() => unbindRun(fd));
  }

  return (
    <li className="rounded-md border bg-card p-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{c.kpiName}</p>
          <p className="truncate text-[10px] text-muted-foreground">Epic · {c.epicTitle}</p>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {c.achievement != null
            ? `${Math.round(c.achievement * 100)}% · €${Math.round(c.contributionRealized).toLocaleString("de-DE")}`
            : "—"}
        </span>
      </div>
      <form action={rebind} className="mt-2 flex items-center gap-2">
        <label className="flex-1">
          <span className="block text-[10px] uppercase text-muted-foreground">Weight</span>
          <input
            name="weight"
            type="number"
            step="0.05"
            min={0}
            max={1}
            defaultValue={c.weight}
            disabled={!canEdit || pending}
            className="h-7 w-full rounded-md border bg-background px-2 text-xs tabular-nums"
          />
        </label>
        <label className="flex-1">
          <span className="block text-[10px] uppercase text-muted-foreground">€/Unit Override</span>
          <input
            name="valuePerUnitOverride"
            type="number"
            step="any"
            defaultValue={c.valuePerUnitOverride ?? ""}
            placeholder="—"
            disabled={!canEdit || pending}
            className="h-7 w-full rounded-md border bg-background px-2 text-xs tabular-nums"
          />
        </label>
        {canEdit && (
          <button
            type="submit"
            disabled={pending}
            className="h-7 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Speichern
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={unbind}
            disabled={pending}
            className="h-7 rounded-md border px-2 text-[11px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            Entfernen
          </button>
        )}
      </form>
      {err && <p className="mt-1 text-[10px] text-destructive">{err}</p>}
    </li>
  );
}

function PickerRow({
  keyResultId,
  options,
}: {
  keyResultId: string;
  options: ZieleKpiLibraryEntry[];
}) {
  const [state, run, pending] = useActionState(bindKpiAction, {});

  function submit(fd: FormData) {
    fd.set("keyResultId", keyResultId);
    if (!fd.get("weight")) fd.set("weight", "1");
    startTransition(() => run(fd));
  }

  return (
    <form
      action={submit}
      className="flex items-center gap-2 rounded-md border border-dashed bg-card/50 p-2"
    >
      <select
        name="kpiId"
        required
        defaultValue=""
        disabled={pending}
        className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
      >
        <option value="" disabled>
          + KPI binden …
        </option>
        {options.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name} · {k.epicTitle}
            {k.valuePerUnit != null ? ` · €${k.valuePerUnit}/Unit` : ""}
          </option>
        ))}
      </select>
      <input
        name="weight"
        type="number"
        step="0.05"
        min={0}
        max={1}
        defaultValue="1"
        disabled={pending}
        className="h-8 w-20 rounded-md border bg-background px-2 text-xs tabular-nums"
        placeholder="Weight"
        title="Weight 0..1"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        Hinzufuegen
      </button>
      {state.error && <span className="text-[10px] text-destructive">{state.error}</span>}
    </form>
  );
}

// ── Vision ────────────────────────────────────────────────────────────

function VisionPane({
  model,
  id,
  canEdit,
  onClose: _onClose,
}: {
  model: ZieleModel;
  id: string | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const vision = id ? model.visions.find((v) => v.id === id) : null;
  const [createState, createRun, createPending] = useActionState(createVisionAction, {});
  const [updateState, updateRun, updatePending] = useActionState(updateVisionAction, {});

  const isNew = !id;
  const pending = createPending || updatePending;
  const err = createState.error || updateState.error;

  function submit(fd: FormData) {
    if (isNew) {
      fd.set("scope", "tenant");
      startTransition(() => createRun(fd));
    } else {
      fd.set("id", id);
      startTransition(() => updateRun(fd));
    }
  }

  const horizonDefault = (d: Date | undefined) => (d ? d.toISOString().slice(0, 10) : "");

  return (
    <FormShell
      title={isNew ? "Neue Vision" : (vision?.title ?? "Vision")}
      subtitle={isNew ? "Anlegen · Tenant-Scope" : `Vision · ${vision?.scope ?? "—"}`}
      pending={pending}
      error={err}
      onSubmit={submit}
      onDelete={null}
      canEdit={canEdit}
    >
      <Field label="Titel">
        <input
          name="title"
          defaultValue={vision?.title ?? ""}
          required
          className={INPUT}
          disabled={!canEdit}
        />
      </Field>
      <Field label="Narrativ">
        <textarea
          name="narrative"
          defaultValue={vision?.narrative ?? ""}
          rows={4}
          className={TEXTAREA}
          disabled={!canEdit}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Horizont-Start">
          <input
            type="date"
            name="horizonStart"
            defaultValue={horizonDefault(vision?.horizonStart)}
            required
            className={INPUT}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Horizont-Ende">
          <input
            type="date"
            name="horizonEnd"
            defaultValue={horizonDefault(vision?.horizonEnd)}
            required
            className={INPUT}
            disabled={!canEdit}
          />
        </Field>
      </div>
    </FormShell>
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
