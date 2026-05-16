import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");

  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">{t("forgotPassword")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("forgotPasswordHint")}</p>
      <ForgotPasswordForm />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </>
  );
}
