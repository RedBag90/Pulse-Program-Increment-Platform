"use client";

import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { FeatureStatusSelect } from "@/modules/work/features/feature/components/feature-status-select";
import { FeatureOwnerAssign } from "@/modules/work/features/feature/components/feature-owner-assign";
import { FeatureClassificationForm } from "./feature-classification-form";
import { STATUS_DOT, STATUS_LABELS } from "@/components/detail/initiative-labels";
import { formatDate } from "@/lib/formatting";
import type { FeatureDetailModel } from "@/modules/drumbeat/server/views/feature-detail";

interface Props {
  model: FeatureDetailModel;
  canEdit: boolean;
  canTransition: boolean;
  canAssignOwner: boolean;
  approvers: ReadonlyArray<{ userId: string; roles: string[] }>;
  userLabels: Record<string, string>;
}

const TIER_LABEL: Record<FeatureDetailModel["wsjf"]["tier"], string> = {
  high: "WSJF hoch",
  medium: "WSJF mittel",
  low: "WSJF niedrig",
  unscored: "WSJF offen",
};
const TIER_CLASS: Record<FeatureDetailModel["wsjf"]["tier"], string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-muted text-muted-foreground",
  unscored: "bg-muted text-muted-foreground",
};


/**
 * Overview-Tab der Feature-Detail-Seite. Felds-Grid + Status-Aktionen.
 * Aktions-Buttons sind capability-gated und reflektieren die FSM aus
 * `canDeliveryTransition` (Pre-Filter passierte das Page-Model).
 */
export function FeatureOverviewTab({
  model,
  canEdit,
  canTransition,
  canAssignOwner,
  approvers,
  userLabels,
}: Props) {
  return (
    <div className="space-y-6">
      <SummaryHeader model={model} />

      <section className="grid gap-4 md:grid-cols-2">
        <Field label="Status">
          <StatusPill status={model.status} />
        </Field>
        <Field label="Parent-Epic">
          {model.parent ? (
            <Link
              href={`/portfolio/epics/${model.parent.id}` as never}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {model.parent.title}
              {model.parent.stageGate && (
                <span className="ml-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                  {model.parent.stageGate}
                </span>
              )}
              <ArrowRight className="size-3" />
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Field>
        <Field label="Wertstrom · ART">
          <span className="text-sm">
            {model.valueStream?.name ?? "—"}
            <span className="mx-2 text-muted-foreground">·</span>
            {model.art?.name ?? "—"}
          </span>
        </Field>
        <Field label="PI">
          {model.pi ? (
            <Link
              href={`/umsetzung/pi/${model.pi.id}` as never}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {model.pi.name}
              <ArrowRight className="size-3" />
            </Link>
          ) : (
            <span className="text-muted-foreground">Backlog</span>
          )}
        </Field>
        <Field label="Owner">
          <FeatureOwnerAssign
            featureId={model.id}
            artId={model.art?.id ?? ""}
            ownerId={model.ownerId}
            canAssignOwner={canAssignOwner}
            approvers={approvers}
            userLabels={userLabels}
          />
        </Field>
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Feature-Typ
          </p>
          {model.art ? (
            <FeatureClassificationForm
              featureId={model.id}
              artId={model.art.id}
              featureType={model.featureType}
              canEdit={canEdit}
            />
          ) : (
            <div className="flex min-h-9 items-center rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {model.featureType ?? "—"}
            </div>
          )}
        </div>
        <Field label="Erstellt · Aktualisiert">
          <span className="text-sm">
            {formatDate(model.createdAt)}
            <span className="mx-2 text-muted-foreground">·</span>
            {formatDate(model.updatedAt)}
          </span>
        </Field>
      </section>

      <WsjfBlock model={model} />

      {model.description && (
        <section>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Beschreibung
          </p>
          <p className="whitespace-pre-wrap rounded-lg border bg-card p-4 text-sm leading-relaxed">
            {model.description}
          </p>
        </section>
      )}

      <AcceptanceList items={model.acceptanceCriteria} />

      {/* `allowedTransitions` ist leer, solange das Feature noch in der QS haengt —
          dann gibt es nichts zu schalten und der Abschnitt entfaellt ganz. */}
      {canTransition && model.allowedTransitions.length > 0 && (
        <DeliveryActions
          featureId={model.id}
          status={model.status}
          title={model.title}
          disabled={!canEdit}
        />
      )}
    </div>
  );
}

function SummaryHeader({ model }: { model: FeatureDetailModel }) {
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
      <StatusPill status={model.status} />
      <span className={`rounded-full px-2 py-0.5 text-[11px] ${TIER_CLASS[model.wsjf.tier]}`}>
        {TIER_LABEL[model.wsjf.tier]}
        {model.wsjf.computed != null && (
          <span className="ml-1 tabular-nums">· {model.wsjf.computed.toFixed(2)}</span>
        )}
      </span>
      {model.pi && (
        <Link
          href={`/umsetzung/pi/${model.pi.id}` as never}
          className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700 hover:bg-blue-200"
        >
          {model.pi.name}
          <ArrowRight className="size-3" />
        </Link>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex min-h-9 items-center rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        {children}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className={`size-2 shrink-0 rounded-full ${STATUS_DOT[status] ?? "bg-muted-foreground/40"}`}
      />
      <span>{STATUS_LABELS[status] ?? status}</span>
    </span>
  );
}

function WsjfBlock({ model }: { model: FeatureDetailModel }) {
  const cells: { label: string; value: number | null }[] = [
    { label: "Business Value", value: model.wsjf.businessValue },
    { label: "Time Criticality", value: model.wsjf.timeCriticality },
    { label: "Risk Reduction", value: model.wsjf.riskReduction },
    { label: "Job Size", value: model.wsjf.jobSize },
  ];
  return (
    <section>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        WSJF
      </p>
      <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-5">
        {cells.map((c) => (
          <div key={c.label} className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
            <p className="text-sm tabular-nums">{c.value ?? "—"}</p>
          </div>
        ))}
        <div className="space-y-0.5">
          <p className="text-[11px] text-muted-foreground">Computed</p>
          <p className="text-base font-semibold tabular-nums">
            {model.wsjf.computed != null ? model.wsjf.computed.toFixed(2) : "—"}
          </p>
        </div>
      </div>
    </section>
  );
}

function AcceptanceList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <section>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Acceptance Criteria
        </p>
        <p className="rounded-lg border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
          Noch keine Acceptance Criteria — werden in P1.B im eigenen Tab gepflegt.
        </p>
      </section>
    );
  }
  return (
    <section>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Acceptance Criteria
      </p>
      <ul className="space-y-1.5 rounded-lg border bg-card p-4 text-sm">
        {items.map((c, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            <span>{c}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DeliveryActions({
  featureId,
  status,
  title,
  disabled,
}: {
  featureId: string;
  status: string;
  title: string;
  disabled: boolean;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Status
      </p>
      <FeatureStatusSelect
        featureId={featureId}
        status={status}
        label={title}
        size="md"
        disabled={disabled}
      />
    </section>
  );
}
