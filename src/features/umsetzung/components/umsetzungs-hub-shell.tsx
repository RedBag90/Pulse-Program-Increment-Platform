"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowRight, CalendarRange, Compass, Hammer, Network, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";

export interface HubPiRow {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
  artName: string | null;
}

export interface HubArtRow {
  id: string;
  name: string;
  valueStreamName: string | null;
}

interface Props {
  arts: HubArtRow[];
  pis: HubPiRow[];
}

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
export function UmsetzungsHubShell({ arts, pis }: Props) {
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
            <div className="flex-1 space-y-3">
              <h2 id={`tab-${t.key}-title`} className="text-lg font-medium">
                {t.label}
              </h2>
              <p className="text-sm text-muted-foreground">{t.description}</p>
              {t.key === "overview" && (
                <>
                  <ArtList arts={arts} />
                  <PiList pis={pis} />
                </>
              )}
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

const PI_STATUS_CLASS: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
};
const PI_STATUS_LABEL: Record<string, string> = {
  planned: "Geplant",
  active: "Aktiv",
  completed: "Abgeschlossen",
};

function ArtList({ arts }: { arts: HubArtRow[] }) {
  if (arts.length === 0) {
    return (
      <p className="rounded-md border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
        Keine ARTs in deinem Scope.
      </p>
    );
  }
  return (
    <div className="rounded-lg border bg-card">
      <header className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Agile Release Trains — Sprung in den ART-Hub
      </header>
      <ul className="divide-y">
        {arts.map((a) => (
          <li key={a.id}>
            <Link
              href={`/umsetzung/art/${a.id}` as never}
              className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40"
            >
              <Network className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium">{a.name}</span>
              {a.valueStreamName && (
                <span className="text-xs text-muted-foreground">VS {a.valueStreamName}</span>
              )}
              <ArrowRight className="ml-auto size-3.5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PiList({ pis }: { pis: HubPiRow[] }) {
  if (pis.length === 0) {
    return (
      <p className="rounded-md border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
        Keine PIs in deinem Scope.
      </p>
    );
  }
  return (
    <div className="rounded-lg border bg-card">
      <header className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Program Increments — Sprung in den Workspace
      </header>
      <ul className="divide-y">
        {pis.map((p) => (
          <li key={p.id}>
            <Link
              href={`/umsetzung/pi/${p.id}` as never}
              className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40"
            >
              <CalendarRange className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium">{p.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  PI_STATUS_CLASS[p.status] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {PI_STATUS_LABEL[p.status] ?? p.status}
              </span>
              {p.artName && <span className="text-xs text-muted-foreground">ART {p.artName}</span>}
              <span className="text-xs text-muted-foreground">
                {p.startDate.toLocaleDateString("de-DE")} – {p.endDate.toLocaleDateString("de-DE")}
              </span>
              <ArrowRight className="ml-auto size-3.5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
