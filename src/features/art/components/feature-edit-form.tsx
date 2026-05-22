"use client";

import { useActionState } from "react";
import { updateFeatureAction } from "@/features/art/actions/feature";

interface FeatureEditFormProps {
  id: string;
  artId: string;
  currentTitle: string;
  currentDescription: string;
}

/** Title + description editor for a Feature — mirror of EpicEditForm. Posts
 *  updateFeatureAction (which also carries the required artId for the scope check). */
export function FeatureEditForm({
  id,
  artId,
  currentTitle,
  currentDescription,
}: FeatureEditFormProps) {
  const [state, action, isPending] = useActionState(updateFeatureAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="artId" value={artId} />

      <div>
        <label htmlFor="feature-title" className="block text-sm font-medium mb-1">
          Title
        </label>
        <input
          id="feature-title"
          name="title"
          defaultValue={currentTitle}
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="feature-description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          id="feature-description"
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
