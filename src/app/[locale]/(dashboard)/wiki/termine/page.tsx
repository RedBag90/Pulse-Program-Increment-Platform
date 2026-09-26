import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getTenantPractices } from "@/server/services/target-model";
import { isLocale, routing } from "@/i18n/routing";
import { eventsFor } from "@/modules/wiki/domain/events";
import { guidesFor } from "@/modules/wiki/domain/guides";
import { visibleGuides } from "@/modules/wiki/domain/guide-filter";
import { EventsView } from "@/modules/wiki/features/wiki/components/events-view";
import { Page } from "@/components/layout";
import type { Role } from "@/modules/core/kernel/domain/roles";
import type { ModuleKey } from "@/modules/core/kernel/domain/modules";

/**
 * **Welche Termine es braucht** — die SAFe-Events mit Rollen und Vorbereitung,
 * die zweite Nachschlage-Seite des Wikis neben `/wiki/rollen`.
 *
 * Das Segment liegt unter `/wiki` und hängt an keinem Entitlement (ADR-0017).
 * Die Events selbst werden nicht gefiltert — sie sind Methodik, keine
 * Funktion eines Moduls. Gefiltert werden nur die **Verweise**: eine
 * Anleitung, die der Mandant nicht sieht, antwortete auf den Link mit 404.
 */
export default async function WikiEventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rohLocale } = await params;
  const locale = isLocale(rohLocale) ? rohLocale : routing.defaultLocale;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const practices = await getTenantPractices(db, principal.tenantId);
  const roles = principal.roles as Role[];

  const sichtbar = visibleGuides(
    guidesFor(locale).map((g) => g.guide),
    { enabledModules: principal.enabledModules as ModuleKey[], practices, roles },
  );
  const guideTitles = Object.fromEntries(sichtbar.map((g) => [g.slug, g.title]));

  /**
   * **Benennungen sind keine Rollen** — Produkt-Manager, Finance Approver,
   * Architect Lead und Technical Lead stehen als Feld an Solution, Wertstrom
   * oder ART. Wer eines davon ist, soll seine Zeilen markiert sehen wie ein
   * RTE die seinen. Eine Zählung je Feld, parallel.
   */
  const tenantId = principal.tenantId;
  const ich = principal.id;
  const [pm, finance, architekt, technik] = await Promise.all([
    db.solution.count({ where: { tenantId, productManagerId: ich, deletedAt: null } }),
    db.valueStream.count({ where: { tenantId, financeApproverId: ich, deletedAt: null } }),
    db.valueStream.count({ where: { tenantId, architectLeadId: ich, deletedAt: null } }),
    db.art.count({ where: { tenantId, technicalLeadId: ich, deletedAt: null } }),
  ]);
  const own = [
    ...roles,
    ...(pm > 0 ? ["solution.product"] : []),
    ...(finance > 0 ? ["vs.finance"] : []),
    ...(architekt > 0 ? ["vs.architecture"] : []),
    ...(technik > 0 ? ["art.technical"] : []),
  ];

  return (
    <Page>
      <EventsView catalog={eventsFor(locale)} own={own} guideTitles={guideTitles} />
    </Page>
  );
}
