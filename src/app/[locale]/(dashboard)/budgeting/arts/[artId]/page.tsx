import { notFound, redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";

/**
 * **Der Einsprung auf ein ART-Budget** — die Seite selbst gibt es nicht mehr.
 *
 * Ihr Inhalt steht jetzt als aufklappbare Zeile auf der Geldfläche ihres
 * Wertstroms (`art-budget-consolidation.md`, §2.1). Die Route bleibt trotzdem,
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
  searchParams: Promise<{ tab?: string; cycle?: string }>;
}) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const { artId } = await params;
  const { tab, cycle } = await searchParams;
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const art = await db.art.findFirst({
    where: { id: artId, tenantId: principal.tenantId },
    select: { id: true, valueStreamId: true },
  });
  if (!art) notFound();

  // `?tab=verteilen` war die Arbeitsfläche — sie heisst jetzt „Betrieb".
  const query = new URLSearchParams({
    tab: tab === "verteilen" ? "betrieb" : "budget",
    art: art.id,
  });
  if (cycle != null) query.set("cycle", cycle);

  redirect(`/budgeting/value-streams/${art.valueStreamId}?${query.toString()}`);
}
