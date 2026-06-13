import { redirect } from "next/navigation";

/**
 * Permanent-Redirect: der alte ART-Hub (Hero + History + Teams) ist mit
 * dem Delivery-Cockpit-Redesign (P7-Cutover) abgeloest. Das Cockpit
 * uebernimmt die Scope-Auswahl direkt ueber `?art=<id>`.
 */
export default async function ArtHubRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<never> {
  const { id } = await params;
  redirect(`/umsetzung?art=${id}`);
}
