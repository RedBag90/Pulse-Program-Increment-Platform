import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Inter_Tight } from "next/font/google";
import { isLocale } from "@/i18n/routing";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebVitalsReporter } from "@/components/perf/web-vitals-reporter";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * **Die Überschriftenschrift.** `--font-heading` war bis September 2026
 * wertgleich mit `--font-sans` — die Klasse `font-heading` stand an 57 Stellen
 * und bewirkte nichts (ADR-0021).
 *
 * Inter Tight ist die engere Schwester derselben Grotesk-Familie, aus der auch
 * Geist kommt: als H1 bei 24 px spürbar kompakter und ruhiger, im Kartentitel
 * bei 16 px kaum unterscheidbar. Genau die Zurückhaltung, die eine dichte
 * Arbeitsfläche braucht — die Überschrift soll sich abheben, nicht melden.
 */
const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});
import "../globals.css";

export const metadata: Metadata = {
  title: "Pulse — Program Increment Platform",
  description: "SAFe-native program increment and portfolio management platform",
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  // **Ohne das kennt der Server-Render die Sprache nicht.** `getTranslations`
  // und die Formatierer lesen den Locale aus dem Request-Kontext; wer ihn nicht
  // setzt, bekommt in Server-Komponenten stillschweigend die Vorgabe — also
  // deutsche Texte auf `/en/`, ohne dass irgendwo ein Fehler entstünde. Es
  // fehlte bis September 2026 vollständig.
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${GeistSans.variable} ${GeistMono.variable} ${interTight.variable}`}
      suppressHydrationWarning
    >
      <body>
        <WebVitalsReporter />
        <SpeedInsights />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
          </TooltipProvider>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
