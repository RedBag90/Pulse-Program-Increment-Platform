import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SignInForm } from "@/features/auth/components/sign-in-form";

const TEST_USERS = [
  { email: "admin@pulse.dev", password: "Admin1234!", role: "Admin + Portfolio Editor" },
  { email: "portfolio@pulse.dev", password: "Test1234!", role: "Portfolio Editor" },
  { email: "viewer@pulse.dev", password: "Test1234!", role: "Viewer (read-only)" },
] as const;

export default function SignInPage() {
  const t = useTranslations("auth");

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">{t("signIn")}</h1>
      <SignInForm />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/sign-up" className="font-medium text-primary hover:underline">
          {t("signUp")}
        </Link>
      </p>

      {process.env.NODE_ENV === "development" && (
        <div className="mt-8 rounded-lg border border-dashed border-amber-400 bg-amber-50 p-4 text-sm">
          <p className="mb-3 font-semibold text-amber-800">🧪 Demo accounts</p>
          <div className="space-y-2">
            {TEST_USERS.map((u) => (
              <div key={u.email} className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-mono text-xs text-gray-800">{u.email}</span>
                  <span className="mx-1 text-gray-400">/</span>
                  <span className="font-mono text-xs text-gray-800">{u.password}</span>
                </div>
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
