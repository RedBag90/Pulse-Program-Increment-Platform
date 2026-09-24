import { useTranslations } from "next-intl";
import { JoinForm } from "@/features/auth/components/join-form";

/**
 * Öffentliche Beitritts-Seite per Code (`/join`). Für den Link-Weg s.
 * `/join/[token]`. Kein Auth — die Server-Action prüft Code + E-Mail.
 */
export default function JoinByCodePage() {
  const t = useTranslations();
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold">{t("auth.page.einemBereichBeitreten")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("auth.page.gibDeinenBeitrittscodeUnd")}
        </p>
      </div>
      <JoinForm />
    </div>
  );
}
