"use client";

import { useActionState, useState } from "react";
import { createArtAction } from "@/features/art/actions/art";

interface Props {
  valueStreams: { id: string; name: string }[];
}

export function CreateArtDialog({ valueStreams }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(createArtAction, {});

  if (state.success && open) setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
      >
        New ART
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Create Agile Release Train</h2>
            <form action={action} className="space-y-4">
              <div>
                <label htmlFor="art-vs" className="block text-sm font-medium mb-1">
                  Value Stream <span className="text-red-500">*</span>
                </label>
                <select
                  id="art-vs"
                  name="valueStreamId"
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a value stream…</option>
                  {valueStreams.map((vs) => (
                    <option key={vs.id} value={vs.id}>
                      {vs.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="art-name" className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="art-name"
                  name="name"
                  required
                  maxLength={100}
                  placeholder="e.g. Platform ART"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="art-cadence" className="block text-sm font-medium mb-1">
                  PI Cadence (weeks)
                </label>
                <input
                  id="art-cadence"
                  name="piCadenceWeeks"
                  type="number"
                  min={8}
                  max={12}
                  placeholder="10"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Typical PI cadence is 10 weeks (8–12)</p>
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
                  {isPending ? "Creating…" : "Create ART"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
