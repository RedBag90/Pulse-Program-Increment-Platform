"use client";

import { useTransition, useState } from "react";
import { assignSprintAction } from "@/features/story/actions/assign-sprint";

interface Sprint {
  id: string;
  indexInPi: number;
  piName: string;
}

interface Props {
  story: {
    id: string;
    title: string;
    status: string;
    storyPoints: number | null;
    parentTitle: string | null;
  };
  sprints: Sprint[];
  artId: string;
  teamId: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700",
  blocked: "bg-red-100 text-red-700",
  completed: "bg-green-100 text-green-700",
};

export function BacklogStoryRow({ story, sprints, artId, teamId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");

  function handleAssign(sprintId: string) {
    setSelected(sprintId);
    startTransition(async () => {
      await assignSprintAction(story.id, sprintId || null, artId, teamId);
    });
  }

  const statusCls = STATUS_COLORS[story.status] ?? STATUS_COLORS["draft"]!;

  return (
    <tr className={`border-b last:border-0 ${isPending ? "opacity-50" : ""}`}>
      <td className="px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">{story.title}</p>
          {story.parentTitle && (
            <p className="text-xs text-muted-foreground/60">{story.parentTitle}</p>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        {story.storyPoints !== null ? (
          <span className="text-sm font-medium text-foreground/80">{story.storyPoints}</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${statusCls}`}>
          {story.status}
        </span>
      </td>
      <td className="px-3 py-3">
        <select
          value={selected}
          onChange={(e) => handleAssign(e.target.value)}
          disabled={isPending}
          className="rounded-md border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">Assign to sprint…</option>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.piName} — Sprint {s.indexInPi}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
