"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatDecimal } from "@/lib/formatting";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { BvScalePicker } from "@/modules/drumbeat/features/cockpit/components/bv-scale-picker";
import type { FeedbackFormView } from "@/modules/drumbeat/server/views/pi-feedback-view";
import { submitPiFeedbackAction } from "@/modules/drumbeat/features/cockpit/actions/pi-feedback";

/**
 * Das Formular der Feedback-Person. Vorbelegt mit ihrer letzten Antwort,
 * sonst mit dem geplanten Business Value — wer zustimmt, muss nichts ändern.
 */
export function PiFeedbackForm({ form }: { form: FeedbackFormView }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const gesperrt = form.status !== "open";
  const [values, setValues] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(form.features.map((f) => [f.id, f.myValue ?? f.plan])),
  );
  const [comments, setComments] = useState<Record<string, string>>(() =>
    Object.fromEntries(form.features.map((f) => [f.id, f.myComment ?? ""])),
  );
  const [pending, setPending] = useState(false);

  if (form.features.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          title={t("drumbeat.feedback.keineAbgeschlossenen")}
          body={t("drumbeat.feedback.keineAbgeschlossenenText")}
        />
      </Card>
    );
  }

  const fehlt = form.features.some((f) => values[f.id] == null);

  async function submit() {
    setPending(true);
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        requestId: form.requestId,
        answers: form.features.map((f) => ({
          featureId: f.id,
          businessValue: values[f.id],
          comment: comments[f.id]?.trim() || null,
        })),
      }),
    );
    const res = await submitPiFeedbackAction({}, fd);
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(t("drumbeat.feedback.danke"));
    router.push("/my-tasks");
  }

  return (
    <Card className="divide-y px-5">
      {form.features.map((f) => (
        <div key={f.id} className="grid gap-3 py-5 md:grid-cols-[minmax(0,1fr)_5rem_auto]">
          <div>
            <p className="font-medium">{f.title}</p>
            <p className="text-meta tabular-nums text-muted-foreground">
              {[
                f.completedAt &&
                  t("drumbeat.feedback.fertigAm", {
                    datum: formatDate(f.completedAt, "date", locale),
                  }),
                f.jobSize != null && t("drumbeat.feedback.metaJs", { n: f.jobSize }),
                f.wsjf != null &&
                  t("drumbeat.feedback.metaWsjf", { wert: formatDecimal(f.wsjf, 1, locale) }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="md:text-right">
            <p className="text-label text-muted-foreground">{t("drumbeat.feedback.plan")}</p>
            <p className="text-base font-semibold tabular-nums">{f.plan ?? "—"}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-label text-muted-foreground">
              {t("drumbeat.feedback.tatsaechlich")}
            </p>
            <BvScalePicker
              value={values[f.id] ?? null}
              plan={f.plan}
              disabled={gesperrt}
              label={t("drumbeat.feedback.istFuer", { feature: f.title })}
              onChange={(v) => setValues((s) => ({ ...s, [f.id]: v }))}
            />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <label htmlFor={`kommentar-${f.id}`} className="text-label text-muted-foreground">
              {t("drumbeat.feedback.kommentar")}
            </label>
            <Textarea
              id={`kommentar-${f.id}`}
              rows={2}
              disabled={gesperrt}
              placeholder={t("drumbeat.feedback.kommentarPlatzhalter")}
              value={comments[f.id] ?? ""}
              onChange={(e) => setComments((s) => ({ ...s, [f.id]: e.target.value }))}
            />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <p className="text-sm text-muted-foreground">
          {gesperrt
            ? t("drumbeat.feedback.schonUebernommenText")
            : form.submittedAt
              ? t("drumbeat.feedback.abgeschicktAendern", {
                  datum: formatDate(form.submittedAt, "date", locale),
                })
              : t("drumbeat.feedback.aendernBisUebernommen")}
        </p>
        {!gesperrt && (
          <Button type="button" disabled={pending || fehlt} onClick={submit}>
            {pending ? "…" : t("drumbeat.feedback.abschicken")}
          </Button>
        )}
      </div>
    </Card>
  );
}
