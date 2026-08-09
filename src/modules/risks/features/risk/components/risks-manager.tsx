"use client";

import { useActionState } from "react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { Button } from "@/components/ui/button";
import { PageSection } from "@/components/layout";
import type { RisksListModel, RiskListRow } from "@/modules/risks/server/views/risks-list";
import {
  ROAM_DOT,
  ROAM_LABELS,
  ROAM_STATUSES,
  type RoamStatus,
} from "@/modules/core/kernel/domain/roam";
import { CreateRiskDialog } from "@/modules/risks/features/risk/components/create-risk-dialog";
import { RiskMatrix } from "@/modules/risks/features/risk/components/risk-matrix";
import { RiskSettingsDialog } from "@/modules/risks/features/risk/components/risk-settings-dialog";
import {
  RiskDetailDrawer,
  type RiskCaps,
} from "@/modules/risks/features/risk/components/risk-detail-drawer";
import { reviewRiskAction } from "@/modules/risks/features/risk/actions/risk";
import type { ActionState } from "@/server/http/server-action";
import {
  BAND_BADGE,
  BAND_LABEL,
  CATEGORY_LABELS,
} from "@/modules/risks/features/risk/components/labels";
import type { ExposureBand } from "@/modules/risks/domain/risk-matrix";
import type { RiskCategory } from "@/modules/risks/domain/risk-category";

interface Props {
  model: RisksListModel;
  prefix: string;
  userLabels: Record<string, string>;
  caps: RiskCaps;
  /** When set, create pre-links to this Epic (Epic Risks tab). */
  epicId?: string;
}

export function RisksManager({ model, prefix, userLabels, caps, epicId }: Props) {
  const { push } = useUrlState();
  const allRows = [...model.rows, ...model.suggestions];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <RoamSummary funnel={model.roamFunnel} />
        <div className="flex items-center gap-2">
          {caps.canManageSettings && <RiskSettingsDialog prefix={prefix} />}
          <CreateRiskDialog canDocument={caps.canDocument} {...(epicId ? { epicId } : {})} />
        </div>
      </div>

      <PageSection title="Risk-Matrix">
        <RiskMatrix cells={model.matrix.cells} plots={model.matrix.plots} />
        {model.unscored.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {model.unscored.length} unbewertete(s) Risiko — im Detail bewerten, damit es in der
            Matrix erscheint.
          </p>
        )}
      </PageSection>

      {caps.canReview && model.suggestions.length > 0 && (
        <PageSection title={`Vorschläge (${model.suggestions.length})`}>
          <ul className="divide-y rounded-lg border">
            {model.suggestions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 p-3">
                <button
                  type="button"
                  className="text-left text-sm hover:underline"
                  onClick={() => push({ risk: s.id })}
                >
                  {s.title}
                </button>
                <ReviewButtons id={s.id} />
              </li>
            ))}
          </ul>
        </PageSection>
      )}

      {/* Register split into the five ROAM clusters. */}
      {ROAM_STATUSES.map((status) => {
        const rows = model.rows.filter((r) => (r.roamStatus as RoamStatus) === status);
        return <RoamClusterTable key={status} status={status} rows={rows} />;
      })}

      <RiskDetailDrawer risks={allRows} userLabels={userLabels} caps={caps} />
    </div>
  );
}

function RoamSummary({ funnel }: { funnel: Record<RoamStatus, number> }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {ROAM_STATUSES.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={`size-2.5 rounded-full ${ROAM_DOT[s]}`} />
          {ROAM_LABELS[s]}
          <span className="tabular-nums">{funnel[s]}</span>
        </span>
      ))}
    </div>
  );
}

function RoamClusterTable({ status, rows }: { status: RoamStatus; rows: RiskListRow[] }) {
  const { push } = useUrlState();
  return (
    <section className="space-y-2">
      <h3 className="inline-flex items-center gap-2 text-sm font-medium">
        <span className={`size-2.5 rounded-full ${ROAM_DOT[status]}`} />
        {ROAM_LABELS[status]}
        <span className="text-muted-foreground">({rows.length})</span>
      </h3>
      {rows.length === 0 ? (
        <p className="pl-4 text-xs text-muted-foreground">Keine Risiken.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2 font-medium">Nr.</th>
                <th className="p-2 font-medium">Titel</th>
                <th className="p-2 font-medium">Exposure</th>
                <th className="p-2 font-medium">Kategorie</th>
                <th className="p-2 font-medium">Owner</th>
                <th className="p-2 font-medium">Epics</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => push({ risk: r.id })}
                  className={`cursor-pointer hover:bg-muted/40 ${
                    r.isOverdue ? "bg-red-50/50 dark:bg-red-950/20" : ""
                  }`}
                >
                  <td className="p-2 tabular-nums text-muted-foreground">
                    {r.displayNumber ?? "—"}
                  </td>
                  <td className="p-2">{r.title}</td>
                  <td className="p-2">
                    {r.band ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${BAND_BADGE[r.band as ExposureBand]}`}
                      >
                        {BAND_LABEL[r.band as ExposureBand]}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">unbewertet</span>
                    )}
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {r.category ? CATEGORY_LABELS[r.category as RiskCategory] : "—"}
                  </td>
                  <td className="p-2 text-muted-foreground">{r.ownerLabel ?? "—"}</td>
                  <td className="p-2 tabular-nums text-muted-foreground">{r.epicCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const initialState: ActionState = {};

function ReviewButtons({ id }: { id: string }) {
  const [, action, pending] = useActionState(reviewRiskAction, initialState);
  return (
    <div className="flex items-center gap-2">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="accept" />
        <Button type="submit" size="sm" disabled={pending}>
          Dokumentieren
        </Button>
      </form>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="reject" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Ablehnen
        </Button>
      </form>
    </div>
  );
}
