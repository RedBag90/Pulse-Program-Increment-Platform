"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/formatting";
import { Link } from "@/i18n/navigation";
import { userLabel } from "@/components/detail/initiative-labels";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useUrlState } from "@/modules/drumbeat/features/lib/use-url-state";
import { ROAM_DOT, ROAM_KEYS, normalizeRoamStatus } from "@/modules/core/kernel/domain/roam";
import type { AttentionItem, Burnup, LageSignal } from "@/modules/drumbeat/domain/pi-lage";
import type { PiLage } from "@/modules/drumbeat/server/views/pi-lage-view";
import type { PiFeedbackPanel } from "@/modules/drumbeat/server/views/pi-feedback-view";
import type { CockpitFeature } from "@/modules/drumbeat/domain/cockpit-types";
import { PiStatusBoard } from "./pi-status-board";

/**
 * **Die Sicht „Lage"** — der gewählte PI des gewählten ARTs auf einen Blick:
 * Zeit gegen Lieferung, Burn-up, was Hilfe braucht, Scope-Änderungen, Risiken,
 * Wert, Termine und darunter das Board nur dieses PIs.
 *
 * Die Zahlen oben kommen aus `loadPiLage` und folgen den Filtern der Toolbar
 * nicht; das Board kommt aus dem Cockpit-Modell und folgt ihnen.
 */
export function LageView({
  lage,
  feedback,
  boardFeatures,
  canSetDelivery,
  canScoreWsjf,
}: {
  lage: PiLage | null;
  feedback: PiFeedbackPanel | null;
  boardFeatures: CockpitFeature[];
  canSetDelivery: boolean;
  canScoreWsjf: boolean;
}) {
  const t = useTranslations();
  if (!lage || lage.pi.status === "planned") {
    return (
      <Card className="p-6">
        <EmptyState title={t("drumbeat.lage.geplantTitel")} body={t("drumbeat.lage.geplantText")} />
      </Card>
    );
  }
  const attentionIds = new Set(lage.attention.map((a) => a.feature.id));
  return (
    <div className="space-y-4">
      <LageHeader lage={lage} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <LageBurnup burnup={lage.burnup} lage={lage} />
        <LageAttention items={lage.attention} active={lage.pi.status === "active"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <LageScope lage={lage} />
        <LageRisks lage={lage} />
        <div className="space-y-4">
          <LageValue lage={lage} feedback={feedback} />
          <LageDates lage={lage} />
        </div>
      </div>
      <PiStatusBoard
        features={boardFeatures}
        piName={lage.pi.name}
        canSetDelivery={canSetDelivery}
        canScoreWsjf={canScoreWsjf}
        attentionIds={attentionIds}
      />
    </div>
  );
}

export const SIGNAL_TONE: Record<LageSignal, string> = {
  planned: "bg-muted text-muted-foreground",
  onTrack: "bg-success-surface text-success",
  behind: "bg-warning-surface text-warning",
  critical: "bg-destructive-surface text-destructive",
  done: "bg-muted text-foreground",
};

export const SIGNAL_KEY: Record<LageSignal, string> = {
  planned: "drumbeat.lage.signal.planned",
  onTrack: "drumbeat.lage.signal.onTrack",
  behind: "drumbeat.lage.signal.behind",
  critical: "drumbeat.lage.signal.critical",
  done: "drumbeat.lage.signal.done",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-label font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </span>
  );
}

function Bar({ share, tone }: { share: number; tone: string }) {
  return (
    <div className="h-1.5 rounded-full bg-muted">
      <div
        className={`h-1.5 rounded-full ${tone}`}
        style={{ width: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%` }}
      />
    </div>
  );
}

function LageHeader({ lage }: { lage: PiLage }) {
  const t = useTranslations();
  const { head } = lage;
  const pct = (x: number) => Math.round(x * 100);
  const fertig = lage.pi.status === "completed";
  const fehlt = head.forecastJs != null ? head.plannedJs - head.forecastJs : null;
  return (
    <Card className="grid gap-6 p-5 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-2">
        <Eyebrow>{t("drumbeat.lage.lage")}</Eyebrow>
        <span
          className={`self-start rounded-full px-3 py-1 text-sm font-semibold ${SIGNAL_TONE[head.signal]}`}
        >
          {t(SIGNAL_KEY[head.signal])}
        </span>
        <span className="text-sm text-muted-foreground">
          {fertig
            ? t("drumbeat.lage.endstand", { geliefert: head.deliveredJs, plan: head.plannedJs })
            : head.gapPoints > 0
              ? t("drumbeat.lage.unterZeit", { n: head.gapPoints })
              : t("drumbeat.lage.ueberZeit", { n: -head.gapPoints })}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <Eyebrow>{t("drumbeat.lage.zeit")}</Eyebrow>
        <span className="text-2xl font-semibold tabular-nums">
          {t("drumbeat.lage.prozent", { n: pct(head.timeShare) })}
        </span>
        <Bar share={head.timeShare} tone="bg-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {t("drumbeat.lage.tagVon", {
            tag: head.days.elapsed,
            total: head.days.total,
            rest: head.days.total - head.days.elapsed,
          })}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <Eyebrow>{t("drumbeat.lage.geliefert")}</Eyebrow>
        <span className="text-2xl font-semibold tabular-nums">
          {t("drumbeat.lage.prozent", { n: pct(head.deliveredShare) })}
        </span>
        <Bar share={head.deliveredShare} tone="bg-primary" />
        <span className="text-sm tabular-nums text-muted-foreground">
          {t("drumbeat.lage.geliefertVon", {
            js: head.deliveredJs,
            plan: head.plannedJs,
            n: head.deliveredCount,
            total: head.plannedCount,
          })}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <Eyebrow>{t("drumbeat.lage.prognose")}</Eyebrow>
        {head.forecastJs == null || fertig ? (
          <span className="text-sm text-muted-foreground">
            {fertig ? t("drumbeat.lage.prognoseFertig") : t("drumbeat.lage.prognoseZuFrueh")}
          </span>
        ) : (
          <>
            <span
              className={`text-2xl font-semibold tabular-nums ${fehlt != null && fehlt > 0 ? "text-warning" : ""}`}
            >
              {t("drumbeat.lage.prognoseWert", { n: head.forecastJs })}
            </span>
            <span className="text-sm text-muted-foreground">
              {fehlt != null && fehlt > 0
                ? t("drumbeat.lage.prognoseFehlt", { n: fehlt })
                : t("drumbeat.lage.prognoseReicht")}
            </span>
          </>
        )}
      </div>
    </Card>
  );
}

/** Treppe: jeder Punkt hält seinen Wert bis zum nächsten Tag. */
function stepPoints(
  points: { day: number; js: number }[],
  x: (d: number) => number,
  y: (v: number) => number,
) {
  const out: string[] = [];
  points.forEach((p, i) => {
    if (i > 0) out.push(`${x(p.day)},${y(points[i - 1]!.js)}`);
    out.push(`${x(p.day)},${y(p.js)}`);
  });
  return out.join(" ");
}

function LageBurnup({ burnup, lage }: { burnup: Burnup; lage: PiLage }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const W = 600;
  const H = 240;
  const L = 40;
  const R = 580;
  const TOP = 24;
  const BOTTOM = 200;
  const x = (d: number) => Math.round(L + (d / burnup.totalDays) * (R - L));
  const y = (v: number) => Math.round(BOTTOM - (v / burnup.maxJs) * (BOTTOM - TOP));
  const endScope = burnup.scope[burnup.scope.length - 1]!.js;
  const delivered = burnup.delivered[burnup.delivered.length - 1]!;
  const aktiv = lage.pi.status === "active";
  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{t("drumbeat.lage.burnup")}</h2>
        <span className="text-meta text-muted-foreground">{t("drumbeat.lage.burnupUnter")}</span>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[480px]"
          role="img"
          aria-label={t("drumbeat.lage.burnupAria", {
            geliefert: delivered.js,
            umfang: endScope,
            tag: burnup.today,
          })}
        >
          {[0, Math.round(burnup.maxJs / 2), burnup.maxJs].map((v) => (
            <g key={v}>
              <line x1={L} x2={R} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
              <text
                x={L - 8}
                y={y(v) + 4}
                textAnchor="end"
                fontSize={11}
                className="fill-muted-foreground"
              >
                {v}
              </text>
            </g>
          ))}
          <text x={L} y={BOTTOM + 20} fontSize={11} className="fill-muted-foreground">
            {formatDate(lage.pi.startDate, "date", locale)}
          </text>
          <text
            x={R}
            y={BOTTOM + 20}
            textAnchor="end"
            fontSize={11}
            className="fill-muted-foreground"
          >
            {formatDate(lage.pi.endDate, "date", locale)}
          </text>
          {aktiv && (
            <>
              <line
                x1={x(burnup.today)}
                x2={x(burnup.today)}
                y1={TOP}
                y2={BOTTOM}
                className="stroke-muted-foreground"
                strokeDasharray="2 3"
              />
              <text
                x={x(burnup.today)}
                y={BOTTOM + 20}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                className="fill-foreground"
              >
                {t("drumbeat.lage.heute")}
              </text>
            </>
          )}
          <polyline
            points={stepPoints(burnup.scope, x, y)}
            fill="none"
            className="stroke-muted-foreground"
            strokeWidth={1.5}
          />
          <line
            x1={x(0)}
            y1={y(0)}
            x2={x(burnup.totalDays)}
            y2={y(endScope)}
            className="stroke-border"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <polyline
            points={stepPoints(burnup.delivered, x, y)}
            fill="none"
            className="stroke-primary"
            strokeWidth={2.5}
          />
          <circle cx={x(delivered.day)} cy={y(delivered.js)} r={4} className="fill-primary" />
          {aktiv && burnup.forecastJs != null && (
            <>
              <line
                x1={x(delivered.day)}
                y1={y(delivered.js)}
                x2={x(burnup.totalDays)}
                y2={y(burnup.forecastJs)}
                className="stroke-warning"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
              <circle
                cx={x(burnup.totalDays)}
                cy={y(burnup.forecastJs)}
                r={3.5}
                className="fill-warning"
              />
            </>
          )}
        </svg>
      </div>
      <ul className="flex flex-wrap gap-4 text-meta text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 bg-primary" aria-hidden />
          {t("drumbeat.lage.legendeGeliefert")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="w-3.5 border-t-2 border-dashed border-border" aria-hidden />
          {t("drumbeat.lage.legendeIdeal")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 bg-muted-foreground" aria-hidden />
          {t("drumbeat.lage.legendeUmfang")}
        </li>
        {aktiv && (
          <li className="flex items-center gap-1.5">
            <span className="w-3.5 border-t-2 border-dashed border-warning" aria-hidden />
            {t("drumbeat.lage.legendePrognose")}
          </li>
        )}
      </ul>
    </Card>
  );
}

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-label font-semibold ${tone}`}>{children}</span>
  );
}

function LageAttention({ items, active }: { items: AttentionItem[]; active: boolean }) {
  const t = useTranslations();
  const { setParam } = useUrlState();
  const label = (a: AttentionItem) =>
    a.days != null
      ? t("drumbeat.lage.hilfe.blockiertSeit", { n: a.days })
      : t("drumbeat.lage.hilfe.blockiert");
  const detail = (a: AttentionItem) =>
    [a.feature.blockedReason ? `„${a.feature.blockedReason}"` : null, a.feature.ownerName]
      .filter(Boolean)
      .join(" · ");
  return (
    <Card className="space-y-1 p-5">
      <div className="flex items-baseline justify-between gap-2 pb-1.5">
        <h2 className="text-base font-semibold">{t("drumbeat.lage.hilfe.titel")}</h2>
        {items.length > 0 && (
          <Pill tone="bg-destructive-surface text-destructive">{items.length}</Pill>
        )}
      </div>
      {!active ? (
        <p className="text-sm text-muted-foreground">{t("drumbeat.lage.hilfe.nurAktiv")}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("drumbeat.lage.hilfe.nichts")}</p>
      ) : (
        <ul className="divide-y">
          {items.map((a) => (
            <li key={a.feature.id}>
              <button
                type="button"
                onClick={() => setParam("featureId", a.feature.id)}
                className="flex w-full flex-col gap-1 py-2.5 text-left hover:bg-muted"
              >
                <span className="flex items-baseline gap-2">
                  <Pill tone="bg-destructive-surface text-destructive">{label(a)}</Pill>
                  {a.feature.jobSize != null && (
                    <span className="ml-auto text-meta tabular-nums text-muted-foreground">
                      {t("drumbeat.lage.js", { n: a.feature.jobSize })}
                    </span>
                  )}
                </span>
                <span className="text-sm font-medium">{a.feature.title}</span>
                {detail(a) && <span className="text-meta text-muted-foreground">{detail(a)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LageScope({ lage }: { lage: PiLage }) {
  const t = useTranslations();
  const { drift } = lage;
  const tag = (d: Date) =>
    Math.max(0, Math.floor((d.getTime() - lage.pi.startDate.getTime()) / 86_400_000));
  return (
    <Card className="space-y-1 p-5">
      <div className="flex items-baseline justify-between gap-2 pb-1.5">
        <h2 className="text-base font-semibold">{t("drumbeat.lage.scope.titel")}</h2>
        <span className="text-sm tabular-nums text-muted-foreground">
          {t("drumbeat.lage.scope.vonBis", { start: drift.startJs, jetzt: drift.nowJs })}
        </span>
      </div>
      {drift.changes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("drumbeat.lage.scope.keine")}</p>
      ) : (
        <ul className="divide-y">
          {drift.changes.map((c) => (
            <li
              key={c.featureId}
              className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2 py-2 text-sm"
            >
              <span
                className={`font-semibold tabular-nums ${c.direction === "in" ? "text-success" : "text-destructive"}`}
              >
                {c.direction === "in" ? "+" : "−"}
                {c.jobSize}
              </span>
              <span>
                {c.title}
                <span className="block text-meta text-muted-foreground">
                  {[
                    t("drumbeat.lage.scope.tag", { n: tag(c.at) }),
                    c.direction === "in"
                      ? c.created
                        ? t("drumbeat.lage.scope.angelegtVon", {
                            name: userLabel(c.actorId ?? "", lage.userLabels),
                          })
                        : c.actorId
                          ? t("drumbeat.lage.scope.hineinVon", {
                              name: userLabel(c.actorId, lage.userLabels),
                            })
                          : t("drumbeat.lage.scope.hinein")
                      : c.actorId
                        ? t("drumbeat.lage.scope.herausVon", {
                            name: userLabel(c.actorId, lage.userLabels),
                          })
                        : t("drumbeat.lage.scope.heraus"),
                  ].join(" · ")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LageRisks({ lage }: { lage: PiLage }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (
    <Card className="space-y-1 p-5">
      <div className="flex items-baseline justify-between gap-2 pb-1.5">
        <h2 className="text-base font-semibold">{t("drumbeat.lage.risiken.titel")}</h2>
        <Link href="/issues" className="text-sm text-primary hover:underline">
          {t("drumbeat.lage.risiken.alle")}
        </Link>
      </div>
      {lage.risks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("drumbeat.lage.risiken.keine")}</p>
      ) : (
        <ul className="divide-y">
          {lage.risks.map((r) => {
            const roam = normalizeRoamStatus(r.roamStatus);
            return (
              <li key={r.id} className="flex flex-col gap-1 py-2">
                <span className="flex items-baseline gap-2">
                  {roam === "open" ? (
                    <Pill tone="bg-destructive-surface text-destructive">
                      {t("drumbeat.lage.risiken.nichtGeroamt")}
                    </Pill>
                  ) : (
                    <span className="flex items-center gap-1.5 text-label text-muted-foreground">
                      <span className={`size-2 rounded-full ${ROAM_DOT[roam]}`} aria-hidden />
                      {t(ROAM_KEYS[roam])}
                    </span>
                  )}
                  {r.targetResolutionDate && (
                    <span
                      className={`ml-auto text-meta tabular-nums ${r.overdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}
                    >
                      {r.overdue
                        ? t("drumbeat.lage.risiken.ueberfaellig", {
                            datum: formatDate(r.targetResolutionDate, "date", locale),
                          })
                        : t("drumbeat.lage.risiken.ziel", {
                            datum: formatDate(r.targetResolutionDate, "date", locale),
                          })}
                    </span>
                  )}
                </span>
                <span className="text-sm">{r.title}</span>
                {(r.featureTitle || r.ownerId) && (
                  <span className="text-meta text-muted-foreground">
                    {r.featureTitle
                      ? t("drumbeat.lage.risiken.an", { titel: r.featureTitle })
                      : t("drumbeat.lage.risiken.owner", {
                          name: userLabel(r.ownerId!, lage.userLabels),
                        })}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function LageValue({ lage, feedback }: { lage: PiLage; feedback: PiFeedbackPanel | null }) {
  const t = useTranslations();
  const { plannedBv, deliveredBv } = lage.value;
  const req = feedback?.request ?? null;
  const stand = !req
    ? t("drumbeat.lage.wert.keineRunde")
    : req.status === "applied"
      ? t("drumbeat.lage.wert.uebernommen")
      : t("drumbeat.lage.wert.laeuft", {
          n: req.reviewers.filter((r) => r.status === "submitted").length,
          total: req.reviewers.length,
        });
  return (
    <Card className="space-y-2.5 p-5">
      <h2 className="text-base font-semibold">{t("drumbeat.lage.wert.titel")}</h2>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{deliveredBv}</span>
        <span className="text-sm text-muted-foreground">
          {t("drumbeat.lage.wert.vonPlan", { plan: plannedBv })}
        </span>
      </div>
      <Bar share={plannedBv > 0 ? deliveredBv / plannedBv : 0} tone="bg-primary" />
      <p className="text-sm text-muted-foreground">{stand}</p>
    </Card>
  );
}

function LageDates({ lage }: { lage: PiLage }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const now = Date.now();
  const inTagen = (d: Date) => Math.ceil((d.getTime() - now) / 86_400_000);
  const zeile = (label: string, d: Date) => {
    const n = inTagen(d);
    return (
      <div className="flex justify-between gap-2 py-2 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {formatDate(d, "date", locale)}
          {n >= 0 && ` · ${t("drumbeat.lage.termine.inTagen", { n })}`}
        </span>
      </div>
    );
  };
  return (
    <Card className="space-y-1 p-5">
      <h2 className="pb-1 text-base font-semibold">{t("drumbeat.lage.termine.titel")}</h2>
      <div className="divide-y">
        {lage.systemDemoAt && zeile(t("drumbeat.lage.termine.systemDemo"), lage.systemDemoAt)}
        {zeile(t("drumbeat.lage.termine.piEnde"), lage.pi.endDate)}
        {lage.nextPi && (
          <div className="flex justify-between gap-2 py-2 text-sm">
            <span>{t("drumbeat.lage.termine.naechsterPi")}</span>
            <span className="tabular-nums text-muted-foreground">
              {t("drumbeat.lage.termine.naechsterPiWert", {
                name: lage.nextPi.name,
                n: lage.nextPi.featureCount,
              })}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
