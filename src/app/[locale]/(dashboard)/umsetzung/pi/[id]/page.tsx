import { redirect } from "next/navigation";

/**
 * Permanent-Redirect: das alte PI-Workspace (Plan / Execution /
 * Objectives / Dependencies / Impediments / Closure / Demo / Risks)
 * ist mit dem Delivery-Cockpit-Redesign (P7-Cutover) abgeloest.
 * PI-Governance-Themen (Objectives / Closure / Demo) wandern in
 * Folge-Module; Terminierung + Abarbeitung leben im Cockpit unter
 * `/umsetzung`.
 *
 * `?pi=<id>` bleibt als Hinweis fuer kuenftiges PI-Pre-Select erhalten,
 * obwohl das Cockpit aktuell nur ART-Scope kennt — PI-Filter folgt.
 */
export default async function PiWorkspaceRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<never> {
  const { id } = await params;
  redirect(`/umsetzung?pi=${id}`);
}
