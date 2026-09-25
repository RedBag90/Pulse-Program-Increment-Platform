"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  GroupDistributionModel,
  DistributionCandidate,
} from "@/modules/budgeting/server/views/group-distribution-view";
import {
  setGroupAmountAction,
  submitGroupDistributionAction,
} from "@/modules/budgeting/features/actions/distribution";
import { pbSourceKey } from "@/modules/work/domain/pb-submission";
import { CandidateWorksheet } from "@/modules/budgeting/features/components/period/candidate-worksheet";

const EUR = (n: number) => `${n.toLocaleString("de-DE")} €`;
const input =
  "w-32 rounded-md border border-input bg-background px-2 py-1 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";
const btn =
  "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";

/**
 * Selbst-Verteilung einer Gruppe: freie €-Beträge über alle PB-Listen-Kandidaten
 * (Epics + Run-the-Business), Live-Summe gegen den verteilbaren Topf. „Speichern"
 * schreibt die geänderten Zeilen; „Einreichen" (nur Sprecher) schließt ab.
 */
export function GroupDistribute({ model }: { model: GroupDistributionModel }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(model.candidates.map((c) => [c.id, String(c.amount)])),
  );
  const [error, setError] = useState<string | null>(null);
  const base = useMemo(
    () => Object.fromEntries(model.candidates.map((c) => [c.id, c.amount])),
    [model.candidates],
  );

  const total = model.candidates.reduce((s, c) => s + (Number(amounts[c.id]) || 0), 0);
  const remaining = model.distributable - total;
  const over = remaining < 0;
  const frac = model.distributable > 0 ? Math.min(1, total / model.distributable) : 0;

  function save() {
    setError(null);
    startTransition(async () => {
      for (const c of model.candidates) {
        const val = Number(amounts[c.id]) || 0;
        if (val === base[c.id]) continue;
        const fd = new FormData();
        fd.set("groupId", model.groupId);
        fd.set("candidateId", c.id);
        fd.set("amount", String(val));
        const res = await setGroupAmountAction({}, fd);
        if (res.error) {
          setError(`${c.title}: ${res.error}`);
          return;
        }
      }
      router.refresh();
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("groupId", model.groupId);
      const res = await submitGroupDistributionAction({}, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-card shadow-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold">{model.groupName} · Budget verteilen</span>
          {model.deadline && (
            <span className="text-xs text-muted-foreground">
              Deadline: {model.deadline.toLocaleDateString("de-DE")}
              {model.deadlinePassed && (
                <span className="ml-1 text-destructive">{t("budgeting.period.verstrichen")}</span>
              )}
            </span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
          <Stat label={t("budgeting.period.verteilbar")} value={EUR(model.distributable)} />
          <Stat label={t("budgeting.period.verteilt")} value={EUR(total)} />
          <Stat
            label={t("budgeting.period.rest")}
            value={EUR(remaining)}
            className={over ? "text-destructive" : "text-success"}
          />
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${over ? "bg-red-500" : "bg-primary"}`}
            style={{ width: `${Math.round(frac * 100)}%` }}
          />
        </div>
      </div>

      {model.submitted && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {t("budgeting.period.dieseGruppeHatIhre")}
        </p>
      )}

      <CandidateWorksheet
        items={model.candidates}
        // Gegliedert und sortiert nach der **Anfrage**, nicht nach dem
        // eingetippten Betrag: beim Tippen darf keine Zeile ihre Position
        // wechseln und kein Abschnitt umsortieren.
        sortBy={(c: DistributionCandidate) => c.ask}
        columns={[
          {
            key: "ask",
            label: "Anfrage",
            value: (c: DistributionCandidate) => c.ask,
            width: "120px",
          },
          {
            key: "mine",
            label: "Mein Betrag",
            value: (c: DistributionCandidate) => Number(amounts[c.id]) || 0,
            width: "140px",
            cell: (c: DistributionCandidate) => (
              <input
                type="number"
                min={0}
                step={1000}
                value={amounts[c.id] ?? "0"}
                disabled={!model.canEdit}
                onChange={(e) => setAmounts((a) => ({ ...a, [c.id]: e.target.value }))}
                className={input}
              />
            ),
          },
        ]}
        progress={{ of: "mine", against: "ask" }}
        title={(c) => (
          <div className="min-w-0">
            <span className="block truncate">{c.title}</span>
            {c.info && c.info.rows.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none">
                  {t("budgeting.period.budgetInfo")}
                  <span className="ml-1 text-muted-foreground/70">
                    {pbSourceKey(c.info.source) != null && <> · {t(pbSourceKey(c.info.source)!)}</>}
                  </span>
                </summary>
                <dl className="mt-1 space-y-0.5 pl-3">
                  {c.info.rows.map((r) => (
                    <Info key={r.label} label={r.label} value={r.value} />
                  ))}
                </dl>
              </details>
            )}
          </div>
        )}
        empty="Noch keine Kandidaten — die Runde ist nicht gestartet."
      />
      {over && (
        <p className="text-sm text-destructive">
          {t("budgeting.period.dieSummeUeberschreitetDen")}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {model.canEdit && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={pending} className={btn}>
            {pending ? "…" : "Speichern"}
          </button>
          {model.canSubmit && (
            <button
              type="button"
              onClick={submit}
              disabled={pending || over}
              className="rounded-md bg-success px-3 py-1.5 text-sm font-medium text-background hover:bg-success/90 disabled:opacity-50"
            >
              {t("budgeting.period.einreichen")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-medium tabular-nums ${className ?? ""}`}>{value}</dd>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 font-medium">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}
