"use client";

import { useActionState, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Pencil } from "lucide-react";
import type { SolutionDetailModel } from "@/modules/work/server/views/solution-detail";
import {
  setSolutionLifecycleAction,
  promoteSolutionAction,
  setSolutionRunAction,
} from "@/modules/work/features/portfolio/actions/solution";
import { PROMOTION_CRITERIA } from "@/modules/work/domain/solution";
import { type Horizon } from "@/modules/work/domain/portfolio-guardrails";
import { HorizonBadge } from "@/modules/work/features/portfolio/components/horizon-badge";
import { CreateSolutionDialog } from "./create-solution-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCompactEUR } from "@/lib/formatting";
import { STAGE_SHORT } from "@/components/detail/initiative-labels";

const EUR = (n: number) => formatCompactEUR(n);

/** Erlaubte Lifecycle-Übergänge je aktuellem Horizont (vor-/rückwärts). */
const TRANSITIONS: Record<Horizon, { to: Horizon; label: string; gate?: boolean }[]> = {
  h3: [{ to: "h2", label: "Nach H2 (Emerging)" }],
  h2: [
    { to: "h1", label: "Nach H1 befördern", gate: true },
    { to: "h3", label: "Zurück zu H3" },
  ],
  h1: [
    { to: "h0", label: "Stilllegen (H0)" },
    { to: "h2", label: "Zurück zu H2" },
  ],
  h0: [{ to: "h1", label: "Reaktivieren (H1)" }],
};

export function SolutionDetailView({
  model,
  canManage,
}: {
  model: SolutionDetailModel;
  canManage: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Kopf */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold tracking-tight">{model.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{model.valueStreamName ?? "—"}</span>
            <span>·</span>
            <span>{model.artName ?? "kein ART"}</span>
            <span>·</span>
            <HorizonBadge horizon={model.horizon} investmentMode={model.investmentMode} withHelp />
          </div>
          {model.description && <p className="mt-2 max-w-2xl text-sm">{model.description}</p>}
        </div>
        {canManage && (
          <>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 size-3.5" />
              Bearbeiten
            </Button>
            <CreateSolutionDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              solution={{
                id: model.id,
                name: model.name,
                description: model.description,
                valueStreamId: model.valueStreamId,
                artId: model.artId,
                horizon: model.horizon,
                investmentMode: model.investmentMode,
              }}
            />
          </>
        )}
      </div>

      {/* Lifecycle */}
      <LifecycleCard model={model} canManage={canManage} onOpenGate={() => setGateOpen(true)} />

      {/* Run/Grow */}
      <RunGrowCard model={model} canManage={canManage} />

      {/* Epics */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Zugeordnete Epics (Primär)
        </h2>
        {model.epics.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Noch keine Epics dieser Solution zugeordnet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {model.epics.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/portfolio/epics/${e.id}`} className="font-medium hover:underline">
                  {e.title}
                </Link>
                <span className="flex items-center gap-3">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {STAGE_SHORT[e.stageGate as keyof typeof STAGE_SHORT] ?? e.stageGate}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{e.cost > 0 ? EUR(e.cost) : "—"}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && (
        <TransitionGateDialog solutionId={model.id} open={gateOpen} onOpenChange={setGateOpen} />
      )}
    </div>
  );
}

function LifecycleCard({
  model,
  canManage,
  onOpenGate,
}: {
  model: SolutionDetailModel;
  canManage: boolean;
  onOpenGate: () => void;
}) {
  const [, lifecycleAction] = useActionState(setSolutionLifecycleAction, {});
  const [, runAction] = useActionState(setSolutionRunAction, {});
  const order: Horizon[] = ["h3", "h2", "h1", "h0"];

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lifecycle</h2>

      {/* Stepper */}
      <div className="mt-3 flex items-center gap-1">
        {order.map((h, i) => (
          <div key={h} className="flex flex-1 items-center gap-1">
            <div
              className={`flex-1 text-center ${h === model.horizon ? "" : "opacity-45"}`}
            >
              <HorizonBadge horizon={h} />
            </div>
            {i < order.length - 1 && <div className="h-px w-4 shrink-0 bg-border" />}
          </div>
        ))}
      </div>

      {canManage && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {TRANSITIONS[model.horizon].map((t) =>
            t.gate ? (
              <Button key={t.to} size="sm" onClick={onOpenGate}>
                {t.label}
              </Button>
            ) : (
              <form key={t.to} action={lifecycleAction}>
                <input type="hidden" name="id" value={model.id} />
                <input type="hidden" name="horizon" value={t.to} />
                <Button type="submit" size="sm" variant="outline">
                  {t.label}
                </Button>
              </form>
            ),
          )}

          {/* Invest/Extract nur in H1 */}
          {model.horizon === "h1" && (
            <div className="ml-auto inline-flex overflow-hidden rounded-md border text-xs">
              {(["investing", "extracting"] as const).map((mode) => (
                <form key={mode} action={runAction}>
                  <input type="hidden" name="id" value={model.id} />
                  <input type="hidden" name="investmentMode" value={mode} />
                  <button
                    type="submit"
                    className={`px-3 py-1.5 font-medium ${
                      model.investmentMode === mode
                        ? "bg-blue-600 text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "investing" ? "Investing" : "Extracting"}
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function RunGrowCard({ model, canManage }: { model: SolutionDetailModel; canManage: boolean }) {
  const [state, runAction, pending] = useActionState(setSolutionRunAction, {});
  const run = model.run ?? 0;
  const total = model.grow + run;
  const growPct = total > 0 ? Math.round((model.grow / total) * 100) : 0;

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Grow · aktive Primär-Epics
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">
          {model.grow > 0 ? EUR(model.grow) : "—"}
        </div>
        <div className="text-xs text-muted-foreground">Σ Umsetzungskosten (Stage &lt; L5)</div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Run · Baseline p.a.
        </div>
        {canManage ? (
          <form action={runAction} className="mt-2 flex items-center gap-2">
            <input type="hidden" name="id" value={model.id} />
            <Input
              name="runBaselineAmount"
              type="number"
              min={0}
              step={1000}
              defaultValue={model.run ?? ""}
              className="h-8 w-36 text-right tabular-nums"
            />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "…" : "Speichern"}
            </Button>
          </form>
        ) : (
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {model.run != null ? EUR(model.run) : "—"}
          </div>
        )}
        {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Grow : Run</span>
          <span className="normal-case text-muted-foreground">
            {growPct}% / {100 - growPct}%
          </span>
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-blue-600" style={{ width: `${growPct}%` }} />
          <div className="h-full bg-slate-400" style={{ width: `${100 - growPct}%` }} />
        </div>
      </div>
    </section>
  );
}

function TransitionGateDialog({
  solutionId,
  open,
  onOpenChange,
}: {
  solutionId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [state, action, pending] = useActionState(promoteSolutionAction, {});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allChecked = PROMOTION_CRITERIA.every((c) => checked[c.key]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Solution nach H1 befördern</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Alle Kriterien bestätigen, um die Solution zur dauerhaften Kern-Solution (H1) zu machen.
        </p>
        <form action={action} className="mt-2 space-y-2">
          <input type="hidden" name="id" value={solutionId} />
          {PROMOTION_CRITERIA.map((c) => (
            <label
              key={c.key}
              className="flex items-start gap-2 rounded-md border p-2 text-sm"
            >
              <input
                type="checkbox"
                name={c.key}
                checked={checked[c.key] ?? false}
                onChange={(e) => setChecked((p) => ({ ...p, [c.key]: e.target.checked }))}
                className="mt-0.5 size-4 accent-blue-600"
              />
              {c.label}
            </label>
          ))}
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={!allChecked || pending}>
              {pending ? "…" : "Befördern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
