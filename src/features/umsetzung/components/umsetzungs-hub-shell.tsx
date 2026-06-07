"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowRight, Compass, Hammer, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";

type HubTab = "overview" | "backlog" | "risks";

const TABS: { key: HubTab; label: string; description: string; icon: typeof Compass }[] = [
  {
    key: "overview",
    label: "Übersicht",
    description:
      "Cross-ART-Status, Today-Counters und Predictability — wandert in Roadmap-P3 hierher.",
    icon: Compass,
  },
  {
    key: "backlog",
    label: "Backlog (Cross-ART)",
    description:
      "Die heutige Features-Übersicht zieht in Roadmap-P0.B/P2 unter den Hub. Bis dahin Direkt-Link.",
    icon: Hammer,
  },
  {
    key: "risks",
    label: "Cross-ART-Risks & Improvements",
    description:
      "Risk-Register (Roadmap-P5) und Retro-Action-Items (P6) liefern hier ihre Cross-ART-Aggregate.",
    icon: ShieldAlert,
  },
];

/**
 * Umsetzungs-Hub-Shell — URL-State Tabs, drei Platzhalter-Sektionen.
 *
 * Die echten Inhalte ziehen phasenweise ein (siehe Roadmap):
 * - **Übersicht**: Cross-ART-Status (P3, ART-Hub liefert die Bausteine).
 * - **Backlog**: heutige Features-Übersicht (Move in P0.B/P2).
 * - **Risks/Improvements**: Risk-Register (P5) + Retro-Action-Items (P6).
 */
export function UmsetzungsHubShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab");
  const active: HubTab = TABS.some((t) => t.key === rawTab) ? (rawTab as HubTab) : "overview";

  const setTab = useCallback(
    (tab: HubTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "overview") params.delete("tab");
      else params.set("tab", tab);
      const next = params.toString();
      router.replace(`${pathname}${next ? `?${next}` : ""}` as never, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <main className="space-y-6 p-6 md:p-8">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Umsetzung</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Konsolidierungs-Hub für ART/PI/Feature-Delivery. Der Hub füllt sich phasenweise; bis dahin
          verlinken die Tabs auf die bestehenden Surfaces.
        </p>
      </header>

      <nav aria-label="Hub-Bereiche" className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={isActive ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {TABS.filter((t) => t.key === active).map((t) => (
        <section
          key={t.key}
          className="rounded-lg border bg-card p-6"
          aria-labelledby={`tab-${t.key}-title`}
        >
          <div className="flex items-start gap-3">
            <t.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="space-y-3">
              <h2 id={`tab-${t.key}-title`} className="text-lg font-medium">
                {t.label}
              </h2>
              <p className="text-sm text-muted-foreground">{t.description}</p>
              <TabPlaceholderLinks tab={t.key} />
            </div>
          </div>
        </section>
      ))}
    </main>
  );
}

function TabPlaceholderLinks({ tab }: { tab: HubTab }) {
  if (tab === "overview") {
    return (
      <ul className="space-y-1.5 text-sm">
        <li>
          <HubLink href="/rte">RTE-Cockpit (heutige Cross-ART-Sicht)</HubLink>
        </li>
        <li>
          <HubLink href="/pi-planning">PI-Planning</HubLink>
        </li>
      </ul>
    );
  }
  if (tab === "backlog") {
    return (
      <ul className="space-y-1.5 text-sm">
        <li>
          <HubLink href="/implementation/features">Features-Übersicht (heute)</HubLink>
        </li>
      </ul>
    );
  }
  return (
    <ul className="space-y-1.5 text-sm">
      <li>
        <HubLink href="/impediments">Impediments / ROAM (heute)</HubLink>
      </li>
      <li>
        <HubLink href="/dependencies">Dependencies (heute)</HubLink>
      </li>
    </ul>
  );
}

function HubLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href as never}
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      {children} <ArrowRight className="size-3" />
    </Link>
  );
}
