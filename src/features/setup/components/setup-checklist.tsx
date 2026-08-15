"use client";

import { useOptimistic, useTransition, useState } from "react";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Lock } from "lucide-react";
import { toggleSetupCheckAction } from "@/features/setup/actions/setup-progress";
import { MILESTONES, TOTAL_CHECKS, type Milestone } from "@/features/setup/data/milestones";

interface Props {
  /** Server-State: bereits abgehakte check.ids. */
  initialDone: string[];
  /** Schreib-Recht (Tenant-Admin). Andere sehen disabled-Boxes. */
  canEdit: boolean;
}

/**
 * Setup-Guide V0.2 — Server-State + Optimistic Toggle.
 *
 * Persistenz: Server (Tabelle `setup_progress`). Schreib-Recht ist auf
 * `tenant.users.manage` beschraenkt; andere User sehen Read-only.
 */
export function SetupChecklist({ initialDone, canEdit }: Props) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Server-Snapshot als Set fuer schnellen Lookup.
  const serverDone = new Set(initialDone);
  // Optimistic-Patches lagern auf dem Server-Snapshot. Bei Fehler revertet
  // React beim Ende der Transition automatisch zurueck.
  const [optimisticDone, applyOptimistic] = useOptimistic<Set<string>, string>(
    serverDone,
    (current, toggledId) => {
      const next = new Set(current);
      if (next.has(toggledId)) next.delete(toggledId);
      else next.add(toggledId);
      return next;
    },
  );

  const onToggle = (checkId: string) => {
    if (!canEdit) return;
    setError(null);
    startTransition(async () => {
      applyOptimistic(checkId);
      const fd = new FormData();
      fd.set("checkId", checkId);
      const res = await toggleSetupCheckAction({}, fd);
      if (res.error) setError(res.error);
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Setup-Guide</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acht Milestones, der Reihe nach abarbeiten. Tempo bestimmt das Team — Reihenfolge ist
            fix.
          </p>
        </div>
        <div className="rounded-full border bg-card px-3 py-1 text-sm font-medium tabular-nums">
          {optimisticDone.size} / {TOTAL_CHECKS} erledigt
        </div>
      </header>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Read-only-Sicht — nur der Tenant-Admin kann den Setup-Fortschritt aendern. Du siehst den
            gemeinsamen Stand des Tenants.
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {MILESTONES.map((m) => (
          <MilestoneCard
            key={m.id}
            milestone={m}
            done={optimisticDone}
            canEdit={canEdit}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

function MilestoneCard({
  milestone,
  done,
  canEdit,
  onToggle,
}: {
  milestone: Milestone;
  done: Set<string>;
  canEdit: boolean;
  onToggle: (id: string) => void;
}) {
  const completed = milestone.checks.filter((c) => done.has(c.id)).length;
  const total = milestone.checks.length;
  const allDone = completed === total;

  return (
    <Card
      data-tour={`setup-milestone-${milestone.id}`}
      className={`flex flex-col gap-3 p-4 ${allDone ? "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{milestone.name}</h2>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums">
          {completed} / {total}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">{milestone.outcome}</p>

      <dl className="grid grid-cols-[64px_1fr] gap-y-1 text-xs">
        <dt className="text-muted-foreground">Wer</dt>
        <dd>{milestone.who}</dd>
        <dt className="text-muted-foreground">Wo</dt>
        <dd className="space-y-0.5">
          {milestone.where.map((link) => (
            <Link
              key={link.href}
              href={link.href as never}
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              {link.label}
              <ArrowRight className="size-3" />
            </Link>
          ))}
        </dd>
      </dl>

      <ul className="space-y-1.5 border-t pt-3">
        {milestone.checks.map((check) => {
          const isDone = done.has(check.id);
          return (
            <li key={check.id}>
              <label
                className={`flex items-start gap-2 text-sm ${canEdit ? "cursor-pointer" : "cursor-default"}`}
              >
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => onToggle(check.id)}
                  disabled={!canEdit}
                  className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-60"
                />
                <span className={isDone ? "text-muted-foreground line-through" : ""}>
                  {check.label}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
