"use client";

import { useActionState, useEffect, useState } from "react";
import { createEpicAction } from "@/features/portfolio/actions/epic";

interface ValueStream {
  id: string;
  name: string;
}

interface CreateEpicDialogProps {
  valueStreams: ValueStream[];
}

export function CreateEpicDialog({ valueStreams }: CreateEpicDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(createEpicAction, {});

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
        New Epic
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Create Epic</h2>
            <form action={action} className="space-y-4">
              <div>
                <label htmlFor="epic-title" className="block text-sm font-medium mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="epic-title"
                  name="title"
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="epic-vs" className="block text-sm font-medium mb-1">
                  Value Stream <span className="text-red-500">*</span>
                </label>
                <select
                  id="epic-vs"
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
                <label htmlFor="epic-description" className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  id="epic-description"
                  name="description"
                  rows={3}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                  {isPending ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
