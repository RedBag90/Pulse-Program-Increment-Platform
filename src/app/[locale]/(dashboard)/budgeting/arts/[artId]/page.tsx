import { notFound, redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";

/**
 * **Der Einsprung auf ein ART-Budget** — die Seite selbst gibt es nicht mehr.
 *
 * Ihr Inhalt steht jetzt als eigener Reiter auf der Geldfläche ihres Wertstroms
 * (`art-budget-process-layout.md`, §2). Die Route bleibt trotzdem,
 * und zwar nicht aus Nostalgie: auf sie zeigen die persönliche Inbox, die
 * Finanzierungskette, der Hinweiskasten der Struktur-Fläche und vermutlich
 * einige Lesezeichen. Ein 404 hätte dort stillschweigend ins Leere geführt.
 *
 * Die **Liste** `/budgeting/arts` bleibt eine eigene Fläche: sie beantwortet
 * „alle meine ARTs, über Wertströme hinweg" — die Frage des RTE, der ARTs in
 * zwei Strömen betreut. Die Wertstromseite stellt sie nicht.
 *
 * **Kein Rechte-Check hier.** Er wäre eine zweite Wahrheit neben der, die die
 * Zielseite ohnehin fällt — und die fällt sie feiner: dort entscheidet sich
 * nicht nur, ob man hinein darf, sondern auch, welche Zeilen Zahlen tragen. Was
 * diese Datei prüft, ist nur, ob es das ART überhaupt gibt; ohne seinen
 * Wertstrom wüsste sie nicht, wohin.
 */
export default async function ArtBudgetRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ artId: string }>;
  // `tab` kommt aus alten Adressen noch an und wird bewusst nicht gelesen.
  searchParams: Promise<{ tab?: string; cycle?: string }>;
}) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const { artId } = await params;
  const { cycle } = await searchParams;
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const art = await db.art.findFirst({
    where: { id: artId, tenantId: principal.tenantId },
    select: { id: true, valueStreamId: true },
  });
  if (!art) notFound();

  /**
   * **Beide alten Reiter landen im selben neuen.** `?tab=verteilen` war die
   * Arbeitsfläche, `?tab=budget` die Lesefläche — seit die Wertstrom-Seite nach
   * Eigentümer geschnitten ist, sind das die zwei Hälften **eines** Reiters:
   * dem dieses ARTs. Der Parameter wird damit bedeutungslos und fällt weg.
   */
  const query = new URLSearchParams({ tab: `art:${art.id}` });
  if (cycle != null) query.set("cycle", cycle);

  redirect(`/budgeting/value-streams/${art.valueStreamId}?${query.toString()}`);
}
