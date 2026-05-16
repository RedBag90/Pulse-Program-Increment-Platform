"use client";

import { useTransition, useState } from "react";
import {
  escalateImpedimentAction,
  resolveImpedimentAction,
} from "@/features/impediment/actions/impediment";

interface Impediment {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  raisedBy: string;
  resolution: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

interface Props {
  impediment: Impediment;
  artId: string;
}

const severityColor: Record<string, string> = {
  low: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const statusColor: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  escalated: "bg-purple-100 text-purple-700",
  resolved: "bg-muted text-muted-foreground",
};

export function ImpedimentRow({ impediment, artId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolution, setResolution] = useState("");

  function handleEscalate() {
    setError(null);
    startTransition(async () => {
      const result = await escalateImpedimentAction(impediment.id, artId);
      if (result.error) setError(result.error);
    });
  }

  function handleResolve() {
    if (!resolution.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await resolveImpedimentAction(impediment.id, artId, resolution);
      if (result.error) {
        setError(result.error);
      } else {
        setShowResolveForm(false);
        setResolution("");
      }
    });
  }

  return (
    <div className="bg-white border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${severityColor[impediment.severity] ?? "bg-muted text-muted-foreground"}`}
            >
              {impediment.severity}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor[impediment.status] ?? "bg-muted text-muted-foreground"}`}
            >
              {impediment.status}
            </span>
            <span className="text-xs text-muted-foreground/60">
              {new Date(impediment.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">{impediment.title}</p>
          {impediment.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{impediment.description}</p>
          )}
          {impediment.resolution && (
            <p className="text-sm text-green-700 bg-green-50 rounded px-2 py-1 mt-1">
              Resolution: {impediment.resolution}
            </p>
          )}
        </div>

        {impediment.status !== "resolved" && (
          <div className="flex items-center gap-2 shrink-0">
            {impediment.status === "open" && (
              <button
                onClick={handleEscalate}
                disabled={isPending}
                className="px-3 py-1 text-xs font-medium text-purple-700 border border-purple-300 rounded hover:bg-purple-50 disabled:opacity-50"
              >
                Escalate
              </button>
            )}
            <button
              onClick={() => setShowResolveForm((v) => !v)}
              disabled={isPending}
              className="px-3 py-1 text-xs font-medium text-green-700 border border-green-300 rounded hover:bg-green-50 disabled:opacity-50"
            >
              Resolve
            </button>
          </div>
        )}
      </div>

      {showResolveForm && (
        <div className="pt-2 space-y-2">
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={2}
            maxLength={5000}
            placeholder="Describe how this was resolved…"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleResolve}
              disabled={isPending || !resolution.trim()}
              className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Mark Resolved"}
            </button>
            <button
              onClick={() => {
                setShowResolveForm(false);
                setResolution("");
              }}
              className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
