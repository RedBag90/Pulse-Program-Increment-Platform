import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SignInForm } from "@/features/auth/components/sign-in-form";

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
    </>
  );
}
