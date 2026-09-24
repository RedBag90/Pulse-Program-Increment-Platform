"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { formatEUR } from "@/lib/formatting";
import { saveValueStreamGuardrailTargetsAction } from "@/modules/work/features/portfolio/actions/guardrail-targets";
import {
  CAPACITY_BUCKETS,
  CAPACITY_BUCKET_KEYS,
  GUARDRAIL_SOURCE_KEYS,
  type CapacityBucket,
  type GuardrailTargetsSource,
} from "@/modules/work/domain/portfolio-guardrails";
import { COVERAGE_THIN_THRESHOLD, statusFor } from "@/modules/work/domain/guardrail-rules";
import { GuardrailStatusBadge } from "@/modules/work/features/portfolio/components/guardrails/guardrail-status-badge";
import {
  maxCapacityDrift,
  noCapacityReason,
  type ClassificationPreview,
  type ValueStreamCapacityPlan,
} from "@/modules/work/server/views/value-stream-capacity-mix";

/**
 * Die Einfaerbung einer Abweichung — dieselbe Semantik wie `deltaClass` auf der
 * Portfolio-Karte: ueber dem Ziel rot, darunter amber, innerhalb von 5 % der
 * Kapazitaet neutral. Die 5 % sind dieselbe Schwelle wie in `statusFor`.
 */
function deltaClass(delta: number | null, capacity: number | null): string {
  if (delta == null || capacity == null || capacity <= 0) return "text-muted-foreground";
  const share = delta / capacity;
  if (share > 0.05) return "text-destructive";
  if (share < -0.05) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

/**
 * Guardrail 2 und 3 eines Wertstroms: die Ziele setzen — und sehen, ob die
 * eingeplante Arbeit in die Kapazität passt.
 *
 * Gemessen wird in **Job-Size-Punkten**: das Veränderungsgeld jedes ARTs,
 * geteilt durch seinen empirischen €-Satz, aufgeteilt nach den Zielen dieses
 * Wertstroms. Bis September 2026 zählte die Fläche gelieferte **Epics in Euro**,
 * kumulativ über alle Zeit — zwei Grössen, die niemand steuern kann: eine
 * Schätzung und eine Vergangenheit.
 *
 * **Die Ampel kommt aus `statusFor`**, wie jede andere Guardrail. Sie wurde hier
 * bis September 2026 nachgebaut, mit `Math.round` vor dem Vergleich — 15,4 pp
 * landeten dadurch bei „Abweichung" statt „Kritisch".
 *
 * Leere Felder heißen **geerbt**, nicht „null". Wer nur das Portfolio-Limit
 * setzen will, soll den Capacity-Mix nicht mitschleppen müssen — sonst friert
 * er den Tenant-Stand ein, indem er ihn kopiert.
 */
export function ValueStreamGuardrailsSection({
  valueStreamId,
  plan,
  threshold,
  source,
  overriddenAxes,
  canEdit,
  preview,
}: {
  valueStreamId: string;
  plan: ValueStreamCapacityPlan;
  threshold: number;
  source: GuardrailTargetsSource;
  overriddenAxes: string[];
  canEdit: boolean;
  /** Aufteilung bei diesem Limit — `null`, solange die Practice aus ist. */
  preview?: ClassificationPreview | null | undefined;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(saveValueStreamGuardrailTargetsAction, {});
  const own = (axis: string) => overriddenAxes.includes(axis);
  const ziel = (b: CapacityBucket) => (own("capacity") ? String(plan.targets[b]) : "");
  const [business, setBusiness] = useState(ziel("business"));
  const [enabler, setEnabler] = useState(ziel("enabler"));
  const [maintenance, setMaintenance] = useState(ziel("maintenance"));
  const [limit, setLimit] = useState(own("approval") ? String(threshold) : "");

  const drift = maxCapacityDrift(plan);
  const status = statusFor(drift ?? 0, drift != null);
  const ohneKapazitaet = noCapacityReason(plan);
  const thin =
    plan.totalPlanned.count > 0 &&
    plan.unclassified.count / plan.totalPlanned.count > COVERAGE_THIN_THRESHOLD;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-medium">{t("work.epic.guardrailCapacityAllocation")}</h2>
        <GuardrailStatusBadge status={status} />
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {t(GUARDRAIL_SOURCE_KEYS[source] ?? source)}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("work.epic.gemessenIn")}{" "}
        <strong className="font-medium text-foreground">{t("work.epic.jobSizePunkten")}</strong>:
        das zugeteilte Veränderungsgeld jedes ARTs, geteilt durch seinen eigenen €-Satz je Punkt —
        dagegen die Job Size der für {plan.cycleLabel} eingeplanten Features.
      </p>

      <p className="text-sm">
        {ohneKapazitaet === "no_rate" ? (
          <span className="text-muted-foreground">
            Für {plan.cycleLabel} lässt sich an keinem ART dieses Wertstroms ein €-Satz ableiten —
            die geplanten Punkte stehen unten, die Ziele lassen sich noch nicht dagegen rechnen.
          </span>
        ) : ohneKapazitaet === "no_budget" ? (
          <span className="text-muted-foreground">
            Für {plan.cycleLabel} ist diesem Wertstrom noch kein Veränderungsgeld zugeteilt. Die
            eingeplanten Punkte stehen unten; eine Kapazität gibt es erst mit der Zuteilung.
          </span>
        ) : (
          <>
            <span className="text-muted-foreground">Kapazität {plan.cycleLabel} · </span>
            {plan.artCount - plan.artsWithoutRate.length} von {plan.artCount}{" "}
            {plan.artCount === 1 ? "ART" : "ARTs"} ·{" "}
            <strong className="font-medium">{formatEUR(plan.budget)}</strong>
            {" → "}
            <strong className="font-medium tabular-nums">
              {Math.round(plan.capacity ?? 0)}
            </strong>{" "}
            Punkte
          </>
        )}
      </p>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-surface-frame text-label uppercase tracking-[0.1em] text-muted-foreground">
              <th className="p-2 text-left font-semibold">{t("work.epic.arbeitstyp")}</th>
              <th className="p-2 text-right font-semibold">{t("work.epic.features")}</th>
              <th className="p-2 text-right font-semibold">{t("work.epic.geplant")}</th>
              <th className="p-2 text-right font-semibold">{t("work.epic.verfuegbar")}</th>
              <th className="p-2 text-right font-semibold">{t("work.epic.abw")}</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((row) => (
              <tr key={row.bucket} className="border-b last:border-b-0">
                <td className="p-2">{t(CAPACITY_BUCKET_KEYS[row.bucket] ?? row.bucket)}</td>
                <td className="p-2 text-right tabular-nums">{row.planned.count}</td>
                <td className="p-2 text-right tabular-nums">{row.planned.jobSize} Pkt</td>
                <td className="p-2 text-right tabular-nums text-muted-foreground">
                  {ohneKapazitaet != null || row.available == null
                    ? "—"
                    : `${Math.round(row.available)} Pkt`}
                  {ohneKapazitaet == null && row.available != null && (
                    <span className="ml-1 text-label">({Math.round(row.targetShare * 100)} %)</span>
                  )}
                </td>
                <td
                  className={`p-2 text-right tabular-nums ${deltaClass(row.delta, plan.capacity)}`}
                >
                  {ohneKapazitaet != null || row.delta == null
                    ? "—"
                    : `${row.delta > 0 ? "+" : ""}${Math.round(row.delta)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {plan.artsWithoutRate.length > 0 && (
        <p className="rounded-r-md border-l-2 bg-surface-frame px-3 py-2 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">{plan.artsWithoutRate.length}</strong>{" "}
          {plan.artsWithoutRate.length === 1 ? "ART hat" : "ARTs haben"} keinen belastbaren €-Satz —{" "}
          {plan.artsWithoutRate.map((a) => a.name).join(", ")}. Die{" "}
          {plan.artsWithoutRate.reduce((s2, a) => s2 + a.jobSize, 0)} dort eingeplanten Punkte
          stehen oben unter „Geplant"; eine Kapazität dagegen gibt es für sie nicht.
        </p>
      )}

      {plan.unclassified.count > 0 && (
        <p className="rounded-r-md border-l-2 bg-surface-frame px-3 py-2 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">{plan.unclassified.count}</strong>{" "}
          eingeplante Features tragen keinen Arbeitstyp ({plan.unclassified.jobSize} Pkt) und gehen
          in keine Zeile ein.
          {thin && " Ab 20 % unklassifiziert ist die Aufteilung nur noch ein Indiz."}
        </p>
      )}

      {plan.byCycle.length > 1 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-frame text-label uppercase tracking-[0.1em] text-muted-foreground">
                <th className="p-2 text-left font-semibold">{t("work.epic.entwicklung")}</th>
                {CAPACITY_BUCKETS.map((b) => (
                  <th key={b} className="p-2 text-right font-semibold">
                    {t(CAPACITY_BUCKET_KEYS[b] ?? b).replace("-Features", "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.byCycle.map((c) => (
                <tr key={c.cycleKey} className="border-b last:border-b-0">
                  <td className="p-2">{c.label}</td>
                  {c.rows.map((r) => (
                    <td key={r.bucket} className="p-2 text-right tabular-nums">
                      {r.planned} / {r.available == null ? "—" : Math.round(r.available)} Pkt
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <div className="space-y-2 rounded-lg bg-card p-4 shadow-card">
          <p className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Guardrail 3 · Aufteilung bei einem Limit von {formatEUR(preview.threshold)}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-2xl font-semibold tabular-nums">{preview.portfolio.count}</div>
              <div className="text-xs text-muted-foreground">
                Portfolio-Epics · {formatEUR(preview.portfolio.amount)} · über die PB-Liste
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{preview.art.count}</div>
              <div className="text-xs text-muted-foreground">
                ART-Epics · {formatEUR(preview.art.amount)} · aus den ART-Rahmen
              </div>
            </div>
          </div>
          {preview.unclassified > 0 && (
            <p className="text-xs text-muted-foreground">
              {preview.unclassified} Epics sind noch nicht eingeordnet — ohne freigegebenen Business
              Case liegt keine belastbare Kostenschätzung vor. Sie bleiben Portfolio-Sache, bis er
              steht.
            </p>
          )}
          {preview.artWithoutArt > 0 && (
            <p className="rounded-r-md border-l-2 border-l-amber-600 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              {preview.artWithoutArt} davon tragen keinen ART und hätten nach der Trennung keinen
              Finanzierungsweg.
            </p>
          )}
        </div>
      )}

      {canEdit && (
        <form action={formAction} className="space-y-2 rounded-lg bg-card p-4 shadow-card">
          <input type="hidden" name="valueStreamId" value={valueStreamId} />
          <p className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {t("work.epic.zieleDiesesWertstroms")}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              {t("work.epic.business")}
              <input
                name="business"
                value={business}
                onChange={(ev) => setBusiness(ev.target.value)}
                inputMode="numeric"
                placeholder={t("work.epic.geerbt")}
                className="w-20 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
              />
              %
            </label>
            <label className="flex items-center gap-2">
              {t("work.epic.enabler")}
              <input
                name="enabler"
                value={enabler}
                onChange={(ev) => setEnabler(ev.target.value)}
                inputMode="numeric"
                placeholder={t("work.epic.geerbt")}
                className="w-20 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
              />
              %
            </label>
            <label className="flex items-center gap-2">
              {t("work.epic.maintenance")}
              <input
                name="maintenance"
                value={maintenance}
                onChange={(ev) => setMaintenance(ev.target.value)}
                inputMode="numeric"
                placeholder={t("work.epic.geerbt")}
                className="w-20 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
              />
              %
            </label>
            <label className="flex items-center gap-2">
              {t("work.epic.portfolioLimit")}
              <input
                name="portfolioThreshold"
                value={limit}
                onChange={(ev) => setLimit(ev.target.value)}
                inputMode="numeric"
                placeholder={t("work.epic.geerbt")}
                className="w-28 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
              />
              €
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? "…" : "Speichern"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("work.epic.leerLassenHeisst")}{" "}
            <strong className="font-medium">{t("work.epic.geerbt")}</strong>. Aktuell gilt: Business{" "}
            {plan.targets.business} % / Enabler {plan.targets.enabler} % / Maintenance{" "}
            {plan.targets.maintenance} %, Portfolio-Limit {formatEUR(threshold)} —{" "}
            {t(GUARDRAIL_SOURCE_KEYS[source] ?? source)}. Die drei Anteile werden zusammen gesetzt:
            eine halbe Mix-Achse kann nicht auf 100 summieren.
          </p>
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
