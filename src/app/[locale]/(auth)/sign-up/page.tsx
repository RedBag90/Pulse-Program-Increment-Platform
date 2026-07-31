import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export default function SignUpPage() {
  const t = useTranslations("auth");

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Konto erstellen</h1>
      <p className="mb-6 mt-1.5 text-sm text-muted-foreground">
        Starte kostenlos mit deinem persönlichen Ziele-Bereich.
      </p>
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
