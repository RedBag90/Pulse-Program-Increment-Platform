import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { UmsetzungsHubShell } from "@/features/umsetzung/components/umsetzungs-hub-shell";

/**
 * Umsetzungs-Hub (Roadmap-P0 · Konsolidierungs-Skelett).
 *
 * Die Surface zieht in spaeteren Phasen die heute verstreuten Surfaces
 * (Features-Uebersicht, PI-Planning, RTE-Cockpit, Dependencies,
 * Impediments) in eine zentrale Hub-Sicht ein. In diesem ersten PR
 * existiert nur die Tab-Struktur mit Platzhalter-Inhalten, die per
 * Deep-Link weiter auf die Bestands-Routen verweisen — kein
 * Bookmark-Bruch, kein Funktionalitaets-Move.
 */
export default async function UmsetzungsHubPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  return (
    <Suspense fallback={null}>
      <UmsetzungsHubShell />
    </Suspense>
  );
}
