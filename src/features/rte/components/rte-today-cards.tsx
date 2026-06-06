import { AlertOctagon, Inbox, Link2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { RteCockpitHero, RteTodayCounts } from "@/server/views/rte-cockpit";

interface Props {
  today: RteTodayCounts;
  hero: RteCockpitHero;
}

/**
 * Drei Karten für "heute" — offene Approvals, eskalierte Impediments,
 * cross-ART Blocker. Jede Karte ist ein Link in die zugehörige
 * gefilterte Liste.
 */
export function RteTodayCards({ today, hero }: Props) {
  const piId = hero.activePi?.id;
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <Card
        title="Offene Feature-QS"
        value={today.openApprovals}
        sub="Routine in einem Klick freigeben"
        href="/my-approvals"
        icon={<Inbox className="size-4" />}
        tone="primary"
      />
      <Card
        title="Eskalierte Impediments"
        value={today.escalatedImpediments}
        sub="Aktiver Eskalationspfad"
        href={`/art/${hero.artId}/impediments?status=escalated`}
        icon={<AlertOctagon className="size-4" />}
        tone="amber"
      />
      <Card
        title="Cross-ART Blocker"
        value={today.crossArtBlockers}
        sub="blockierende Abhängigkeit eines anderen ART"
        href={piId ? `/pi/${piId}/dependencies?type=blocks&scope=crossArt` : "#"}
        icon={<Link2 className="size-4" />}
        tone="red"
        disabled={!piId}
      />
    </section>
  );
}

function Card({
  title,
  value,
  sub,
  href,
  icon,
  tone,
  disabled,
}: {
  title: string;
  value: number;
  sub: string;
  href: string;
  icon: React.ReactNode;
  tone: "primary" | "amber" | "red";
  disabled?: boolean;
}) {
  const ring =
    tone === "red" ? "ring-red-200" : tone === "amber" ? "ring-amber-200" : "ring-primary/20";
  const accent =
    tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-700" : "text-primary";

  const body = (
    <div
      className={`group rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md ${disabled ? "opacity-50" : "hover:ring-2 " + ring}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
        <span className={accent}>{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );

  if (disabled) return body;
  return (
    <Link href={href} className="block">
      {body}
    </Link>
  );
}
