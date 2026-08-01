import { RequestTenantForm } from "@/features/auth/components/request-tenant-form";

/**
 * Öffentliche Seite „Organisation anfragen" (`/request-tenant`, kein Auth).
 * Legt einen Provisioning-Antrag an, den der platform_admin genehmigt.
 */
export default function RequestTenantPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Organisation anfragen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fordere einen eigenen Organisations-Bereich an. Wir schalten ihn nach Prüfung frei.
        </p>
      </div>
      <RequestTenantForm />
    </div>
  );
}
