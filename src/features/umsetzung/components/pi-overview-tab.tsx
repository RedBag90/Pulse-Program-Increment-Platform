import { CalendarRange, Gauge, Target, ShieldAlert, AlertTriangle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { PiWorkspaceModel } from "@/server/views/pi-workspace";

interface Props {
  model: PiWorkspaceModel;
}

const STATUS_PILL: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
};
const STATUS_LABEL: Record<string, string> = {
  planned: "Geplant",
  active: "Aktiv",
  completed: "Abgeschlossen",
};

/**
 * Overview-Tab des PI-Workspaces. Fuenf Kennzahlen plus
 * Stammdatenzeile — bewusst flach, damit der RTE auf einen Blick die
 * operativ wichtigen Signale sieht.
 */
export function PiOverviewTab({ model }: Props) {
  const burnup = model.featureBurnup;
  const conf = model.objectiveConfidence;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            STATUS_PILL[model.status] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {STATUS_LABEL[model.status] ?? model.status}
        </span>
        <span className="text-sm text-muted-foreground">
          <CalendarRange className="mr-1 inline-block size-4 align-text-bottom" />
          {model.startDate.toLocaleDateString("de-DE")}
          <span className="mx-1">–</span>
          {model.endDate.toLocaleDateString("de-DE")}
        </span>
        {model.art && (
          <span className="text-sm text-muted-foreground">
            <span className="mr-1">·</span>
            ART{" "}
            <Link
              href={`/umsetzung/art/${model.art.id}` as never}
              className="text-primary hover:underline"
            >
              {model.art.name}
            </Link>
          </span>
        )}
        {model.timelineName && (
          <span className="text-sm text-muted-foreground">
            <span className="mr-1">·</span>
            Timeline {model.timelineName}
          </span>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          icon={CalendarRange}
          label="Days Remaining"
          value={model.daysRemaining >= 0 ? `${model.daysRemaining}` : `${model.daysRemaining}`}
          hint={
            model.daysRemaining >= 0
              ? `bis ${model.endDate.toLocaleDateString("de-DE")}`
              : "Endtermin ueberschritten"
          }
          tone={model.daysRemaining < 0 ? "danger" : model.daysRemaining <= 7 ? "warn" : "neutral"}
        />

        <MetricCard
          icon={Gauge}
          label="Feature-Burnup"
          value={burnup.progress != null ? `${Math.round(burnup.progress * 100)} %` : "—"}
          hint={`${burnup.jobSizeCompleted} / ${burnup.jobSizeTotal} Job-Size · ${burnup.completed}/${burnup.total} Features`}
          tone={burnup.progress == null ? "neutral" : burnup.progress >= 0.5 ? "ok" : "warn"}
        />

        <MetricCard
          icon={Target}
          label="Confidence-Avg"
          value={conf.average != null ? conf.average.toFixed(1) : "—"}
          hint={`${conf.voted}/${conf.committed} Objectives gevotet`}
          tone={
            conf.average == null
              ? "neutral"
              : conf.average >= 3.5
                ? "ok"
                : conf.average >= 2.5
                  ? "warn"
                  : "danger"
          }
        />

        <MetricCard
          icon={AlertTriangle}
          label="Impediments"
          value={`${model.impediments.escalated} eskaliert`}
          hint={`${model.impediments.total} gesamt · ${model.impediments.unroamed} offen (ROAM)`}
          tone={model.impediments.escalated > 0 ? "danger" : "neutral"}
        />

        <MetricCard
          icon={ShieldAlert}
          label="Risks"
          value={`${model.riskCount}`}
          hint="Risk-Register kommt in Roadmap-P5"
          tone="neutral"
        />
      </section>
    </div>
  );
}

type Tone = "ok" | "warn" | "danger" | "neutral";
const TONE_CLASS: Record<Tone, string> = {
  ok: "border-emerald-200 bg-emerald-50/60",
  warn: "border-amber-200 bg-amber-50/60",
  danger: "border-red-200 bg-red-50/60",
  neutral: "border-input bg-card",
};
const TONE_ICON: Record<Tone, string> = {
  ok: "text-emerald-700",
  warn: "text-amber-700",
  danger: "text-red-700",
  neutral: "text-muted-foreground",
};

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof CalendarRange;
  label: string;
  value: string;
  hint: string;
  tone: Tone;
}) {
  return (
    <div className={`rounded-lg border p-4 ${TONE_CLASS[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className={`mr-1 inline-block size-3.5 align-text-bottom ${TONE_ICON[tone]}`} />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
