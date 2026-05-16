import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export default function SignUpPage() {
  const t = useTranslations("auth");

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">{t("signUp")}</h1>
      <SignUpForm />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t("alreadyAccount")}{" "}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </>
  );
}
