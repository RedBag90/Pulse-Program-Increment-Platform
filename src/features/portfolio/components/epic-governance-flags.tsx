"use client";

import { useActionState } from "react";
import { setEpicFlagAction } from "@/features/portfolio/actions/epic";

interface Props {
  epicId: string;
  needsSteeringAttention: boolean;
  stagedForBudgeting: boolean;
}

const FLAGS = [
  { flag: "steering", label: "Im nächsten Steering-Meeting behandeln" },
  { flag: "budgeting", label: "Fürs nächste Budget-Meeting vormerken" },
] as const;

/** Governance flags on the Epic overview — surface it in the next steering / budget meeting. */
export function EpicGovernanceFlags({ epicId, needsSteeringAttention, stagedForBudgeting }: Props) {
  const [, submit, busy] = useActionState(setEpicFlagAction, {});
  const checked: Record<(typeof FLAGS)[number]["flag"], boolean> = {
    steering: needsSteeringAttention,
    budgeting: stagedForBudgeting,
  };

  function toggle(flag: string, on: boolean) {
    const fd = new FormData();
    fd.set("id", epicId);
    fd.set("flag", flag);
    fd.set("value", on ? "true" : "false");
    submit(fd);
  }

  return (
    <ul className="space-y-1.5">
      {FLAGS.map(({ flag, label }) => (
        <li key={flag}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked[flag]}
              disabled={busy}
              onChange={(e) => toggle(flag, e.target.checked)}
            />
            <span>{label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
