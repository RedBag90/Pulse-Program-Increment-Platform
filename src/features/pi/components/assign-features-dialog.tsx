"use client";

import { useState, useTransition } from "react";
import { setFeaturePiAction } from "@/features/art/actions/feature";

interface Candidate {
  id: string;
  title: string;
  wsjfComputed: number | null;
  currentPiName: string | null;
}

interface Props {
  piId: string;
  artId: string;
  candidates: Candidate[];
}

/** PI-overview picker: multi-select candidate features and assign them to this PI. */
export function AssignFeaturesDialog({ piId, artId, candidates }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    if (selected.size === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await setFeaturePiAction([...selected], piId, artId);
      if (result.error) {
        setError(result.error);
      } else {
        setSelected(new Set());
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800"
      >
        Add Features
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold">Add Features to this PI</h2>

            {candidates.length === 0 ? (
              <p className="text-sm text-gray-400">
                No assignable features in this ART. Create features under an Epic first.
              </p>
            ) : (
              <div className="rounded-lg border divide-y max-h-80 overflow-y-auto">
                {candidates.map((f) => (
                  <label
                    key={f.id}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(f.id)}
                      onChange={() => toggle(f.id)}
                    />
                    <span className="flex-1">{f.title}</span>
                    {f.wsjfComputed !== null && (
                      <span className="text-xs font-medium text-blue-700">
                        WSJF {f.wsjfComputed.toFixed(2)}
                      </span>
                    )}
                    {f.currentPiName && (
                      <span className="text-[10px] rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5">
                        in {f.currentPiName}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {error && (
              <p role="alert" className="text-red-600 text-sm">
                {error}
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
                type="button"
                onClick={handleSubmit}
                disabled={isPending || selected.size === 0}
                className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {isPending ? "Adding…" : selected.size > 0 ? `Add ${selected.size}` : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Inline "Remove" control for an assigned feature row — moves it back to the backlog. */
export function RemoveFromPiButton({ featureId, artId }: { featureId: string; artId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await setFeaturePiAction([featureId], null, artId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <span className="flex items-center gap-1">
      {error && <span className="text-[10px] text-red-600">{error}</span>}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
      >
        {isPending ? "…" : "Remove"}
      </button>
    </span>
  );
}
