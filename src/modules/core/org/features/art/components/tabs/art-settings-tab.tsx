import type { ReactNode } from "react";
import { userLabel } from "@/components/detail/initiative-labels";
import { ArtOverviewForm } from "@/modules/core/org/features/capacity/components/art-overview-form";

interface Art {
  id: string;
  name: string;
  description: string | null;
  piCadenceWeeks: number;
  rteId: string | null;
}

interface Approver {
  userId: string;
  roles: string[];
}

interface Props {
  art: Art;
  canEdit: boolean;
  approvers: Approver[];
  userLabels: Record<string, string>;
}

export function ArtSettingsTab({ art, canEdit, approvers, userLabels }: Props) {
  const rteUsers = approvers.filter((u) => u.roles.includes("rte"));
  const formKey = [
    art.id,
    art.name,
    art.description ?? "",
    art.piCadenceWeeks,
    art.rteId ?? "",
  ].join("|");

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
      {canEdit ? (
        <ArtOverviewForm
          key={formKey}
          id={art.id}
          name={art.name}
          description={art.description ?? ""}
          piCadenceWeeks={art.piCadenceWeeks}
          rteId={art.rteId ?? ""}
          rteUsers={rteUsers}
          userLabels={userLabels}
        />
      ) : (
        <dl className="max-w-xl space-y-3 text-sm">
          <Field label="Name">{art.name}</Field>
          <Field label="Beschreibung">{art.description ?? "—"}</Field>
          <Field label="PI-Kadenz">{art.piCadenceWeeks} Wochen</Field>
          <Field label="RTE">{art.rteId ? userLabel(art.rteId, userLabels) : "—"}</Field>
        </dl>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
