"use client";

import { useActionState, useRef, useState } from "react";
import {
  createPiObjectiveAction,
  type CreatePiObjectiveState,
} from "@/features/pi/actions/pi-objective";

interface Team {
  id: string;
  name: string;
}

interface Props {
  piId: string;
  artId: string;
  teams: Team[];
}

const initialState: CreatePiObjectiveState = {};

export function CreatePiObjectiveDialog({ piId, artId, teams }: Props) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createPiObjectiveAction, initialState);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Add Objective
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-semibold">Add PI Objective</h2>

        <form
          ref={formRef}
          action={async (fd) => {
            await action(fd);
            if (!state.errors) {
              setOpen(false);
              formRef.current?.reset();
            }
          }}
          className="space-y-4"
        >
          <input type="hidden" name="piId" value={piId} />
          <input type="hidden" name="artId" value={artId} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team *</label>
            <select
              name="teamId"
              required
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select team…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {state.errors?.teamId && (
              <p className="mt-1 text-xs text-red-600">{state.errors.teamId[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              name="title"
              type="text"
              required
              placeholder="Deploy new payment service"
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
              placeholder="Optional details…"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Value (1–10)
              </label>
              <input
                name="businessValue"
                type="number"
                min={1}
                max={10}
                placeholder="8"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                name="committed"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="true">Committed</option>
                <option value="false">Uncommitted</option>
              </select>
            </div>
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
              {pending ? "Saving…" : "Add Objective"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
