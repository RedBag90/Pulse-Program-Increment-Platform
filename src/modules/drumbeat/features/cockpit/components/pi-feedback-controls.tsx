"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatDecimal } from "@/lib/formatting";
import { userLabel } from "@/components/detail/initiative-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MultiUserSelect } from "@/modules/work/features/portfolio/components/approver-picker";
import { BV_SCALE } from "@/modules/drumbeat/domain/pi-feedback";
import type { PiFeedbackPanel } from "@/modules/drumbeat/server/views/pi-feedback-view";
import {
  applyPiFeedbackAction,
  requestPiFeedbackAction,
} from "@/modules/drumbeat/features/cockpit/actions/pi-feedback";

/**
 * **PI-Feedback in der Kontextleiste** — „Feedback einsammeln" (Personen
 * benennen) und „Feedback einsehen" (Antworten ansehen, Ist übernehmen).
 * Neben „PI abschließen", solange der PI läuft, und auch danach.
 */
export function PiFeedbackControls({
  piId,
  artId,
  panel,
}: {
  piId: string;
  artId: string;
  panel: PiFeedbackPanel;
}) {
  const t = useTranslations();
  const { request } = panel;
  const submitted = request?.reviewers.filter((r) => r.status === "submitted").length ?? 0;
  const open = request?.status === "open";

  return (
    <>
      {request && (
        <ReviewDialog
          artId={artId}
          panel={panel}
          trigger={
            <>
              {t("drumbeat.feedback.einsehen")}
              {open && (
                <span className="rounded-full bg-muted px-1.5 text-label tabular-nums text-muted-foreground">
                  {submitted}/{request.reviewers.length}
                </span>
              )}
            </>
          }
        />
      )}
      {panel.canRequest && <RequestDialog piId={piId} artId={artId} panel={panel} />}
    </>
  );
}

function RequestDialog({
  piId,
  artId,
  panel,
}: {
  piId: string;
  artId: string;
  panel: PiFeedbackPanel;
}) {
  const t = useTranslations();
  const router = useRouter();
  const schonBenannt = new Set(
    panel.request?.status === "open" ? panel.request.reviewers.map((r) => r.userId) : [],
  );
  const vorschlag =
    panel.suggestedReviewerId && !schonBenannt.has(panel.suggestedReviewerId)
      ? [panel.suggestedReviewerId]
      : [];
  const [openDialog, setOpenDialog] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(vorschlag));
  const [dueDate, setDueDate] = useState("");
  const [pending, setPending] = useState(false);

  const options = panel.people.filter((p) => !schonBenannt.has(p.userId));

  async function submit() {
    setPending(true);
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({ piId, artId, reviewerIds: [...selected], dueDate: dueDate || null }),
    );
    const res = await requestPiFeedbackAction({}, fd);
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(t("drumbeat.feedback.angefordert", { count: selected.size }));
    setOpenDialog(false);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpenDialog(true)}>
        {t("drumbeat.feedback.einsammeln")}
      </Button>
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("drumbeat.feedback.einsammeln")}</DialogTitle>
            <DialogDescription>
              {t("drumbeat.feedback.einsammelnText", { count: panel.completedCount })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {schonBenannt.size > 0 && (
              <p className="text-sm text-muted-foreground">
                {t("drumbeat.feedback.schonGefragt", {
                  namen: [...schonBenannt].map((id) => userLabel(id, panel.userLabels)).join(", "),
                })}
              </p>
            )}
            <div className="space-y-1.5">
              <Label>{t("drumbeat.feedback.personen")}</Label>
              <div className="flex">
                <MultiUserSelect
                  options={options}
                  selected={selected}
                  userLabels={panel.userLabels}
                  onToggle={(id) =>
                    setSelected((s) => {
                      const next = new Set(s);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                />
              </div>
              {panel.suggestedReviewerId && (
                <p className="text-meta text-muted-foreground">
                  {t("drumbeat.feedback.vorschlagBusinessOwner")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feedback-frist">{t("drumbeat.feedback.frist")}</Label>
              <Input
                id="feedback-frist"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-44"
              />
            </div>
            <p className="rounded-md bg-surface-frame px-3 py-2 text-sm text-muted-foreground">
              {t("drumbeat.feedback.spaeterFertig")}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
              {t("drumbeat.ui.abbrechen")}
            </Button>
            <Button type="button" disabled={pending || selected.size === 0} onClick={submit}>
              {pending ? "…" : t("drumbeat.feedback.anfordern")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** WSJF mit einem anderen Business Value: (BV+TC+RR)/JS verschiebt sich um ΔBV/JS. */
function shiftedWsjf(wsjf: number | null, plan: number | null, bv: number, js: number | null) {
  if (wsjf == null || plan == null || js == null || js <= 0) return null;
  return Math.round((wsjf + (bv - plan) / js) * 100) / 100;
}

function ReviewDialog({
  artId,
  panel,
  trigger,
}: {
  artId: string;
  panel: PiFeedbackPanel;
  trigger: React.ReactNode;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const request = panel.request!;
  const offen = request.status === "open";
  const kannUebernehmen = offen && panel.canApply;

  const [openDialog, setOpenDialog] = useState(false);
  const [values, setValues] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(request.features.map((f) => [f.id, f.actual ?? f.suggestion ?? null])),
  );
  const [pending, setPending] = useState(false);

  const summe = useMemo(() => {
    let plan = 0;
    let ist = 0;
    let wsjfPlan = 0;
    let wsjfIst = 0;
    for (const f of request.features) {
      const v = values[f.id] ?? f.plan;
      plan += f.plan ?? 0;
      ist += v ?? 0;
      wsjfPlan += f.wsjf ?? 0;
      wsjfIst += (v != null ? shiftedWsjf(f.wsjf, f.plan, v, f.jobSize) : null) ?? f.wsjf ?? 0;
    }
    return { plan, ist, wsjfPlan, wsjfIst };
  }, [request.features, values]);

  const ausstehend = request.reviewers.filter((r) => r.status === "pending").length;
  const name = (id: string) => userLabel(id, panel.userLabels);
  const zahl = (n: number) => formatDecimal(n, 1, locale);

  async function apply() {
    const payloadValues = request.features.flatMap((f) =>
      values[f.id] != null ? [{ featureId: f.id, businessValue: values[f.id] }] : [],
    );
    if (payloadValues.length === 0) return;
    setPending(true);
    const fd = new FormData();
    fd.set("payload", JSON.stringify({ requestId: request.id, artId, values: payloadValues }));
    const res = await applyPiFeedbackAction({}, fd);
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(t("drumbeat.feedback.uebernommen", { count: payloadValues.length }));
    setOpenDialog(false);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => setOpenDialog(true)}
      >
        {trigger}
      </Button>
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("drumbeat.feedback.einsehen")}</DialogTitle>
            <DialogDescription>
              {offen
                ? t("drumbeat.feedback.angefragtAm", {
                    datum: formatDate(request.requestedAt, "date", locale),
                  })
                : t("drumbeat.feedback.uebernommenAm", {
                    datum: formatDate(request.appliedAt, "date", locale),
                  })}
              {request.dueDate &&
                ` · ${t("drumbeat.feedback.fristBis", { datum: formatDate(request.dueDate, "date", locale) })}`}
            </DialogDescription>
          </DialogHeader>

          <ul className="flex flex-wrap gap-1.5" aria-label={t("drumbeat.feedback.personen")}>
            {request.reviewers.map((r) => (
              <li
                key={r.userId}
                className={
                  r.status === "submitted"
                    ? "rounded-full bg-success-surface px-2.5 py-0.5 text-meta text-success"
                    : "rounded-full bg-warning-surface px-2.5 py-0.5 text-meta text-warning"
                }
              >
                {name(r.userId)} ·{" "}
                {r.status === "submitted"
                  ? t("drumbeat.feedback.abgeschickt")
                  : t("drumbeat.feedback.ausstehend")}
              </li>
            ))}
          </ul>

          {request.features.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("drumbeat.feedback.keineAbgeschlossenen")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-meta text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 font-medium">{t("drumbeat.feedback.feature")}</th>
                    <th className="py-2 pr-3 text-right font-medium">
                      {t("drumbeat.feedback.plan")}
                    </th>
                    <th className="py-2 pr-3 font-medium">{t("drumbeat.feedback.antworten")}</th>
                    <th className="py-2 font-medium">{t("drumbeat.feedback.ist")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y align-top">
                  {request.features.map((f) => {
                    const v = values[f.id] ?? null;
                    const wsjfIst = v != null ? shiftedWsjf(f.wsjf, f.plan, v, f.jobSize) : null;
                    return (
                      <tr key={f.id}>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">{f.title}</div>
                          <div className="text-meta tabular-nums text-muted-foreground">
                            {[
                              f.jobSize != null && t("drumbeat.feedback.metaJs", { n: f.jobSize }),
                              f.wsjf != null &&
                                (wsjfIst != null && wsjfIst !== f.wsjf
                                  ? t("drumbeat.feedback.metaWsjfAenderung", {
                                      plan: zahl(f.wsjf),
                                      ist: zahl(wsjfIst),
                                    })
                                  : t("drumbeat.feedback.metaWsjf", { wert: zahl(f.wsjf) })),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                          {f.plan ?? "—"}
                        </td>
                        <td className="py-2.5 pr-3">
                          {f.answers.length === 0 ? (
                            <span className="text-muted-foreground">
                              {t("drumbeat.feedback.nochKeineAntwort")}
                            </span>
                          ) : (
                            <ul className="space-y-1.5">
                              {f.answers.map((a) => (
                                <li key={a.userId}>
                                  <span className="font-semibold tabular-nums">
                                    {a.businessValue}
                                  </span>{" "}
                                  <span className="text-muted-foreground">{name(a.userId)}</span>
                                  {a.comment && (
                                    <p className="text-meta text-muted-foreground">„{a.comment}"</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="py-2.5">
                          {kannUebernehmen ? (
                            <div className="space-y-1">
                              <select
                                aria-label={t("drumbeat.feedback.istFuer", { feature: f.title })}
                                value={v ?? ""}
                                onChange={(e) =>
                                  setValues((s) => ({
                                    ...s,
                                    [f.id]: e.target.value === "" ? null : Number(e.target.value),
                                  }))
                                }
                                className="h-9 w-28 rounded-md border border-input bg-background px-2 text-sm tabular-nums"
                              >
                                <option value="">{t("drumbeat.feedback.offenLassen")}</option>
                                {BV_SCALE.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                              {f.suggestion != null && (
                                <p className="text-meta text-muted-foreground">
                                  {t("drumbeat.feedback.vorschlag", { wert: f.suggestion })}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="font-semibold tabular-nums">{f.actual ?? "—"}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-frame px-3 py-2 text-sm">
            <span className="tabular-nums">
              {t("drumbeat.feedback.summe", {
                plan: summe.plan,
                ist: summe.ist,
                wsjfPlan: zahl(summe.wsjfPlan),
                wsjfIst: zahl(summe.wsjfIst),
              })}
            </span>
            {offen && ausstehend > 0 && (
              <span className="text-warning">
                {t("drumbeat.feedback.nochAusstehend", {
                  count: ausstehend,
                  total: request.reviewers.length,
                })}
              </span>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
              {t("drumbeat.feedback.schliessen")}
            </Button>
            {kannUebernehmen && (
              <Button
                type="button"
                disabled={pending || request.features.every((f) => values[f.id] == null)}
                onClick={apply}
              >
                {pending ? "…" : t("drumbeat.feedback.uebernehmen")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
