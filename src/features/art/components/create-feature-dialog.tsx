"use client";

import { useActionState, useEffect, useState } from "react";
import { createFeatureAction } from "@/features/art/actions/feature";

const FIBONACCI = [1, 2, 3, 5, 8, 13, 20] as const;

interface Props {
  artId: string;
  epics: { id: string; title: string }[];
}

export function CreateFeatureDialog({ artId, epics }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(createFeatureAction, {});

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
      >
        New Feature
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold">Create Feature</h2>
            <form action={action} className="space-y-4">
              <input type="hidden" name="artId" value={artId} />

              <div>
                <label htmlFor="f-parent" className="block text-sm font-medium mb-1">
                  Parent Epic <span className="text-red-500">*</span>
                </label>
                <select
                  id="f-parent"
                  name="parentId"
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a parent epic…</option>
                  {epics.map((epic) => (
                    <option key={epic.id} value={epic.id}>
                      {epic.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="f-title" className="block text-sm font-medium mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="f-title"
                  name="title"
                  required
                  maxLength={200}
                  placeholder="e.g. User can reset password via email"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="f-desc" className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  id="f-desc"
                  name="description"
                  rows={3}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <fieldset className="border border-gray-200 rounded p-4 space-y-3">
                <legend className="text-sm font-medium px-1">WSJF Scoring</legend>
                {(
                  [
                    ["wsjfBusinessValue", "Business Value"],
                    ["wsjfTimeCriticality", "Time Criticality"],
                    ["wsjfRiskReduction", "Risk Reduction / Opportunity Enablement"],
                    ["wsjfJobSize", "Job Size"],
                  ] as const
                ).map(([name, label]) => (
                  <div key={name}>
                    <label htmlFor={`f-${name}`} className="block text-sm font-medium mb-1">
                      {label} <span className="text-red-500">*</span>
                    </label>
                    <select
                      id={`f-${name}`}
                      name={name}
                      required
                      defaultValue=""
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      {FIBONACCI.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </fieldset>

              <div>
                <label htmlFor="f-ac" className="block text-sm font-medium mb-1">
                  Acceptance Criteria
                </label>
                <textarea
                  id="f-ac"
                  name="acceptanceCriteria"
                  rows={4}
                  placeholder={"Given…\nWhen…\nThen…"}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">One criterion per line</p>
              </div>

              {state.error && (
                <p role="alert" className="text-red-600 text-sm">
                  {state.error}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {isPending ? "Creating…" : "Create Feature"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
