import { redirect } from "next/navigation";

/**
 * Permanent-Redirect: das alte ART-Feature-Backlog (Rich-List + Bulk-PI-
 * Picker) ist mit dem Delivery-Cockpit (P7-Cutover) abgeloest. Cockpit-
 * Tabelle uebernimmt alle Funktionen — Filter, Inline-Edit, Bulk-Bar —
 * unter einer einheitlichen Sicht.
 */
export default async function ArtFeaturesRedirect({
  params,
}: {
  params: Promise<{ artId: string }>;
}): Promise<never> {
  const { artId } = await params;
  redirect(`/umsetzung?art=${artId}&view=table`);
}
