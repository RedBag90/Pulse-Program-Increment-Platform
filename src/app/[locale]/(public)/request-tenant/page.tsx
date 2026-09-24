import { useTranslations } from "next-intl";
import { RequestTenantForm } from "@/features/auth/components/request-tenant-form";

/**
 * Öffentliche Seite „Organisation anfragen" (`/request-tenant`, kein Auth).
 * Legt einen Provisioning-Antrag an, den der platform_admin genehmigt.
 */
export default function RequestTenantPage() {
  const t = useTranslations();
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold">{t("pages.ui.organisationAnfragen")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("pages.ui.fordereEinenEigenenOrganisations")}
        </p>
      </div>
      <RequestTenantForm />
    </div>
  );
}
