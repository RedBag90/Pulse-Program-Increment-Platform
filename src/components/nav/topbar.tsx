"use client";

import { Sun, Moon, Globe, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateMenu } from "@/features/create/create-menu";
import { MobileNav } from "@/components/nav/mobile-nav";
import { TopNav } from "@/components/nav/top-nav";
import { UserNav } from "@/components/nav/user-nav";

interface TopbarProps {
  userEmail: string;
  visibleHrefs: string[];
}

export function Topbar({ userEmail, visibleHrefs }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="flex h-12 shrink-0 items-center gap-5 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      {/* Mobile nav trigger (hidden on desktop) */}
      <MobileNav userEmail={userEmail} visibleHrefs={visibleHrefs} />

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 shrink-0">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary shrink-0">
          <Zap className="size-4 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="font-heading text-sm font-semibold tracking-tight">Pulse</span>
      </Link>

      {/* Primary navigation (desktop) */}
      <TopNav visibleHrefs={visibleHrefs} />

      <div className="flex-1" />

      {/* Actions — right */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Global create menu */}
        <CreateMenu />

        {/* Locale switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center justify-center rounded-md size-8 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("language")}
          >
            <Globe className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {routing.locales.map((l) => (
              <DropdownMenuItem
                key={l}
                onClick={() => router.replace(pathname, { locale: l })}
                className={locale === l ? "font-medium" : ""}
              >
                {l === "en" ? "English" : "Deutsch"}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 relative"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* User menu */}
        <div className="ml-1 pl-1">
          <UserNav email={userEmail} placement="topbar" />
        </div>
      </div>
    </header>
  );
}
