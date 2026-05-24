import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { landingPathForRoles } from "@/domain/landing";

/**
 * Post-login entry point — resolves the principal and forwards to the
 * role-appropriate landing route (locale-preserving). Reached from the sign-in
 * action and the auth-only middleware redirect.
 */
export default async function StartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect(`/${locale}/sign-in`);

  redirect(`/${locale}${landingPathForRoles(principal.roles)}`);
}
