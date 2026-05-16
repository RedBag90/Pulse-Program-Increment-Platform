"use client";

import { useActionState, useRef } from "react";
import {
  createImpedimentAction,
  type ImpedimentActionState,
} from "@/features/impediment/actions/impediment";

interface Props {
  artId: string;
  onCreated?: () => void;
}

const initialState: ImpedimentActionState = {};

export function CreateImpedimentDialog({ artId, onCreated }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: ImpedimentActionState, formData: FormData) => {
      const result = await createImpedimentAction(prev, formData);
      if (result.success) {
        dialogRef.current?.close();
        formRef.current?.reset();
        onCreated?.();
      }
      return result;
    },
    initialState,
  );

  return (
    <>
      <button
        onClick={() => dialogRef.current?.showModal()}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
      >
        Log Impediment
      </button>

      <dialog
        ref={dialogRef}
        className="rounded-xl shadow-xl p-0 w-full max-w-lg backdrop:bg-black/40"
      >
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Log Impediment</h2>

          <form ref={formRef} action={formAction} className="space-y-4">
            <input type="hidden" name="artId" value={artId} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                required
                maxLength={300}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Short description of the impediment"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                rows={3}
                maxLength={5000}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional context, impact, or details"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select
                name="severity"
                defaultValue="medium"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {state.error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{state.error}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Log Impediment"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
