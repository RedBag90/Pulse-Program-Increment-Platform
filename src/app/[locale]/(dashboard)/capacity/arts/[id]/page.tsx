import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

/** Retired route — ART detail now lives at `/art/[id]/settings`. */
export default async function CapacityArtRedirect({ params }: Props) {
  const { locale, id } = await params;
  const resolvedLocale = routing.locales.includes(locale as (typeof routing.locales)[number])
    ? locale
    : routing.defaultLocale;
  redirect({ href: `/art/${id}/settings`, locale: resolvedLocale });
}
