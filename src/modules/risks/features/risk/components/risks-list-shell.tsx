"use client";

import { Page, PageHeader } from "@/components/layout";
import type { RisksListModel } from "@/modules/risks/server/views/risks-list";
import { RisksManager } from "@/modules/risks/features/risk/components/risks-manager";
import type { RiskCaps } from "@/modules/risks/features/risk/components/risk-detail-drawer";

interface Props {
  model: RisksListModel;
  prefix: string;
  userLabels: Record<string, string>;
  caps: RiskCaps;
}

export function RisksListShell({ model, prefix, userLabels, caps }: Props) {
  return (
    <Page>
      <PageHeader
        title="Risks"
        subtitle="ROAM-Register — Risiken bewerten, verknüpfen und steuern."
      />
      <RisksManager model={model} prefix={prefix} userLabels={userLabels} caps={caps} />
    </Page>
  );
}
