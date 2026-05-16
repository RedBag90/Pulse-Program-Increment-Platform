"use client";

import { useActionState, useEffect, useState } from "react";
import { createValueStreamAction } from "@/features/portfolio/actions/value-stream";

export function CreateValueStreamDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(createValueStreamAction, {});

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
        New Value Stream
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Create Value Stream</h2>
            <form action={action} className="space-y-4">
              <div>
                <label htmlFor="vs-name" className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="vs-name"
                  name="name"
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="vs-description" className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  id="vs-description"
                  name="description"
                  rows={3}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="vs-budget" className="block text-sm font-medium mb-1">
                    Budget
                  </label>
                  <input
                    id="vs-budget"
                    name="budgetAmount"
                    placeholder="100000.00"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="w-24">
                  <label htmlFor="vs-currency" className="block text-sm font-medium mb-1">
                    Currency
                  </label>
                  <input
                    id="vs-currency"
                    name="budgetCurrency"
                    maxLength={3}
                    placeholder="EUR"
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
