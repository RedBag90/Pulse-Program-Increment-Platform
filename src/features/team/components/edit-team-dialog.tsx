"use client";

import { useActionState, useState, useEffect } from "react";
import { updateTeamAction } from "@/features/team/actions/team";

interface EditTeamDialogProps {
  id: string;
  artId: string;
  name: string;
}

export function EditTeamDialog({ id, artId, name }: EditTeamDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(updateTeamAction, {});

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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">Edit Team</h2>
            <form action={action} className="space-y-4">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="artId" value={artId} />
              <div>
                <label htmlFor="edit-team-name" className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-team-name"
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={name}
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
