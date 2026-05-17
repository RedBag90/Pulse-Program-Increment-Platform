import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { EpicActivitySidebar, type ActivityItem } from "./epic-activity-sidebar";

/** Tab set of the Epic detail page. Adding a tab = one entry here + one branch in the page. */
export const EPIC_TABS = [
  { key: "overview", label: "Overview" },
  { key: "business-case", label: "Business Case" },
  { key: "benefit-hypothesis", label: "Benefit Hypothese" },
  { key: "breakdown", label: "Breakdown" },
  { key: "kpis", label: "KPIs" },
  { key: "history", label: "History" },
] as const;

export type EpicTabKey = (typeof EPIC_TABS)[number]["key"];

export const STAGE_GATE_LABELS: Record<string, string> = {
  L0: "L0 Funnel",
  L1: "L1 Reviewing",
  L2: "L2 Analyzing",
  L3: "L3 Portfolio Backlog",
  L4: "L4 Implementing",
  L5: "L5 Done",
};

/** Narrows an arbitrary `?tab=` value to a known tab key, defaulting to Overview. */
export function resolveEpicTab(raw: string | undefined): EpicTabKey {
  return EPIC_TABS.some((t) => t.key === raw) ? (raw as EpicTabKey) : "overview";
}

interface Props {
  epicId: string;
  title: string;
  stageGate: string;
  activeTab: EpicTabKey;
  activityEvents: ActivityItem[];
  headerActions?: ReactNode;
  children: ReactNode;
}

/**
 * Three-zone detail layout: header on top, then left tab rail · center content
 * · right activity sidebar. The page passes the active tab's content as
 * `children`; the shell owns navigation and the audit feed.
 */
export function EpicDetailShell({
  epicId,
  title,
  stageGate,
  activeTab,
  activityEvents,
  headerActions,
  children,
}: Props) {
  return (
    <div className="flex flex-col">
      <header className="border-b px-6 py-4">
        <Link href="/portfolio/epics" className="text-sm text-primary hover:underline">
          ← Zurück zu den Epics
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {STAGE_GATE_LABELS[stageGate] ?? stageGate}
          </span>
          {headerActions && <div className="ml-auto">{headerActions}</div>}
        </div>
      </header>

      <div className="flex min-h-[70vh]">
        <nav aria-label="Initiative-Bereiche" className="w-48 shrink-0 border-r p-2">
          <ul className="space-y-0.5">
            {EPIC_TABS.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <li key={tab.key}>
                  <Link
                    href={`/portfolio/epics/${epicId}?tab=${tab.key}`}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 overflow-auto p-6">{children}</main>

        <EpicActivitySidebar events={activityEvents} />
      </div>
    </div>
  );
}
