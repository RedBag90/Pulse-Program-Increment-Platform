"use client";

import { useActionState, startTransition, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { ZieleModel, ZieleKrContribution } from "@/server/views/ziele-view";
import {
  createObjectiveAction,
  updateObjectiveAction,
  deleteObjectiveAction,
  createKeyResultAction,
  updateKeyResultAction,
  deleteKeyResultAction,
} from "@/features/ziele/actions/ziele";
import { GoalDetailPanel } from "@/features/ziele/components/goal-status/goal-detail-panel";

/**
 * Ziele-Edit-Drawer — flach 2-Ebenen (Refactor §Hierarchie-Vereinfachung).
 *
 * Zwei Entitaeten in der UI: **Theme** (= Objective im Schema) und
 * **Key Result**. Vision + alter Strategic-Theme + Theme-Epic-Link
 * sind raus. URL-State:
 *
 *   ?entity=theme|kr&id=<uuid>            → Edit
 *   ?entity=theme|kr&new=1[&parent=<id>]  → Create (parent = Theme-Id fuer KR)
 *
 * KPI-Bindungen werden read-only angezeigt; Pflege im Controlling-Modul.
 */
type Entity = "theme" | "kr";

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
          {entity === "theme" && (
            <ThemePane model={model} id={isNew ? null : id} canEdit={canEdit} onClose={close} />
          )}
          {entity === "kr" && (
            <KeyResultPane
              model={model}
              id={isNew ? null : id}
              themeId={parentId}
              canEdit={canEdit}
              onClose={close}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Theme (= Objective) ──────────────────────────────────────────────

function ThemePane({
  model,
  id,
  canEdit,
  onClose,
}: {
  model: ZieleModel;
  id: string | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const theme = id ? model.themes.find((t) => t.id === id) : null;
  const [createState, createRun, createPending] = useActionState(createObjectiveAction, {});
  const [updateState, updateRun, updatePending] = useActionState(updateObjectiveAction, {});
  const [deleteState, deleteRun, deletePending] = useActionState(deleteObjectiveAction, {});

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
    if (!confirm("Theme loeschen? Verlinkte Key Results werden mitentfernt.")) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      deleteRun(fd);
      onClose();
    });
  }

  const themeProgress =
    theme && theme.trio.planned > 0
      ? Math.max(0, Math.min(1, theme.trio.realized / theme.trio.planned))
      : 0;

  const formNode = (
    <FormShell
      title={isNew ? "Neues Theme (OKR)" : (theme?.title ?? "Theme")}
      subtitle={isNew ? "Anlegen" : "Theme · OKR-Statement"}
      pending={pending}
      error={err}
      onSubmit={submit}
      onDelete={isNew ? null : remove}
      canEdit={canEdit}
    >
      <Field label="Titel (Objective-Statement)">
        <input
          name="title"
          defaultValue={theme?.title ?? ""}
          required
          className={INPUT}
          disabled={!canEdit}
          placeholder="z.B. Konversion verdoppeln"
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
        <Field label="Periode (YYYY-Qn)">
          <input
            name="period"
            defaultValue={theme?.period ?? ""}
            className={INPUT}
            disabled={!canEdit}
            placeholder="2026-Q2"
          />
        </Field>
        <Field label="Confidence (1-5)">
          <input
            name="confidence"
            type="number"
            min={0}
            max={5}
            defaultValue={theme?.confidence ?? ""}
            className={INPUT}
            disabled={!canEdit}
          />
        </Field>
      </div>
      <Field label="Fällig am">
        <input
          name="dueDate"
          type="date"
          defaultValue={theme?.dueDate ? theme.dueDate.slice(0, 10) : ""}
          className={INPUT}
          disabled={!canEdit}
        />
      </Field>
    </FormShell>
  );

  if (isNew || !id || !theme) return formNode;

  return (
    <div className="space-y-6">
      <header className="space-y-0.5 border-b pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Theme · OKR-Statement
        </p>
        <h2 className="font-heading text-xl font-semibold tracking-tight">{theme.title}</h2>
      </header>
      <GoalDetailPanel
        target="objective"
        id={id}
        status={theme.status}
        progress={themeProgress}
        currentValueLabel=""
        canEdit={canEdit}
      />
      <details className="rounded-lg border bg-muted/10 p-4">
        <summary className="cursor-pointer text-sm font-medium">Details bearbeiten</summary>
        <div className="mt-3">{formNode}</div>
      </details>
    </div>
  );
}

// ── Key Result ────────────────────────────────────────────────────────

function KeyResultPane({
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
      const kr = t.keyResults.find((x) => x.id === id);
      if (kr) return { theme: t, kr };
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
      if (themeId) fd.set("objectiveId", themeId);
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
          ? `Anlegen · Theme ${themeId ? "ausgewaehlt" : "?"}`
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
      <Field label="Fällig am">
        <input
          name="dueDate"
          type="date"
          defaultValue={kr?.dueDate ? kr.dueDate.slice(0, 10) : ""}
          className={INPUT}
          disabled={!canEdit}
        />
      </Field>
    </FormShell>
  );

  if (isNew || !id || !kr) {
    return <div className="space-y-5">{formNode}</div>;
  }

  const span = kr.target != null && kr.baseline != null ? kr.target - kr.baseline : null;
  const krProgress =
    span && kr.current != null ? Math.max(0, Math.min(1, (kr.current - kr.baseline!) / span)) : 0;
  const currentValueLabel =
    kr.current != null
      ? `${kr.current}${kr.target != null ? ` / ${kr.target}` : ""}${kr.metricUnit ? ` ${kr.metricUnit}` : ""}`
      : "—";

  return (
    <div className="space-y-6">
      <header className="space-y-0.5 border-b pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Key Result · {found?.theme.title ?? "—"}
        </p>
        <h2 className="font-heading text-xl font-semibold tracking-tight">{kr.title}</h2>
      </header>
      <GoalDetailPanel
        target="kr"
        id={id}
        status={kr.status}
        progress={krProgress}
        currentValueLabel={currentValueLabel}
        canEdit={canEdit}
        formula={kr.formula}
        krBaseline={kr.baseline}
        krTarget={kr.target}
        krCurrent={kr.current}
        metricUnit={kr.metricUnit}
      />
      <div className="rounded-lg border bg-muted/10 p-4">
        <KpiBindingsReadOnly contributions={kr.contributions} krId={id} />
      </div>
      <details className="rounded-lg border bg-muted/10 p-4">
        <summary className="cursor-pointer text-sm font-medium">Details bearbeiten</summary>
        <div className="mt-3">{formNode}</div>
      </details>
    </div>
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
