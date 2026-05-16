"use client";

import { useState, useTransition } from "react";
import { saveJiraProjectMapAction } from "@/features/integrations/actions/jira";

interface Art {
  id: string;
  name: string;
}

interface Props {
  arts: Art[];
  currentMap: Record<string, string>;
}

export function JiraProjectMapForm({ arts, currentMap }: Props) {
  const [map, setMap] = useState<Record<string, string>>(currentMap);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(artId: string, value: string) {
    setMap((prev) => ({ ...prev, [artId]: value }));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveJiraProjectMapAction(map);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Map each ART to its Jira project key. Stories created in that ART will be pushed to the
        corresponding Jira project.
      </p>
      <div className="space-y-2">
        {arts.map((art) => (
          <div key={art.id} className="flex items-center gap-3">
            <label className="w-48 text-sm text-foreground/80 truncate" title={art.name}>
              {art.name}
            </label>
            <input
              value={map[art.id] ?? ""}
              onChange={(e) => handleChange(art.id, e.target.value.toUpperCase())}
              placeholder="e.g. PROJ"
              maxLength={20}
              className="w-32 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Project mapping saved.</p>}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save Mapping"}
      </button>
    </div>
  );
}
