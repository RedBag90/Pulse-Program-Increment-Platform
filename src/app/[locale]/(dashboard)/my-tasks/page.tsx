import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listMyTasks, type MyTaskRow, type TaskLevel } from "@/server/services/my-tasks";
import {
  STAGE_GATE_LABELS,
  APPROVAL_PHASE_LABELS,
  APPROVAL_PHASE_BADGE,
  STATUS_LABELS,
  STATUS_DOT,
} from "@/components/detail/initiative-labels";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { StartFeatureButton } from "@/features/my-tasks/components/start-feature-button";

/**
 * "Meine Tasks" — the personal ownership inbox. Lists every Epic and Feature
 * the principal owns (or is an assignee on), split into Offen and Kürzlich
 * abgeschlossen. Read-only: each row links to the existing detail page.
 */

const LEVEL_LABELS: Record<TaskLevel, string> = {
  epic: "Epics",
  feature: "Features",
};

const LEVEL_ORDER: TaskLevel[] = ["epic", "feature"];

function fmtDate(d: Date): string {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Renders the state badges for an Epic (phase + stage gate) or a Feature (status). */
function StateBadges({ row }: { row: MyTaskRow }) {
  if (row.level === "epic") {
    const phase = row.state.approvalPhase ?? "draft";
    const phaseLabel = APPROVAL_PHASE_LABELS[phase] ?? phase;
    const phaseClass = APPROVAL_PHASE_BADGE[phase] ?? "bg-muted text-foreground/80";
    const gate = row.state.stageGate ?? "L0";
    const gateLabel = STAGE_GATE_LABELS[gate] ?? gate;
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-xs ${phaseClass}`}>{phaseLabel}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {gateLabel}
        </span>
      </div>
    );
  }
  const status = row.state.status ?? "draft";
  const dot = STATUS_DOT[status] ?? "bg-muted-foreground/40";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} aria-hidden />
      <span>{label}</span>
    </div>
  );
}

/** A single context line: Value Stream · ART · Parent Epic · PI. */
function ContextLine({ row }: { row: MyTaskRow }) {
  const bits: string[] = [];
  if (row.context.valueStreamName) bits.push(row.context.valueStreamName);
  if (row.context.artName) bits.push(row.context.artName);
  if (row.context.parentEpicTitle) bits.push(row.context.parentEpicTitle);
  if (row.context.piName) bits.push(row.context.piName);
  return (
    <p className="text-xs text-muted-foreground">{bits.length > 0 ? bits.join(" · ") : "—"}</p>
  );
}

function Row({ row }: { row: MyTaskRow }) {
  return (
    <div className="grid gap-4 px-4 py-3 md:grid-cols-[1fr_auto] md:items-start">
      <div className="min-w-0 space-y-1">
        <Link href={row.href} className="font-medium text-primary hover:underline">
          {row.title}
        </Link>
        <ContextLine row={row} />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {row.bucket === "ready" ? (
          <StartFeatureButton featureId={row.id} />
        ) : (
          <StateBadges row={row} />
        )}
        <span className="text-xs text-muted-foreground">aktualisiert {fmtDate(row.updatedAt)}</span>
      </div>
    </div>
  );
}

export default async function MyTasksPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const rows = await listMyTasks(db, principal);

  const byLevel = new Map<
    TaskLevel,
    { open: MyTaskRow[]; ready: MyTaskRow[]; done: MyTaskRow[] }
  >();
  for (const r of rows) {
    const slot = byLevel.get(r.level) ?? { open: [], ready: [], done: [] };
    slot[r.bucket].push(r);
    byLevel.set(r.level, slot);
  }

  const empty = rows.length === 0;

  return (
    <main className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Meine Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alle Epics und Features, die dir aktuell zugeordnet sind — geordnet nach letzter
          Aktualisierung.
        </p>
      </div>

      {empty ? (
        <div className="rounded-lg border bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">Aktuell keine zugeordneten Aufgaben.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {LEVEL_ORDER.filter((lvl) => {
            const g = byLevel.get(lvl);
            return g && g.open.length + g.ready.length + g.done.length > 0;
          }).map((lvl) => {
            const group = byLevel.get(lvl)!;
            const totalOffen = group.open.length + group.ready.length;
            return (
              <section key={lvl} className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {LEVEL_LABELS[lvl]}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {totalOffen} offen
                    {group.done.length > 0 ? ` · ${group.done.length} kürzlich abgeschlossen` : ""}
                  </span>
                </div>

                {group.ready.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-700">
                      Bereit zu starten ({group.ready.length})
                    </p>
                    <div className="divide-y rounded-lg border border-emerald-200 bg-emerald-50/30">
                      {group.ready.map((row) => (
                        <Row key={row.id} row={row} />
                      ))}
                    </div>
                  </div>
                )}

                {group.open.length > 0 ? (
                  <div className="divide-y rounded-lg border">
                    {group.open.map((row) => (
                      <Row key={row.id} row={row} />
                    ))}
                  </div>
                ) : group.ready.length === 0 ? (
                  <p className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                    Keine offenen {LEVEL_LABELS[lvl]}.
                  </p>
                ) : null}

                {group.done.length > 0 && (
                  <details className="rounded-lg border">
                    <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/30">
                      Kürzlich abgeschlossen ({group.done.length})
                    </summary>
                    <div className="divide-y border-t">
                      {group.done.map((row) => (
                        <Row key={row.id} row={row} />
                      ))}
                    </div>
                  </details>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
