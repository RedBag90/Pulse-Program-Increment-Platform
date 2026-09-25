"use client";

import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { FeatureOwnerAssign } from "@/modules/work/features/feature/components/feature-owner-assign";
import { FeatureSolutionAssign } from "@/modules/work/features/feature/components/feature-solution-assign";
import { FeatureParentAssign } from "@/modules/work/features/feature/components/feature-parent-assign";
import { FeatureEditForm } from "@/modules/work/features/feature/components/feature-edit-form";
import { WsjfScoreDialog } from "@/modules/work/features/feature/components/wsjf-score-dialog";
import { FeatureClassificationForm } from "./feature-classification-form";
import { STATUS_DOT, STATUS_KEYS } from "@/components/detail/initiative-labels";
import { WSJF_TIER_CLASS } from "@/components/detail/initiative-labels";
import { formatDate } from "@/lib/formatting";
import { formatWsjf } from "@/modules/core/kernel/domain/wsjf";
import type { FeatureDetailModel } from "@/modules/drumbeat/server/views/feature-detail";

interface Props {
  model: FeatureDetailModel;
  canEdit: boolean;
  canAssignOwner: boolean;
  approvers: ReadonlyArray<{ userId: string; roles: string[] }>;
  solutionOptions: ReadonlyArray<{ id: string; name: string }>;
  epicOptions: ReadonlyArray<{ id: string; title: string }>;
  userLabels: Record<string, string>;
}

const TIER_LABEL: Record<FeatureDetailModel["wsjf"]["tier"], string> = {
  high: "WSJF hoch",
  medium: "WSJF mittel",
  low: "WSJF niedrig",
  unscored: "WSJF offen",
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
  solutionOptions,
  epicOptions,
  userLabels,
}: Props) {
  const t = useTranslations();
  return (
    <div className="space-y-6">
      <SummaryHeader model={model} />

      <section className="grid gap-4 md:grid-cols-2">
        <Field label={t("drumbeat.ui.status")}>
          <StatusPill status={model.status} />
        </Field>
        <Field label={t("drumbeat.ui.solution")}>
          <FeatureSolutionAssign
            featureId={model.id}
            artId={model.art?.id ?? ""}
            ownSolutionId={model.ownSolutionId}
            inheritedName={model.ownSolutionId === null ? (model.solution?.name ?? null) : null}
            options={solutionOptions}
            canEdit={canEdit && model.art !== null}
          />
        </Field>
        <Field label={t("drumbeat.ui.epic")}>
          <FeatureParentAssign
            featureId={model.id}
            artId={model.art?.id ?? ""}
            parent={model.parent}
            options={epicOptions}
            canEdit={canEdit && model.art !== null}
          />
        </Field>
        <Field label={t("drumbeat.ui.wertstromArt")}>
          <span className="text-sm">
            {model.valueStream?.name ?? "—"}
            <span className="mx-2 text-muted-foreground">·</span>
            {model.art?.name ?? "—"}
          </span>
        </Field>
        <Field label={t("drumbeat.ui.pi")}>
          {model.pi ? (
            <Link
              href={`/umsetzung/pi/${model.pi.id}` as never}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {model.pi.name}
              <ArrowRight className="size-3" />
            </Link>
          ) : (
            <span className="text-muted-foreground">{t("drumbeat.ui.backlog")}</span>
          )}
        </Field>
        <Field label={t("drumbeat.ui.owner")}>
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
          <p className="mb-1.5 text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {t("drumbeat.ui.featureTyp")}
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
        <Field label={t("drumbeat.ui.erstelltAktualisiert")}>
          <span className="text-sm">
            {formatDate(model.createdAt)}
            <span className="mx-2 text-muted-foreground">·</span>
            {formatDate(model.updatedAt)}
          </span>
        </Field>
      </section>

      <WsjfBlock model={model} canEdit={canEdit} />

      <section>
        <p className="mb-1.5 text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {t("drumbeat.ui.beschreibung")}
        </p>
        {canEdit && model.art ? (
          <FeatureEditForm
            id={model.id}
            artId={model.art.id}
            currentTitle={model.title}
            currentDescription={model.description ?? ""}
          />
        ) : model.description ? (
          <p className="whitespace-pre-wrap rounded-lg bg-card p-4 text-sm leading-relaxed shadow-card">
            {model.description}
          </p>
        ) : (
          <p className="rounded-lg border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
            {t("drumbeat.ui.keineBeschreibung")}
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
      <span className={`rounded-full px-2 py-0.5 text-meta ${WSJF_TIER_CLASS[model.wsjf.tier]}`}>
        {TIER_LABEL[model.wsjf.tier]}
        {model.wsjf.computed != null && (
          <span className="ml-1 tabular-nums">· {formatWsjf(model.wsjf.computed)}</span>
        )}
      </span>
      {model.pi && (
        <Link
          href={`/umsetzung/pi/${model.pi.id}` as never}
          className="inline-flex items-center gap-1 rounded-full bg-info-surface px-2 py-0.5 text-meta text-info hover:bg-info-surface/70"
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
      <p className="mb-1.5 text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <div className="flex min-h-9 items-center rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        {children}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const t = useTranslations();
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className={`size-2 shrink-0 rounded-full ${STATUS_DOT[status] ?? "bg-muted-foreground/40"}`}
      />
      <span>{t(STATUS_KEYS[status] ?? status)}</span>
    </span>
  );
}

/**
 * **Hier stand bis September 2026 ein „Zusammenfassung"-Band und darueber ein
 * Feld REIFEGRAD.** Beide sind weg, und zwar aus demselben Grund: `stage_gate`
 * gehoert dem **Epic**. Die Spalte sitzt auf der geteilten `initiatives`-Tabelle
 * und ist NOT NULL, aber kein Anlagepfad setzt sie an einem Feature — der
 * angezeigte Wert war ein Seed-Ueberbleibsel und widersprach in 130 von 650
 * Faellen dem Epic darueber.
 *
 * Das Band ging **ganz**, nicht nur seine Reifegrad-Klausel: `buildInitiativeSummary`
 * bekam am Feature `childCount: 0` und `approvedAt: null` fest verdrahtet und
 * lieferte damit „in Umsetzung" — woertlich das, was eine Zeile tiefer im Feld
 * STATUS steht.
 *
 * Der Reifegrad des **Epics** bleibt sichtbar: er haengt an `model.parent` und
 * blockiert ueber `featureStartBlockedReason` den Umsetzungsstart.
 */

/**
 * WSJF-Block mit Detailzellen, Cost-of-Delay ÷ Job Size = Score-Visual und
 * (fuer Berechtigte) dem Score-Bearbeiten-Dialog.
 */
function WsjfBlock({ model, canEdit }: { model: FeatureDetailModel; canEdit: boolean }) {
  const t = useTranslations();
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
        <p className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {t("drumbeat.ui.wsjf")}
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
      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-info/30 bg-info-surface p-4">
        <div>
          <p className="text-xs text-muted-foreground">{t("drumbeat.ui.costOfDelay")}</p>
          <p className="text-xl font-semibold text-foreground tabular-nums">{costOfDelay}</p>
        </div>
        <div className="text-xl text-muted-foreground/60">÷</div>
        <div>
          <p className="text-xs text-muted-foreground">{t("drumbeat.ui.jobSize")}</p>
          <p className="text-xl font-semibold text-foreground tabular-nums">{w.jobSize ?? "—"}</p>
        </div>
        <div className="text-xl text-muted-foreground/60">=</div>
        <div>
          <p className="text-xs text-muted-foreground">{t("drumbeat.ui.wsjfScore")}</p>
          <p className="text-3xl font-bold text-primary/80 tabular-nums">
            {formatWsjf(w.computed)}
          </p>
        </div>
      </div>
    </section>
  );
}

function AcceptanceList({ items }: { items: string[] }) {
  const t = useTranslations();
  if (items.length === 0) {
    return (
      <section>
        <p className="mb-1.5 text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {t("drumbeat.ui.acceptanceCriteria")}
        </p>
        <p className="rounded-lg border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
          {t("drumbeat.ui.nochKeineAcceptanceCriteria")}
        </p>
      </section>
    );
  }
  return (
    <section>
      <p className="mb-1.5 text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {t("drumbeat.ui.acceptanceCriteria")}
      </p>
      <ul className="space-y-1.5 rounded-lg bg-card p-4 text-sm shadow-card">
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
