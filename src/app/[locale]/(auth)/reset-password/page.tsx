import { useTranslations } from "next-intl";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export default function ResetPasswordPage() {
  const t = useTranslations("auth");

  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">{t("resetPassword")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("resetPasswordHint")}</p>
      <ResetPasswordForm />
    </>
  );
}
