"use client";

import { useActionState, useEffect, useState } from "react";
import { createPiAction } from "@/features/pi/actions/pi";

interface Props {
  artId: string;
}

export function CreatePiDialog({ artId }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(createPiAction, {});

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
        New PI
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Create Program Increment</h2>
            <form action={action} className="space-y-4">
              <input type="hidden" name="artId" value={artId} />

              <div>
                <label htmlFor="pi-name" className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="pi-name"
                  name="name"
                  required
                  maxLength={100}
                  placeholder="e.g. PI 2025-Q3"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pi-start" className="block text-sm font-medium mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="pi-start"
                    name="startDate"
                    type="date"
                    required
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="pi-end" className="block text-sm font-medium mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="pi-end"
                    name="endDate"
                    type="date"
                    required
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
                  {isPending ? "Creating…" : "Create PI"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
