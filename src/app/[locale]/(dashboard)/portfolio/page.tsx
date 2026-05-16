import { useTranslations } from "next-intl";

export default function PortfolioPage() {
  const t = useTranslations("portfolio");

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">Portfolio management coming in Sprint 5.</p>
    </main>
  );
}
