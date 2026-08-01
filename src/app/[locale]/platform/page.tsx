import { redirect } from "@/i18n/navigation";

/** `/platform` landet auf dem Tenants-Tab (Default-Fläche der Verwaltung). */
export default async function PlatformIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/platform/tenants", locale });
}
