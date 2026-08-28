"use client";

import { useEffect, useState } from "react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { IssueListRow } from "@/modules/risks/server/views/issues-list";
import { IssueDetailShell, type IssueCaps } from "./issue-detail-shell";

export type { IssueCaps };

interface Props {
  issues: IssueListRow[];
  userLabels: Record<string, string>;
  caps: IssueCaps;
  /** Features of the epic (Epic tab) — for the work-item link picker. */
  featureOptions?: { id: string; title: string }[];
}

/**
 * URL-getriebener (`?issue=<id>`) Slide-Over — rendert dieselbe
 * `IssueDetailShell` wie die Voll-Route `/issues/[id]`, hier mit lokalem
 * Tab-State (in-place statt Navigation) und ohne Zurück-Link.
 */
export function IssueDetailDrawer({ issues, userLabels, caps, featureOptions }: Props) {
  const { params, push } = useUrlState();
  const id = params.get("issue");
  const issue = id ? (issues.find((r) => r.id === id) ?? null) : null;
  const open = issue != null;
  const close = () => push({ issue: null });

  const [tab, setTab] = useState("details");
  useEffect(() => setTab("details"), [id]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:!max-w-3xl">
        {issue && (
          <div className="p-2">
            <IssueDetailShell
              issue={issue}
              userLabels={userLabels}
              caps={caps}
              {...(featureOptions ? { featureOptions } : {})}
              activeTab={tab}
              onTabChange={setTab}
              onClose={close}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
