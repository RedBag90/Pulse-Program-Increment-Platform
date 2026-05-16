"use client";

import { useState, useTransition } from "react";
import { setFeaturePiAction } from "@/features/art/actions/feature";

interface Pi {
  id: string;
  name: string;
}

interface Props {
  featureId: string;
  artId: string;
  currentPiId: string | null;
  pis: Pi[];
}

/** Inline PI assignment dropdown for a feature row in the backlog list. */
export function FeaturePiSelect({ featureId, artId, currentPiId, pis }: Props) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(currentPiId ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: string) {
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await setFeaturePiAction([featureId], next || null, artId);
      if (result.error) {
        setError(result.error);
        setValue(currentPiId ?? "");
      }
    });
  }

  return (
    <div className="space-y-0.5">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="rounded-md border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        <option value="">Backlog</option>
        {pis.map((pi) => (
          <option key={pi.id} value={pi.id}>
            {pi.name}
          </option>
        ))}
      </select>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
