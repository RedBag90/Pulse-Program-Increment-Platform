"use client";

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

const EUR = (n: number) => `${n.toLocaleString("de-DE")} €`;
const input =
  "w-32 rounded border border-gray-300 px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60";
const btn = "rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";
const RISK: Record<string, string> = { hoch: "● hoch", mittel: "● mittel", gering: "● gering" };

/**
 * Selbst-Verteilung einer Gruppe: freie €-Beträge über alle Ballot-Kandidaten
 * (Epics + Run-the-Business), Live-Summe gegen den verteilbaren Topf. „Speichern"
 * schreibt die geänderten Zeilen; „Einreichen" (nur Sprecher) schließt ab.
 */
export function GroupDistribute({ model }: { model: GroupDistributionModel }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amounts, setAmounts] = useState<Record<string, string>>(
    () => Object.fromEntries(model.candidates.map((c) => [c.id, String(c.amount)])),
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

  const byVs = groupByValueStream(model.candidates);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold">{model.groupName} · Budget verteilen</span>
          {model.deadline && (
            <span className="text-xs text-muted-foreground">
              Deadline: {model.deadline.toLocaleDateString("de-DE")}
              {model.deadlinePassed && <span className="ml-1 text-red-600">· verstrichen</span>}
            </span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
          <Stat label="Verteilbar" value={EUR(model.distributable)} />
          <Stat label="Verteilt" value={EUR(total)} />
          <Stat
            label="Rest"
            value={EUR(remaining)}
            className={over ? "text-red-600" : "text-emerald-600"}
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
          Diese Gruppe hat ihre Verteilung eingereicht.
        </p>
      )}

      {byVs.map(([vsName, cands]) => (
        <div key={vsName} className="rounded-lg border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{vsName}</h3>
          <ul className="mt-2 divide-y divide-border">
            {cands.map((c) => (
              <li key={c.id} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{c.title}</span>
                    {c.kind === "rtb" && (
                      <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        Run the Business
                      </span>
                    )}
                    <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                      Richtwert {EUR(c.ask)}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={amounts[c.id] ?? "0"}
                    disabled={!model.canEdit}
                    onChange={(e) => setAmounts((a) => ({ ...a, [c.id]: e.target.value }))}
                    className={input}
                  />
                </div>
                {c.info && (
                  <details className="mt-1 text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">Budget-Info</summary>
                    <dl className="mt-1 space-y-0.5 pl-3">
                      {c.info.problemStatement && <Info label="Problem" value={c.info.problemStatement} />}
                      {c.info.mvpCut && <Info label="MVP-Schnitt" value={c.info.mvpCut} />}
                      {c.info.riskRating && <Info label="Risiko" value={RISK[c.info.riskRating] ?? c.info.riskRating} />}
                      {c.info.ifNotFunded && <Info label="Wenn nicht finanziert" value={c.info.ifNotFunded} />}
                    </dl>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {over && <p className="text-sm text-red-600">Die Summe überschreitet den verteilbaren Topf.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

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
              className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Einreichen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function groupByValueStream(cands: DistributionCandidate[]): [string, DistributionCandidate[]][] {
  const map = new Map<string, DistributionCandidate[]>();
  for (const c of cands) {
    const key = c.valueStreamName ?? "Ohne Wertstrom";
    const arr = map.get(key) ?? [];
    arr.push(c);
    map.set(key, arr);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
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
