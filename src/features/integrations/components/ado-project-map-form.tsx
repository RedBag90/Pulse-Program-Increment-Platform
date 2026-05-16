"use client";

import { useActionState } from "react";
import { saveAdoProjectMapAction } from "@/features/integrations/actions/azure-devops";

interface Art {
  id: string;
  name: string;
}

interface Props {
  arts: Art[];
  currentMap: Record<string, string>;
}

export function AdoProjectMapForm({ arts, currentMap }: Props) {
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string }, fd: FormData) => {
      const map: Record<string, string> = {};
      for (const art of arts) {
        const val = fd.get(`art_${art.id}`);
        if (typeof val === "string" && val.trim()) {
          map[art.id] = val.trim();
        }
      }
      return saveAdoProjectMapAction(map);
    },
    {},
  );

  if (arts.length === 0) {
    return <p className="text-sm text-gray-400">No ARTs configured yet.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      {arts.map((art) => (
        <div key={art.id} className="flex items-center gap-3">
          <label className="w-40 text-sm text-gray-700 truncate shrink-0" title={art.name}>
            {art.name}
          </label>
          <input
            type="text"
            name={`art_${art.id}`}
            defaultValue={currentMap[art.id] ?? ""}
            placeholder="Organization/Project"
            className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ))}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "Saving…" : "Save mapping"}
      </button>
    </form>
  );
}
