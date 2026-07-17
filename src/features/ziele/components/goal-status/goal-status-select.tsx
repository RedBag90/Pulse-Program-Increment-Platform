"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  OPEN_STATUSES,
  CLOSED_STATUSES,
  GOAL_STATUS_LABELS,
  GOAL_STATUS_TIER,
  goalStatusLabel,
  type GoalStatus,
  type GoalStatusTier,
} from "@/domain/goal-status";

const DOT_CLS: Record<GoalStatusTier, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  neutral: "bg-slate-400",
};

interface Props {
  value: string | null;
  onChange: (status: GoalStatus) => void;
  /** Optional suggested open status highlighted with a "Suggested" hint. */
  suggested?: GoalStatus | null;
  disabled?: boolean;
}

/**
 * Grouped Open/Closed status picker (Asana "Update status" dropdown).
 * Two sections, coloured dots, optional auto-suggest hint on the open status.
 */
export function GoalStatusSelect({ value, onChange, suggested, disabled }: Props) {
  const [open, setOpen] = useState(false);

  function pick(s: GoalStatus) {
    onChange(s);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-sm font-medium shadow-xs hover:bg-muted/50 disabled:opacity-50"
      >
        {goalStatusLabel(value)}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <Group label="Open">
          {OPEN_STATUSES.map((s) => (
            <Option
              key={s}
              status={s}
              active={value === s}
              suggested={suggested === s}
              onPick={pick}
            />
          ))}
        </Group>
        <div className="my-1 border-t" />
        <Group label="Closed">
          {CLOSED_STATUSES.map((s) => (
            <Option key={s} status={s} active={value === s} onPick={pick} />
          ))}
        </Group>
      </PopoverContent>
    </Popover>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Option({
  status,
  active,
  suggested,
  onPick,
}: {
  status: GoalStatus;
  active: boolean;
  suggested?: boolean;
  onPick: (s: GoalStatus) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(status)}
      aria-pressed={active}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${
        active ? "bg-muted font-medium" : ""
      }`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${DOT_CLS[GOAL_STATUS_TIER[status]]}`} />
      {GOAL_STATUS_LABELS[status]}
      {suggested && (
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          Vorschlag
        </span>
      )}
    </button>
  );
}
