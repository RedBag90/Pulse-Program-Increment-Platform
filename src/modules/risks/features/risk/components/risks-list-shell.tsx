"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { Page, PageHeader, PageSection } from "@/components/layout";
import { Button } from "@/components/ui/button";
import type { RisksListModel, RiskListRow } from "@/modules/risks/server/views/risks-list";
import type { RoamStatus } from "@/modules/core/kernel/domain/roam";
import { ROAM_DOT, ROAM_LABELS } from "@/modules/core/kernel/domain/roam";
import { CreateRiskDialog } from "@/modules/risks/features/risk/components/create-risk-dialog";
import { RiskRoamBoard } from "@/modules/risks/features/risk/components/risk-roam-board";
import { RiskMatrix } from "@/modules/risks/features/risk/components/risk-matrix";
import { RiskSettingsDialog } from "@/modules/risks/features/risk/components/risk-settings-dialog";
import { reviewRiskAction } from "@/modules/risks/features/risk/actions/risk";
import type { ActionState } from "@/server/http/server-action";
import {
  BAND_BADGE,
  BAND_LABEL,
  CATEGORY_LABELS,
  REVIEW_LABELS,
} from "@/modules/risks/features/risk/components/labels";
import type { ExposureBand } from "@/modules/risks/domain/risk-matrix";
import type { RiskCategory } from "@/modules/risks/domain/risk-category";

interface Props {
  model: RisksListModel;
  prefix: string;
  canDocument: boolean;
  canReview: boolean;
  canManageSettings: boolean;
}

export function RisksListShell({
  model,
  prefix,
  canDocument,
  canReview,
  canManageSettings,
}: Props) {
  const [roamFilter, setRoamFilter] = useState<RoamStatus | null>(null);

  const rows = useMemo(
    () => (roamFilter ? model.rows.filter((r) => r.roamStatus === roamFilter) : model.rows),
    [model.rows, roamFilter],
  );

  return (
    <Page>
      <PageHeader
        title="Risks"
        subtitle="ROAM-Register — Risiken bewerten, verknüpfen und steuern."
        actions={
          <div className="flex items-center gap-2">
            {canManageSettings && <RiskSettingsDialog prefix={prefix} />}
            <CreateRiskDialog canDocument={canDocument} />
          </div>
        }
      />

      <PageSection>
        <RiskRoamBoard
          funnel={model.roamFunnel}
          activeStatus={roamFilter}
          onSelect={setRoamFilter}
        />
      </PageSection>

      <PageSection title="Risk-Matrix">
        <RiskMatrix cells={model.matrix.cells} plots={model.matrix.plots} />
        {model.unscored.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {model.unscored.length} unbewertete{model.unscored.length === 1 ? "s" : ""} Risiko — im
            Detail bewerten, damit es in der Matrix erscheint.
          </p>
        )}
      </PageSection>

      {canReview && model.suggestions.length > 0 && (
        <PageSection title={`Vorschläge (${model.suggestions.length})`}>
          <ul className="divide-y rounded-lg border">
            {model.suggestions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 p-3">
                <span className="text-sm">{s.title}</span>
                <ReviewButtons id={s.id} />
              </li>
            ))}
          </ul>
        </PageSection>
      )}

      <PageSection title={`Register (${rows.length})`}>
        <RiskTable rows={rows} />
      </PageSection>
    </Page>
  );
}

function RiskTable({ rows }: { rows: RiskListRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Risiken.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="p-2 font-medium">Nr.</th>
            <th className="p-2 font-medium">Titel</th>
            <th className="p-2 font-medium">ROAM</th>
            <th className="p-2 font-medium">Exposure</th>
            <th className="p-2 font-medium">Kategorie</th>
            <th className="p-2 font-medium">Owner</th>
            <th className="p-2 font-medium">Epics</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id} className={r.isOverdue ? "bg-red-50/50 dark:bg-red-950/20" : undefined}>
              <td className="p-2 tabular-nums text-muted-foreground">{r.displayNumber ?? "—"}</td>
              <td className="p-2">{r.title}</td>
              <td className="p-2">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={`size-2.5 rounded-full ${ROAM_DOT[r.roamStatus as RoamStatus] ?? ""}`}
                  />
                  {ROAM_LABELS[r.roamStatus as RoamStatus] ?? r.roamStatus}
                </span>
              </td>
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
  );
}

const initialState: ActionState = {};

function ReviewButtons({ id }: { id: string }) {
  const [, action, pending] = useActionState(reviewRiskAction, initialState);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{REVIEW_LABELS.suggested}</span>
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
