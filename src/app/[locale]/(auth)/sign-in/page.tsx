import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SignInForm } from "@/features/auth/components/sign-in-form";

const TEST_PASSWORD = "Test1234!";

/** One probe account per RBAC role — all share TEST_PASSWORD. Seeded by
 *  scripts/seed-test-accounts.mjs. */
const TEST_USERS = [
  { email: "platform-admin@pulse.dev", role: "Platform Admin" },
  { email: "tenant-admin@pulse.dev", role: "Tenant Admin" },
  { email: "portfolio-manager@pulse.dev", role: "Portfolio Manager" },
  { email: "value-stream-owner@pulse.dev", role: "Value Stream Owner" },
  { email: "epic-owner@pulse.dev", role: "Epic Owner" },
  { email: "vmo@pulse.dev", role: "VMO · Epic QA" },
  { email: "rte@pulse.dev", role: "RTE · Feature QA" },
  { email: "feature-owner@pulse.dev", role: "Feature Owner" },
  { email: "team-editor@pulse.dev", role: "Team Editor" },
  { email: "story-owner@pulse.dev", role: "Story Owner" },
  { email: "task-owner@pulse.dev", role: "Task Owner" },
  { email: "viewer@pulse.dev", role: "Viewer · read-only" },
] as const;

export default function SignInPage() {
  const t = useTranslations("auth");

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">{t("signIn")}</h1>
      <SignInForm />
      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          {t("forgotPassword")}
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/sign-up" className="font-medium text-primary hover:underline">
          {t("signUp")}
        </Link>
      </p>

      {process.env.NODE_ENV === "development" && (
        <div className="mt-8 rounded-lg border border-dashed border-amber-400 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-800">🧪 Demo accounts — one per role</p>
          <p className="mb-3 text-xs text-amber-700">
            Password for all: <span className="font-mono">{TEST_PASSWORD}</span>
          </p>
          <div className="space-y-1.5">
            {TEST_USERS.map((u) => (
              <div key={u.email} className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs text-foreground">{u.email}</span>
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
