import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  CalendarRange,
  Target,
  TrendingUp,
  AlertTriangle,
  Network,
} from "lucide-react";
import type { ArtHubModel } from "@/server/views/art-hub";

const ART_HUB_TABS: readonly DetailTab[] = [
  { key: "active", label: "Aktiver PI" },
  { key: "next", label: "Naechster PI" },
  // History + Teams folgen in Roadmap-P3.B — heute Platzhalter.
  { key: "history", label: "PI-Historie" },
  { key: "teams", label: "Teams" },
];

interface Props {
  model: ArtHubModel;
  activeTab?: string;
}

/**
 * ART-Hub-Shell. In P3.A: Hero-Card mit aktivem PI + Today-Counters
 * (uebernommen aus dem RTE-Cockpit-Modell), Naechster-PI-Card.
 * History und Teams sind Platzhalter — kommen in P3.B.
 */
export function ArtHubShell({ model, activeTab }: Props) {
  const active = resolveTab(ART_HUB_TABS, activeTab);

  return (
    <EntityDetailShell
      backHref="/umsetzung"
      backLabel="Zurueck zum Hub"
      title={model.artName}
      tabs={ART_HUB_TABS}
      activeTab={active}
      basePath={`/umsetzung/art/${model.artId}`}
      badge={
        model.timelineName ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            Timeline {model.timelineName}
          </span>
        ) : undefined
      }
    >
      {active === "active" && <ActivePiSection model={model} />}
      {active === "next" && <NextPiSection model={model} />}
      {active === "history" && (
        <Placeholder
          hint="PI-Historie + Predictability-Trend kommen in Roadmap-P3.B."
          fallbackHref="/rte"
          fallbackLabel="Heute via RTE-Cockpit"
        />
      )}
      {active === "teams" && (
        <Placeholder
          hint="Team-Liste (read-only RAG) kommt in Roadmap-P3.B."
          fallbackHref={`/rte/${model.artId}`}
          fallbackLabel="Heute via RTE-Cockpit"
        />
      )}
    </EntityDetailShell>
  );
}

function ActivePiSection({ model }: { model: ArtHubModel }) {
  const hero = model.cockpit.hero;
  const today = model.cockpit.today;
  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-6">
        {hero.activePi ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold">{hero.activePi.name}</h2>
              <Link
                href={`/umsetzung/pi/${hero.activePi.id}` as never}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Zum PI-Workspace <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              <CalendarRange className="mr-1 inline-block size-4 align-text-bottom" />
              {hero.activePi.startDate.toLocaleDateString("de-DE")}
              <span className="mx-1">–</span>
              {hero.activePi.endDate.toLocaleDateString("de-DE")}
              <span className="mx-2">·</span>
              {hero.activePi.daysUntilEnd >= 0
                ? `${hero.activePi.daysUntilEnd} Tage bis Ende`
                : `${Math.abs(hero.activePi.daysUntilEnd)} Tage ueber Ende`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Kein aktives PI fuer diesen ART. Plane den naechsten PI im Workspace und starte ihn
            ueber den Closure-Lifecycle.
          </p>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={TrendingUp}
          label="Predictability"
          value={
            hero.predictability != null ? `${Math.round(hero.predictability.value * 100)} %` : "—"
          }
          hint={
            hero.predictability != null
              ? `Mittel ueber letzte ${hero.predictability.piNames.length} PIs`
              : "Noch keine abgeschlossenen PIs"
          }
        />
        <MetricCard
          icon={Target}
          label="Confidence-Avg"
          value={hero.confidenceAvg != null ? hero.confidenceAvg.toFixed(1) : "—"}
          hint="Aktive PI-Objectives (1-5)"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Today"
          value={`${today.openApprovals} | ${today.escalatedImpediments} | ${today.crossArtBlockers}`}
          hint="Approvals | Eskalierte Impediments | Cross-ART-Blocker"
        />
        <MetricCard
          icon={Network}
          label="Teams"
          value={`${model.cockpit.teams.length}`}
          hint="Im RAG-Grid des RTE-Cockpits"
        />
      </section>
    </div>
  );
}

function NextPiSection({ model }: { model: ArtHubModel }) {
  if (!model.nextPi) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Kein bevorstehender PI gefunden. Lege im Structure-Hub eine Timeline mit weiteren PIs an.
        </p>
      </section>
    );
  }
  const n = model.nextPi;
  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">{n.name}</h2>
          <Link
            href={`/umsetzung/pi/${n.id}?tab=plan` as never}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Im Plan-Tab oeffnen <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          <CalendarRange className="mr-1 inline-block size-4 align-text-bottom" />
          {n.startDate.toLocaleDateString("de-DE")}
          <span className="mx-1">–</span>
          {n.endDate.toLocaleDateString("de-DE")}
          <span className="mx-2">·</span>
          {n.daysUntilStart >= 0
            ? `Startet in ${n.daysUntilStart} Tagen`
            : `${Math.abs(n.daysUntilStart)} Tage ueberfaellig`}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <MetricCard
            icon={Target}
            label="Features geplant"
            value={`${n.plannedFeatureCount}`}
            hint="Schon dem PI zugeordnet"
          />
          <MetricCard
            icon={Target}
            label="Objectives committed"
            value={`${n.committedObjectiveCount}`}
            hint="Pre-Check fuer startPi: je Team mindestens eins"
          />
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof CalendarRange;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="mr-1 inline-block size-3.5 align-text-bottom" />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Placeholder({
  hint,
  fallbackHref,
  fallbackLabel,
}: {
  hint: string;
  fallbackHref: string;
  fallbackLabel: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-6">
      <p className="text-sm text-muted-foreground">{hint}</p>
      <Link
        href={fallbackHref as never}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        {fallbackLabel} <ArrowRight className="size-3" />
      </Link>
    </section>
  );
}
