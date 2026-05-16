"use client";

import { useState, useTransition } from "react";
import { linkDependencyAction } from "@/features/dependencies/actions/dependency";

type DependencyType = "blocks" | "depends_on" | "relates_to";

interface Candidate {
  id: string;
  title: string;
}

interface Props {
  fromId: string;
  artId: string;
  candidates: Candidate[];
}

const TYPES: { value: DependencyType; label: string }[] = [
  { value: "blocks", label: "blocks" },
  { value: "depends_on", label: "depends on" },
  { value: "relates_to", label: "relates to" },
];

/** Dialog to link the current feature to another feature in the same ART. */
export function LinkDependencyDialog({ fromId, artId, candidates }: Props) {
  const [open, setOpen] = useState(false);
  const [toId, setToId] = useState("");
  const [type, setType] = useState<DependencyType>("blocks");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!toId) return;
    setError(null);
    startTransition(async () => {
      const result = await linkDependencyAction(fromId, toId, type, artId);
      if (result.error) {
        setError(result.error);
      } else {
        setToId("");
        setType("blocks");
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
        Link dependency
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Link a dependency</h2>

            {candidates.length === 0 ? (
              <p className="text-sm text-gray-400">No other features in this ART to depend on.</p>
            ) : (
              <>
                <div>
                  <label htmlFor="dep-type" className="block text-sm font-medium mb-1">
                    This feature…
                  </label>
                  <select
                    id="dep-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as DependencyType)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="dep-target" className="block text-sm font-medium mb-1">
                    Target feature
                  </label>
                  <select
                    id="dep-target"
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a feature…</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </>
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
                disabled={isPending || !toId}
                className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {isPending ? "Linking…" : "Link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
