import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

/** Retired route — Team detail now lives at `/team/[id]/settings`. */
export default async function CapacityTeamRedirect({ params }: Props) {
  const { locale, id } = await params;
  const resolvedLocale = routing.locales.includes(locale as (typeof routing.locales)[number])
    ? locale
    : routing.defaultLocale;
  redirect({ href: `/team/${id}/settings`, locale: resolvedLocale });
}
