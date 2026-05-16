"use client";

import { useActionState, useRef, useState } from "react";
import { createStoryAction, type CreateStoryState } from "@/features/story/actions/story";

interface Sprint {
  id: string;
  indexInPi: number;
  team: { name: string };
}

interface Props {
  featureId: string;
  artId: string;
  sprints: Sprint[];
}

const initialState: CreateStoryState = {};

export function CreateStoryDialog({ featureId, artId, sprints }: Props) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createStoryAction, initialState);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Add Story
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-semibold">Add Story</h2>

        <form
          ref={formRef}
          action={async (fd) => {
            await action(fd);
            if (!state.errors && !state.message) {
              setOpen(false);
              formRef.current?.reset();
            }
          }}
          className="space-y-4"
        >
          <input type="hidden" name="featureId" value={featureId} />
          <input type="hidden" name="artId" value={artId} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              name="title"
              type="text"
              required
              placeholder="As a user, I want to…"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {state.errors?.title && (
              <p className="mt-1 text-xs text-red-600">{state.errors.title[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              rows={2}
              placeholder="Optional context…"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Acceptance Criteria
              <span className="text-gray-400 font-normal ml-1">(one per line)</span>
            </label>
            <textarea
              name="acceptanceCriteria"
              rows={3}
              placeholder="Given… When… Then…"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Story Points</label>
              <input
                name="storyPoints"
                type="number"
                min={1}
                max={100}
                placeholder="5"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {sprints.length > 0 && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Sprint</label>
                <select
                  name="sprintId"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {sprints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.team.name} — Sprint {s.indexInPi}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {state.message && <p className="text-sm text-red-600">{state.message}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Add Story"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
