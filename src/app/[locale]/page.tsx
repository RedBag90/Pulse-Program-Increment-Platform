import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPrincipal } from "@/server/auth/principal";

/**
 * Root-Einstieg. Eingeloggte Nutzer werden in die App geführt (`/start` löst den
 * Principal auf und leitet auf das rollen-/modul-passende Home um) — so ist `/`
 * nie eine Sackgasse für „Home"/„Zurück zur App"-Links. Anonyme Nutzer sehen den
 * Platzhalter (bis es eine echte Marketing-Seite gibt).
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const principal = await getPrincipal();
  if (principal) redirect(`/${locale}/start`);

  const t = await getTranslations("common");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">{t("appName")}</h1>
      <p className="mt-4 text-lg text-muted-foreground">Program Increment Platform</p>
    </main>
  );
}
