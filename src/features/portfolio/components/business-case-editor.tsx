"use client";

import { useActionState, useMemo, useState } from "react";
import { saveBusinessCaseAction } from "@/features/portfolio/actions/business-case";
import {
  PROJECT_TYPES,
  APPROVAL_PARTIES,
  computeBusinessCaseTotals,
  type BusinessCaseFields,
  type BusinessCaseVersion,
  type ProjectType,
  type ApprovalParty,
} from "@/domain/business-case";

interface BusinessCaseEditorProps {
  epicId: string;
  current: BusinessCaseFields;
  history: BusinessCaseVersion[];
}

const INPUT_CLASS =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const COST_COLUMNS = [
  ["costsMonths1to6", "Costs (1.–6. Monat)"],
  ["costsMonths7to12", "Costs (7.–12. Monat)"],
  ["annualImpact", "Annual impact"],
  ["oneTimeEffect", "One-time effect"],
] as const;

type CostColumn = (typeof COST_COLUMNS)[number][0];

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  discovery: "Discovery",
  enabler: "Enabler",
  impact: "Impact",
};

const APPROVAL_LABELS: Record<ApprovalParty, string> = {
  mgmt: "MGMT",
  business_owner: "Business Owner",
  finance: "Finance",
  irt_owner: "IRT-Owner",
  lace_vmo: "LACE/VMO",
};

function costKey(pt: ProjectType, col: CostColumn): string {
  return `${pt}_${col}`;
}

function initialCosts(rows: BusinessCaseFields["costRows"]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const pt of PROJECT_TYPES) {
    const row = rows?.find((r) => r.projectType === pt);
    for (const [col] of COST_COLUMNS) {
      const value = row?.[col];
      map[costKey(pt, col)] = value != null ? String(value) : "";
    }
  }
  return map;
}

function parseNum(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function BusinessCaseEditor({ epicId, current, history }: BusinessCaseEditorProps) {
  const [state, action, isPending] = useActionState(saveBusinessCaseAction, {});
  const [costs, setCosts] = useState(() => initialCosts(current.costRows));

  const totals = useMemo(
    () =>
      computeBusinessCaseTotals(
        PROJECT_TYPES.map((projectType) => ({
          projectType,
          costsMonths1to6: parseNum(costs[costKey(projectType, "costsMonths1to6")] ?? ""),
          costsMonths7to12: parseNum(costs[costKey(projectType, "costsMonths7to12")] ?? ""),
          annualImpact: parseNum(costs[costKey(projectType, "annualImpact")] ?? ""),
          oneTimeEffect: parseNum(costs[costKey(projectType, "oneTimeEffect")] ?? ""),
        })),
      ),
    [costs],
  );

  const approvalsByParty = useMemo(() => {
    const map = new Map(current.approvals?.map((a) => [a.party, a]));
    return map;
  }, [current.approvals]);

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-6">
        <input type="hidden" name="epicId" value={epicId} />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="bc-funnel" className="block text-sm font-medium mb-1">
              Funnel Entry Date
            </label>
            <input
              id="bc-funnel"
              type="date"
              name="funnelEntryDate"
              defaultValue={current.funnelEntryDate}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="bc-stakeholders" className="block text-sm font-medium mb-1">
              Key Stakeholders
            </label>
            <input
              id="bc-stakeholders"
              name="keyStakeholders"
              defaultValue={current.keyStakeholders}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div>
          <label htmlFor="bc-description" className="block text-sm font-medium mb-1">
            Initiative Description
          </label>
          <textarea
            id="bc-description"
            name="initiativeDescription"
            rows={4}
            defaultValue={current.initiativeDescription}
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="bc-outcome" className="block text-sm font-medium mb-1">
              Business Outcome Hypothesis
            </label>
            <textarea
              id="bc-outcome"
              name="businessOutcomeHypothesis"
              rows={4}
              defaultValue={current.businessOutcomeHypothesis}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="bc-indicators" className="block text-sm font-medium mb-1">
              Leading Indicators
            </label>
            <textarea
              id="bc-indicators"
              name="leadingIndicators"
              rows={4}
              defaultValue={current.leadingIndicators}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="bc-inscope" className="block text-sm font-medium mb-1">
              In Scope
            </label>
            <textarea
              id="bc-inscope"
              name="inScope"
              rows={3}
              defaultValue={current.inScope}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="bc-outscope" className="block text-sm font-medium mb-1">
              Out of Scope
            </label>
            <textarea
              id="bc-outscope"
              name="outOfScope"
              rows={3}
              defaultValue={current.outOfScope}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="bc-believe" className="block text-sm font-medium mb-1">
              What you need to believe in
            </label>
            <textarea
              id="bc-believe"
              name="whatYouNeedToBelieve"
              rows={3}
              defaultValue={current.whatYouNeedToBelieve}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Project types — Kosten &amp; Wirkung</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b p-2 font-medium">Project type</th>
                  {COST_COLUMNS.map(([col, label]) => (
                    <th key={col} className="border-b p-2 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROJECT_TYPES.map((pt) => (
                  <tr key={pt}>
                    <td className="border-b p-2 font-medium">{PROJECT_TYPE_LABELS[pt]}</td>
                    {COST_COLUMNS.map(([col]) => (
                      <td key={col} className="border-b p-2">
                        <input
                          type="number"
                          step="any"
                          name={`cost_${pt}_${col}`}
                          aria-label={`${PROJECT_TYPE_LABELS[pt]} ${col}`}
                          value={costs[costKey(pt, col)] ?? ""}
                          onChange={(e) =>
                            setCosts((prev) => ({
                              ...prev,
                              [costKey(pt, col)]: e.target.value,
                            }))
                          }
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="p-2">Total</td>
                  <td className="p-2">{totals.costsMonths1to6}</td>
                  <td className="p-2">{totals.costsMonths7to12}</td>
                  <td className="p-2">{totals.annualImpact}</td>
                  <td className="p-2">{totals.oneTimeEffect}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <label htmlFor="bc-customers" className="block text-sm font-medium mb-1">
            Which internal and/or external customers are affected, and how?
          </label>
          <textarea
            id="bc-customers"
            name="customersAffected"
            rows={3}
            defaultValue={current.customersAffected}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="bc-impact" className="block text-sm font-medium mb-1">
            What is the potential impact on solutions, programs and services?
          </label>
          <textarea
            id="bc-impact"
            name="impactOnSolutions"
            rows={3}
            defaultValue={current.impactOnSolutions}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="bc-summary" className="block text-sm font-medium mb-1">
            Analysis Summary
          </label>
          <textarea
            id="bc-summary"
            name="analysisSummary"
            rows={4}
            defaultValue={current.analysisSummary}
            className={INPUT_CLASS}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium mb-2">Business Case Approval</legend>
          <div className="grid sm:grid-cols-2 gap-3">
            {APPROVAL_PARTIES.map((party) => {
              const existing = approvalsByParty.get(party);
              return (
                <div key={party} className="flex items-center gap-2 rounded border p-2">
                  <input
                    type="checkbox"
                    id={`approval_${party}`}
                    name={`approval_${party}`}
                    defaultChecked={existing?.approved ?? false}
                    className="h-4 w-4"
                  />
                  <label
                    htmlFor={`approval_${party}`}
                    className="text-sm font-medium w-28 shrink-0"
                  >
                    {APPROVAL_LABELS[party]}
                  </label>
                  <input
                    name={`approver_${party}`}
                    defaultValue={existing?.approverName}
                    placeholder="Genehmiger:in"
                    aria-label={`${APPROVAL_LABELS[party]} Genehmiger`}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              );
            })}
          </div>
        </fieldset>

        {state.error && (
          <p role="alert" className="text-red-600 text-sm">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-green-600 text-sm">
            Business Case gespeichert.
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {isPending ? "Speichern…" : "Business Case speichern"}
        </button>
      </form>

      {history.length > 0 && (
        <details className="rounded-lg border bg-muted/50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground/80">
            Versionshistorie ({history.length})
          </summary>
          <div className="mt-3 space-y-2">
            {history.map((v, i) => (
              <p key={i} className="text-xs text-muted-foreground/60">
                {new Date(v.savedAt).toLocaleString("de-DE")}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
