import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { FeatureEditForm } from "./feature-edit-form";
import { WsjfScoreDialog } from "./wsjf-score-dialog";
import { SubmitReviewButton } from "@/features/quality/components/submit-review-button";
import { STAGE_GATE_LABELS, STATUS_LABELS } from "@/components/detail/initiative-labels";
import { buildInitiativeSummary } from "@/domain/initiative-summary";
import type { StageGate, InitiativeStatus } from "@/domain/types";

export interface FeatureOverviewTabProps {
  feature: {
    id: string;
    title: string;
    description: string | null;
    stageGate: string;
    status: string;
    ownerId: string | null;
    updatedAt: Date;
    artId: string;
    artName: string;
    parentEpic: { id: string; title: string } | null;
    pi: { name: string; startDate: Date; endDate: Date } | null;
    acceptanceCriteria: string[];
    wsjf: {
      bv: number | null;
      tc: number | null;
      rr: number | null;
      js: number | null;
      computed: number | null;
    };
  };
  childCount: number;
  completedChildCount: number;
  canEdit: boolean;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="rounded border bg-muted/30 px-3 py-2 text-sm">{children}</div>
    </div>
  );
}

/**
 * Feature Overview tab — mirrors the Epic Overview structure: a derived summary
 * band, a field grid, the WSJF block, acceptance criteria, the QS line, and the
 * description editor. WSJF + acceptance criteria are Feature-specific and live
 * here (Features have no Business Case / Benefit Hypothesis tabs).
 */
export function FeatureOverviewTab({
  feature,
  childCount,
  completedChildCount,
  canEdit,
}: FeatureOverviewTabProps) {
  const { wsjf } = feature;

  const summary = buildInitiativeSummary({
    stageGate: feature.stageGate as StageGate,
    status: feature.status as InitiativeStatus,
    childCount,
    completedChildCount,
    approvedAt: null,
    updatedAt: feature.updatedAt,
  });

  const costOfDelay = (wsjf.bv ?? 0) + (wsjf.tc ?? 0) + (wsjf.rr ?? 0);

  return (
    <div className="space-y-8">
      <section>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Summary
        </p>
        <p className="rounded bg-muted px-4 py-3 text-sm">{summary}</p>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Field label="Stage">{STAGE_GATE_LABELS[feature.stageGate] ?? feature.stageGate}</Field>
        <Field label="Status">{STATUS_LABELS[feature.status] ?? feature.status}</Field>
        <Field label="Initiative Owner">
          <span className="font-mono text-xs">{feature.ownerId ?? "—"}</span>
        </Field>
        <Field label="ART">{feature.artName}</Field>
        <Field label="Parent Epic">
          {feature.parentEpic ? (
            <Link
              href={`/portfolio/epics/${feature.parentEpic.id}`}
              className="text-primary hover:underline"
            >
              {feature.parentEpic.title}
            </Link>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Program Increment">
          {feature.pi
            ? `${feature.pi.name} · ${formatDate(feature.pi.startDate)} – ${formatDate(feature.pi.endDate)}`
            : "Backlog"}
        </Field>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium">WSJF Score</h2>
          {canEdit && (
            <WsjfScoreDialog
              featureId={feature.id}
              artId={feature.artId}
              current={{ bv: wsjf.bv, tc: wsjf.tc, rr: wsjf.rr, js: wsjf.js }}
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Business Value", wsjf.bv],
              ["Time Criticality", wsjf.tc],
              ["Risk Reduction / OE", wsjf.rr],
              ["Job Size", wsjf.js],
            ] as [string, number | null][]
          ).map(([label, value]) => (
            <div key={label} className="space-y-1 rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold text-foreground">{value ?? "—"}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Cost of Delay</p>
            <p className="text-xl font-semibold text-foreground">{costOfDelay}</p>
          </div>
          <div className="text-xl text-muted-foreground/60">÷</div>
          <div>
            <p className="text-xs text-muted-foreground">Job Size</p>
            <p className="text-xl font-semibold text-foreground">{wsjf.js ?? "—"}</p>
          </div>
          <div className="text-xl text-muted-foreground/60">=</div>
          <div>
            <p className="text-xs text-muted-foreground">WSJF Score</p>
            <p className="text-3xl font-bold text-primary/80">
              {wsjf.computed !== null ? wsjf.computed.toFixed(2) : "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Acceptance Criteria</h2>
        {feature.acceptanceCriteria.length === 0 ? (
          <p className="text-sm text-muted-foreground/60">No acceptance criteria defined yet.</p>
        ) : (
          <ul className="space-y-2">
            {feature.acceptanceCriteria.map((criterion, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-gray-300" />
                <span>{criterion}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Qualitätssicherung
        </p>
        {feature.status === "draft" &&
          (canEdit ? (
            <SubmitReviewButton id={feature.id} kind="feature" />
          ) : (
            <span className="text-sm text-muted-foreground">Entwurf — noch nicht eingereicht.</span>
          ))}
        {feature.status === "in_review" && (
          <span className="text-sm text-muted-foreground">
            Zur QS eingereicht — wartet auf RTE-Freigabe.
          </span>
        )}
        {feature.status === "approved" && (
          <span className="text-sm text-emerald-600">Von der RTE freigegeben.</span>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Beschreibung</h2>
        {canEdit ? (
          <FeatureEditForm
            id={feature.id}
            artId={feature.artId}
            currentTitle={feature.title}
            currentDescription={feature.description ?? ""}
          />
        ) : (
          <p className="whitespace-pre-line text-foreground">
            {feature.description ?? "Keine Beschreibung."}
          </p>
        )}
      </section>
    </div>
  );
}
