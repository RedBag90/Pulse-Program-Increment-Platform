import { Fragment } from "react";
import { Link } from "@/i18n/navigation";
import { FeaturePiSelect } from "@/features/art/components/feature-pi-select";
import type { PlanningFeature } from "./feature-planning-board";

export interface TablePi {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
  sprintCount: number;
}

interface Props {
  artId: string;
  canEdit: boolean;
  features: PlanningFeature[];
  pis: TablePi[];
}

const FEATURE_STATUS: Record<string, string> = {
  draft: "bg-muted text-foreground/80",
  in_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-primary/80",
  in_progress: "bg-indigo-100 text-indigo-800",
  blocked: "bg-red-100 text-red-800",
  done: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-muted text-muted-foreground line-through",
};

const PI_STATUS: Record<string, string> = {
  planned: "bg-muted text-foreground/80",
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-700",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Tabular PI-Planning view — merges the `/pi` and `/feature` information: rows
 * are grouped under Backlog and each PI, with a per-group header carrying the
 * PI's dates, status and counts. Each Feature row keeps an inline PI picker so
 * the table stays a planning surface.
 */
export function FeaturePlanningTable({ artId, canEdit, features, pis }: Props) {
  const assignablePis = pis
    .filter((p) => p.status !== "completed")
    .map((p) => ({ id: p.id, name: p.name }));

  const groups: { piId: string | null; pi: TablePi | null }[] = [
    { piId: null, pi: null },
    ...pis.map((pi) => ({ piId: pi.id as string | null, pi })),
  ];

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Feature</th>
            <th className="px-3 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="w-20 px-3 py-3 text-center font-medium text-muted-foreground">WSJF</th>
            <th className="px-3 py-3 text-left font-medium text-muted-foreground">Epic</th>
            <th className="px-3 py-3 text-left font-medium text-muted-foreground">PI</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const groupFeatures = features.filter((f) => f.piId === group.piId);
            const wsjfSum = round1(groupFeatures.reduce((s, f) => s + f.wsjf, 0));
            return (
              <Fragment key={group.piId ?? "__backlog__"}>
                <tr className="border-y bg-muted/40">
                  <td colSpan={5} className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold">{group.pi ? group.pi.name : "Backlog"}</span>
                      {group.pi && (
                        <>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              PI_STATUS[group.pi.status] ?? "bg-muted text-foreground/80"
                            }`}
                          >
                            {group.pi.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(group.pi.startDate)} – {formatDate(group.pi.endDate)}
                          </span>
                        </>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {group.pi ? `${group.pi.sprintCount} Sprints · ` : ""}
                        {groupFeatures.length} Feature{groupFeatures.length !== 1 ? "s" : ""} · Σ
                        WSJF {wsjfSum}
                      </span>
                    </div>
                  </td>
                </tr>

                {groupFeatures.length === 0 ? (
                  <tr className="border-b">
                    <td colSpan={5} className="px-4 py-3 text-xs text-muted-foreground/60">
                      Keine Features
                    </td>
                  </tr>
                ) : (
                  groupFeatures.map((f) => (
                    <tr key={f.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link
                          href={`/feature/${f.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {f.title}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                            FEATURE_STATUS[f.status] ?? "bg-muted text-foreground/80"
                          }`}
                        >
                          {f.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-primary/80">
                        {round1(f.wsjf)}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {f.epicTitle ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        {canEdit ? (
                          <FeaturePiSelect
                            featureId={f.id}
                            artId={artId}
                            currentPiId={f.piId}
                            pis={assignablePis}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {pis.find((p) => p.id === f.piId)?.name ?? "Backlog"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
