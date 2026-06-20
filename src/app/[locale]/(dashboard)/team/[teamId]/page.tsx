import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ teamId: string }>;
}

/**
 * Permanent-Redirect: Team-Root war frueher der Team-Backlog (Stories
 * pro Team). Nach dem Wegfall der Story-Ebene gibt es keinen Backlog
 * mehr — die Team-Verwaltung lebt im Settings-Tab; History bleibt
 * separat.
 */
export default async function TeamRedirect({ params }: Props): Promise<never> {
  const { teamId } = await params;
  redirect(`/team/${teamId}/settings`);
}
