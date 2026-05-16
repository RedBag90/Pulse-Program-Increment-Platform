"use client";

import { useActionState } from "react";
import { saveLbcAction } from "@/features/portfolio/actions/lbc";
import type { LbcFields, LbcVersion } from "@/domain/lbc";

interface LbcEditorProps {
  epicId: string;
  current: LbcFields;
  history: LbcVersion[];
}

const FIELD_LABELS: Record<keyof LbcFields, string> = {
  problemStatement: "Problem Statement",
  customerValue: "Customer Value",
  costEstimate: "Cost Estimate",
  roiEstimate: "ROI Estimate",
  successCriteria: "Success Criteria",
  risks: "Risks",
};

export function LbcEditor({ epicId, current, history }: LbcEditorProps) {
  const [state, action, isPending] = useActionState(saveLbcAction, {});

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-6">
        <input type="hidden" name="epicId" value={epicId} />

        <div>
          <label htmlFor="lbc-problem" className="block text-sm font-medium mb-1">
            Problem Statement
          </label>
          <textarea
            id="lbc-problem"
            name="problemStatement"
            rows={4}
            defaultValue={current.problemStatement}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What problem are we solving and for whom?"
          />
        </div>

        <div>
          <label htmlFor="lbc-customer" className="block text-sm font-medium mb-1">
            Customer Value
          </label>
          <textarea
            id="lbc-customer"
            name="customerValue"
            rows={4}
            defaultValue={current.customerValue}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What value does this create for customers?"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="lbc-cost" className="block text-sm font-medium mb-1">
              Cost Estimate
            </label>
            <input
              id="lbc-cost"
              name="costEstimate"
              defaultValue={current.costEstimate}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. €250k over 6 months"
            />
          </div>
          <div>
            <label htmlFor="lbc-roi" className="block text-sm font-medium mb-1">
              ROI Estimate
            </label>
            <input
              id="lbc-roi"
              name="roiEstimate"
              defaultValue={current.roiEstimate}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 3× ROI within 18 months"
            />
          </div>
        </div>

        <div>
          <label htmlFor="lbc-success" className="block text-sm font-medium mb-1">
            Success Criteria
          </label>
          <textarea
            id="lbc-success"
            name="successCriteria"
            rows={3}
            defaultValue={current.successCriteria}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="How will we know we succeeded?"
          />
        </div>

        <div>
          <label htmlFor="lbc-risks" className="block text-sm font-medium mb-1">
            Risks
          </label>
          <textarea
            id="lbc-risks"
            name="risks"
            rows={3}
            defaultValue={current.risks}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What are the key risks and mitigations?"
          />
        </div>

        {state.error && (
          <p role="alert" className="text-red-600 text-sm">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-green-600 text-sm">
            Lean Business Case saved.
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save LBC"}
        </button>
      </form>

      {history.length > 0 && (
        <details className="rounded-lg border bg-gray-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            Version history ({history.length})
          </summary>
          <div className="mt-3 space-y-3">
            {history.map((v, i) => (
              <div key={i} className="rounded border bg-white p-3 text-xs space-y-1">
                <p className="text-gray-400">{new Date(v.savedAt).toLocaleString("en-GB")}</p>
                {(Object.keys(FIELD_LABELS) as (keyof LbcFields)[])
                  .filter((k) => v.content[k])
                  .map((k) => (
                    <p key={k}>
                      <span className="font-medium text-gray-600">{FIELD_LABELS[k]}:</span>{" "}
                      <span className="text-gray-700">{v.content[k]}</span>
                    </p>
                  ))}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
