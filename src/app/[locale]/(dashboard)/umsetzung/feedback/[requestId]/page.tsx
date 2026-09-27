import { redirect, notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/formatting";
import { Page, PageHeader } from "@/components/layout";
import { userLabel } from "@/components/detail/initiative-labels";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { loadFeedbackForm } from "@/modules/drumbeat/server/views/pi-feedback-view";
import { PiFeedbackForm } from "@/modules/drumbeat/features/feedback/components/pi-feedback-form";

/**
 * **Feedback geben** — die Seite der benannten Person: je abgeschlossenes
 * Feature den tatsächlichen Business Value und optional warum. Erreichbar aus
 * My Tasks. Wer nicht benannt ist, bekommt 404 — auch keine Auskunft, dass es
 * die Runde gibt.
 */
export default async function PiFeedbackPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const tenantId = principal.tenantId as TenantId;
  const db = createPrismaClient({ userId: principal.id, tenantId });
  const form = await loadFeedbackForm(db, tenantId, requestId, principal.id);
  if (!form) notFound();

  const [t, locale, userLabels] = await Promise.all([
    getTranslations(),
    getLocale() as Promise<Locale>,
    listTenantUserLabels(db, tenantId),
  ]);

  const meta = [
    form.artName,
    t("drumbeat.feedback.angefragtVon", { name: userLabel(form.requestedBy, userLabels) }),
    form.dueDate
      ? t("drumbeat.feedback.fristBis", { datum: formatDate(form.dueDate, "date", locale) })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Page>
      <PageHeader
        breadcrumb={
          <Link href="/my-tasks" className="text-sm text-muted-foreground hover:underline">
            ← {t("pages.ui.meineTasks")}
          </Link>
        }
        title={t("drumbeat.feedback.seitenTitel", { pi: form.piName })}
        subtitle={`${meta}. ${t("drumbeat.feedback.seitenText")}`}
      />
      <PiFeedbackForm form={form} />
    </Page>
  );
}
