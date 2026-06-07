import { redirect } from "next/navigation";

/**
 * Roadmap-P3.B: pro-ART-Cockpit ist in den ART-Hub eingezogen
 * (`/umsetzung/art/[id]`). Diese Route bleibt als weicher Redirect.
 */
export default async function RteArtRedirectPage({
  params,
}: {
  params: Promise<{ artId: string }>;
}) {
  const { artId } = await params;
  redirect(`/umsetzung/art/${artId}`);
}
