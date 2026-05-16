"use client";

import { useActionState } from "react";
import { updateEpicAction } from "@/features/portfolio/actions/epic";

interface EpicEditFormProps {
  id: string;
  currentTitle: string;
  currentDescription: string;
}

export function EpicEditForm({ id, currentTitle, currentDescription }: EpicEditFormProps) {
  const [state, action, isPending] = useActionState(updateEpicAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />

      <div>
        <label htmlFor="epic-title" className="block text-sm font-medium mb-1">
          Title
        </label>
        <input
          id="epic-title"
          name="title"
          defaultValue={currentTitle}
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="epic-description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          id="epic-description"
          name="description"
          defaultValue={currentDescription}
          rows={5}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-red-600 text-sm">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-green-600 text-sm">
          Saved successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
