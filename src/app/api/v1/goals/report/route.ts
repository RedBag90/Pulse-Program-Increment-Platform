import { type NextRequest, NextResponse } from "next/server";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { unauthorized } from "@/server/http/problem";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { loadStrategyTree } from "@/modules/core/goals/server/views/ziele-view";
import { buildZieleReport } from "@/modules/core/goals/domain/ziele-report";
import { renderZieleReport } from "@/modules/core/goals/server/report/ziele-report-document";
import type { TenantId } from "@/modules/core/kernel/domain/types";

/**
 * **Die Ziele-Übersicht als PDF.**
 *
 * Vorbild ist der GDPR-Export (`api/v1/admin/users/[userId]/export/route.ts`):
 * wie dort wird die Auth von Hand geprüft statt über `createQueryHandler`, weil
 * die Antwort kein JSON ist, sondern eine eigene `Response` mit
 * `Content-Disposition` braucht.
 *
 * **Berechtigung: genau die der Seite, nicht mehr und nicht weniger.** `/ziele`
 * verlangt keine Lese-Capability — nur Anmeldung, und der tenant-gescopte
 * Prisma-Client tut den Rest. Ein Bericht, der mehr zeigte als der Bildschirm,
 * wäre ein Leck; eine zusätzliche Hürde wäre eine, die die Seite nicht kennt.
 *
 * **Kein Audit-Eintrag.** Der GDPR-Export schreibt einen, weil er
 * personenbezogene Daten eines einzelnen Nutzers ausleitet. Dieser Bericht
 * zeigt nichts, was die Seite nicht jedem angemeldeten Mandanten-Nutzer ohnehin
 * zeigt — ihn zu protokollieren wäre Rauschen.
 *
 * Dieselben vier CSV-Parameter wie die Seite; wer den Link mit der aktuellen
 * Query aufruft, bekommt denselben Ausschnitt aufs Papier.
 */

/** Wie auf der Ziele-Seite: Mehrfachauswahl liegt als CSV in der URL. */
function splitCsv(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

/** `id → Name` für das Filter-Echo im Briefkopf. */
function namesById(rows: readonly { id: string; name: string }[]): Record<string, string> {
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

export async function GET(request: NextRequest): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return unauthorized();

  const sp = request.nextUrl.searchParams;
  const periods = splitCsv(sp.get("period"));
  const valueStreamIds = splitCsv(sp.get("vs"));
  const artIds = splitCsv(sp.get("art"));
  const statuses = splitCsv(sp.get("status"));

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [tree, userLabels, tenant, valueStreams, arts] = await Promise.all([
    loadStrategyTree(db, principal.tenantId, {
      ...(periods.length ? { periods } : {}),
      ...(valueStreamIds.length ? { valueStreamIds } : {}),
      ...(artIds.length ? { artIds } : {}),
      ...(statuses.length ? { statuses } : {}),
    }),
    listTenantUserLabels(db, principal.tenantId as TenantId),
    // Der Mandantenname steht im Briefkopf; der `Principal` trägt ihn nicht.
    db.tenant.findUnique({ where: { id: principal.tenantId }, select: { name: true } }),
    // Nur die **gefilterten** Wertströme/ARTs, und nur für das Echo im Kopf —
    // ohne Filter gibt es nichts zu benennen.
    valueStreamIds.length > 0
      ? db.valueStream.findMany({
          where: { tenantId: principal.tenantId, id: { in: valueStreamIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    artIds.length > 0
      ? db.art.findMany({
          where: { tenantId: principal.tenantId, id: { in: artIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const report = buildZieleReport(tree, {
    tenantName: tenant?.name ?? "Pulse",
    userLabels,
    valueStreamNames: namesById(valueStreams),
    artNames: namesById(arts),
    now: new Date(),
  });

  const pdf = await renderZieleReport(report);

  // Dateinamen-Schema wie beim CSV-Export der Ziele: `pulse-<ding>-<stamp>.<ext>`.
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pulse-ziele-${stamp}.pdf"`,
      // Der Bericht folgt den Filtern und dem Mandanten — nichts davon darf
      // ein Zwischenspeicher zwei Nutzern gemeinsam ausliefern.
      "Cache-Control": "no-store",
    },
  });
}
