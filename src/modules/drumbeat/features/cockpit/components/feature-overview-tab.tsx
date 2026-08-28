"use client";

import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { FeatureOwnerAssign } from "@/modules/work/features/feature/components/feature-owner-assign";
import { FeatureEditForm } from "@/modules/work/features/feature/components/feature-edit-form";
import { WsjfScoreDialog } from "@/modules/work/features/feature/components/wsjf-score-dialog";
import { FeatureClassificationForm } from "./feature-classification-form";
import {
  STAGE_GATE_LABELS,
  STATUS_DOT,
  STATUS_LABELS,
} from "@/components/detail/initiative-labels";
import { buildInitiativeSummary } from "@/modules/core/kernel/domain/initiative-summary";
import { formatDate } from "@/lib/formatting";
import { formatWsjf } from "@/modules/core/kernel/domain/wsjf";
import type { StageGate, InitiativeStatus } from "@/modules/core/kernel/domain/types";
import type { FeatureDetailModel } from "@/modules/drumbeat/server/views/feature-detail";

interface Props {
  model: FeatureDetailModel;
  canEdit: boolean;
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
  canAssignOwner,
  approvers,
  userLabels,
}: Props) {
  return (
    <div className="space-y-6">
      <SummaryHeader model={model} />

      <SummaryBand model={model} />

      <section className="grid gap-4 md:grid-cols-2">
        <Field label="Status">
          <StatusPill status={model.status} />
        </Field>
        <Field label="Reifegrad">
          {model.stageGate ? (STAGE_GATE_LABELS[model.stageGate] ?? model.stageGate) : "—"}
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

      <WsjfBlock model={model} canEdit={canEdit} />

      <section>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Beschreibung
        </p>
        {canEdit && model.art ? (
          <FeatureEditForm
            id={model.id}
            artId={model.art.id}
            currentTitle={model.title}
            currentDescription={model.description ?? ""}
          />
        ) : model.description ? (
          <p className="whitespace-pre-wrap rounded-lg border bg-card p-4 text-sm leading-relaxed">
            {model.description}
          </p>
        ) : (
          <p className="rounded-lg border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
            Keine Beschreibung.
          </p>
        )}
      </section>

      <AcceptanceList items={model.acceptanceCriteria} />
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
          <span className="ml-1 tabular-nums">· {formatWsjf(model.wsjf.computed)}</span>
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

/**
 * Abgeleiteter Reifegrad-/Aktivitaets-Satz (wie Epic-Overview). Nur wenn ein
 * Reifegrad gesetzt ist — sonst hat der Satz keine Aussage.
 */
function SummaryBand({ model }: { model: FeatureDetailModel }) {
  if (!model.stageGate) return null;
  const summary = buildInitiativeSummary({
    stageGate: model.stageGate as StageGate,
    status: model.status as InitiativeStatus,
    childCount: 0,
    completedChildCount: 0,
    approvedAt: null,
    updatedAt: model.updatedAt,
  });
  return (
    <section>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Zusammenfassung
      </p>
      <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">{summary}</p>
    </section>
  );
}

/**
 * WSJF-Block mit Detailzellen, Cost-of-Delay ÷ Job Size = Score-Visual und
 * (fuer Berechtigte) dem Score-Bearbeiten-Dialog.
 */
function WsjfBlock({ model, canEdit }: { model: FeatureDetailModel; canEdit: boolean }) {
  const w = model.wsjf;
  const costOfDelay = (w.businessValue ?? 0) + (w.timeCriticality ?? 0) + (w.riskReduction ?? 0);
  const cells: [string, number | null][] = [
    ["Business Value", w.businessValue],
    ["Time Criticality", w.timeCriticality],
    ["Risk Reduction / OE", w.riskReduction],
    ["Job Size", w.jobSize],
  ];
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          WSJF
        </p>
        {canEdit && model.art && (
          <WsjfScoreDialog
            featureId={model.id}
            artId={model.art.id}
            current={{
              bv: w.businessValue,
              tc: w.timeCriticality,
              rr: w.riskReduction,
              js: w.jobSize,
            }}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cells.map(([label, value]) => (
          <div key={label} className="space-y-1 rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{value ?? "—"}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div>
          <p className="text-xs text-muted-foreground">Cost of Delay</p>
          <p className="text-xl font-semibold text-foreground tabular-nums">{costOfDelay}</p>
        </div>
        <div className="text-xl text-muted-foreground/60">÷</div>
        <div>
          <p className="text-xs text-muted-foreground">Job Size</p>
          <p className="text-xl font-semibold text-foreground tabular-nums">{w.jobSize ?? "—"}</p>
        </div>
        <div className="text-xl text-muted-foreground/60">=</div>
        <div>
          <p className="text-xs text-muted-foreground">WSJF Score</p>
          <p className="text-3xl font-bold text-primary/80 tabular-nums">
            {formatWsjf(w.computed)}
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
