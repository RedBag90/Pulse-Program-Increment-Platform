import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

/** Retired route — Value Stream detail now lives at `/value-streams/[id]`. */
export default async function CapacityValueStreamRedirect({ params }: Props) {
  const { locale, id } = await params;
  const resolvedLocale = routing.locales.includes(locale as (typeof routing.locales)[number])
    ? locale
    : routing.defaultLocale;
  redirect({ href: `/value-streams/${id}`, locale: resolvedLocale });
}
