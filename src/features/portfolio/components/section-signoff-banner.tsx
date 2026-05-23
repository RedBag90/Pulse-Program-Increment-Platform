"use client";

import { CheckCircle2 } from "lucide-react";
import { SectionSignoffButtons } from "./approval-controls";
import type { ApprovalSection } from "@/domain/epic-approval";

/** A section's sign-off state for the Epic's active approval revision. */
export interface SectionSignoff {
  /** This section's sign-off status in the active revision. */
  status: string;
  /** True while the workflow is awaiting stakeholder sign-offs. */
  active: boolean;
  /** Whether the viewer may sign off (reviewer roles). */
  canSignoff: boolean;
}

interface Props extends SectionSignoff {
  epicId: string;
  section: ApprovalSection;
}

/**
 * Brings the approval sign-off to where the content lives: on the Breakdown and
 * KPIs tabs, a reviewer signs the section off for the Epic's release without
 * hopping to the Freigaben tab. Renders nothing outside the sign-off window.
 */
export function SectionSignoffBanner({ epicId, section, status, active, canSignoff }: Props) {
  if (status === "approved") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Für die Epic-Freigabe abgenommen.
      </div>
    );
  }
  if (!active || !canSignoff) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
      <p className="text-sm text-indigo-900">Du prüfst diesen Abschnitt für die Epic-Freigabe.</p>
      <SectionSignoffButtons epicId={epicId} section={section} />
    </div>
  );
}
