import { notFound, redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getTenantPractices } from "@/server/services/target-model";
import { guideBySlug } from "@/modules/wiki/domain/guides";
import { guideVisible } from "@/modules/wiki/domain/guide-filter";
import { GuideView } from "@/modules/wiki/features/wiki/components/guide-view";
import { resolveFigures } from "../_figures";
import { Page } from "@/components/layout";
import type { Role } from "@/modules/core/kernel/domain/roles";
import type { ModuleKey } from "@/modules/core/kernel/domain/modules";

/**
 * Eine Anleitung.
 *
 * **Hier werden die Figuren aufgelöst.** Im Datensatz stehen sie nur als Name
 * (`{ kind: "figure", figure: "horizonLadder" }`); die Daten dahinter liegen in
 * `work`, `budgeting` und `drumbeat`. Das Wiki ist ein Blatt über Core und darf
 * dorthin nicht importieren (ADR-0013) — der Kompositionsroot darf es. Dasselbe
 * Muster wie die `notices`-Eigenschaft auf `/my-tasks`.
 *
 * Der Nutzen ist nicht nur die Schichtung: eine Leiter, die aus `GATE_STEPS`
 * kommt, kann nicht von der Anwendung abdriften. Eine abgeschriebene schon —
 * `work/domain/epic-lifecycle-doc.ts` erzählt im eigenen Header, wie das ausgeht.
 */
export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const guide = guideBySlug(slug);
  if (!guide) notFound();

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const practices = await getTenantPractices(db, principal.tenantId);

  // Eine Anleitung für ein Modul, das dieser Mandant nicht hat, gibt es nicht —
  // auch nicht per Deep-Link.
  const ctx = {
    enabledModules: principal.enabledModules as ModuleKey[],
    practices,
    roles: principal.roles as Role[],
  };
  if (!guideVisible(guide, ctx)) notFound();

  return (
    <Page>
      <GuideView guide={guide} roles={ctx.roles} figures={resolveFigures()} />
    </Page>
  );
}
