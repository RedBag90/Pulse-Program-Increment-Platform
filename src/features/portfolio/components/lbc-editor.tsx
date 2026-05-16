"use client";

import { useActionState } from "react";
import { saveLbcAction } from "@/features/portfolio/actions/lbc";

interface LbcData {
  problemStatement?: string;
  customerValue?: string;
  costEstimate?: string;
  roiEstimate?: string;
  successCriteria?: string;
  risks?: string;
}

interface LbcEditorProps {
  epicId: string;
  current: LbcData;
}

export function LbcEditor({ epicId, current }: LbcEditorProps) {
  const [state, action, isPending] = useActionState(saveLbcAction, {});

  return (
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
  );
}
