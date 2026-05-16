"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useCallback } from "react";

interface Pi {
  id: string;
  name: string;
}

interface Props {
  pis: Pi[];
  currentStatus: string;
  currentPiId: string;
}

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

export function FeatureFilters({ pis, currentStatus, currentPiId }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(window.location.search);
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname],
  );

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        value={currentStatus}
        onChange={(e) => update("status", e.target.value)}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {STATUSES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={currentPiId}
        onChange={(e) => update("piId", e.target.value)}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All PIs</option>
        <option value="backlog">Backlog (no PI)</option>
        {pis.map((pi) => (
          <option key={pi.id} value={pi.id}>
            {pi.name}
          </option>
        ))}
      </select>
    </div>
  );
}
