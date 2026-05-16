"use client";

import { useActionState, useState, useEffect } from "react";
import { updateValueStreamAction } from "@/features/portfolio/actions/value-stream";

interface EditValueStreamDialogProps {
  id: string;
  name: string;
  description?: string | null;
  budgetAmount?: string | null;
  budgetCurrency?: string | null;
}

export function EditValueStreamDialog({
  id,
  name,
  description,
  budgetAmount,
  budgetCurrency,
}: EditValueStreamDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(updateValueStreamAction, {});

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-blue-700 text-xs hover:underline"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Edit Value Stream</h2>
            <form action={action} className="space-y-4">
              <input type="hidden" name="id" value={id} />
              <div>
                <label htmlFor="edit-vs-name" className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-vs-name"
                  name="name"
                  required
                  defaultValue={name}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="edit-vs-description" className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  id="edit-vs-description"
                  name="description"
                  rows={3}
                  defaultValue={description ?? ""}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="edit-vs-budget" className="block text-sm font-medium mb-1">
                    Budget
                  </label>
                  <input
                    id="edit-vs-budget"
                    name="budgetAmount"
                    defaultValue={budgetAmount ?? ""}
                    placeholder="100000.00"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="w-24">
                  <label htmlFor="edit-vs-currency" className="block text-sm font-medium mb-1">
                    Currency
                  </label>
                  <input
                    id="edit-vs-currency"
                    name="budgetCurrency"
                    maxLength={3}
                    defaultValue={budgetCurrency ?? ""}
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
                  {isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
