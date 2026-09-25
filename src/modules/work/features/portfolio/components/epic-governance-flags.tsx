"use client";

import { useActionState, startTransition } from "react";
import { useTranslations } from "next-intl";
import { setEpicFlagAction } from "@/modules/work/features/portfolio/actions/epic";

interface Props {
  epicId: string;
  needsSteeringAttention: boolean;
  stagedForBudgeting: boolean;
}

const FLAGS = [
  { flag: "steering", labelKey: "work.epic.imNaechstenSteeringMeeting" },
  { flag: "budgeting", labelKey: "work.epic.fuersNaechsteBudgetMeeting" },
] as const;

/** Governance flags on the Epic overview — surface it in the next steering / budget meeting. */
export function EpicGovernanceFlags({ epicId, needsSteeringAttention, stagedForBudgeting }: Props) {
  const t = useTranslations();
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
    startTransition(() => submit(fd));
  }

  return (
    <ul className="space-y-1.5">
      {FLAGS.map(({ flag, labelKey }) => (
        <li key={flag}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked[flag]}
              disabled={busy}
              onChange={(e) => toggle(flag, e.target.checked)}
            />
            <span>{t(labelKey)}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
