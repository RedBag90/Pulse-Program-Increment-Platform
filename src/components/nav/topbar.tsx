"use client";

import { useCallback, useEffect, useState } from "react";
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
import { TopNavMegaTriggers } from "@/components/nav/top-nav-mega-triggers";
import { TopNavMegaPanel } from "@/components/nav/top-nav-mega-panel";
import { UserNav } from "@/components/nav/user-nav";

interface TopbarProps {
  userEmail: string;
  visibleHrefs: string[];
}

/**
 * The application's top bar. Hosts the mega-menu state: a single `openKey`
 * identifies which Multi-Item NavGroup is currently expanded into the
 * full-width panel below the trigger row. The panel is **standing** — it
 * survives navigation; only a trigger toggle, ESC, or clicking another
 * Multi-Item trigger changes it.
 */
export function Topbar({ userEmail, visibleHrefs }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();

  const [openKey, setOpenKey] = useState<string | null>(null);

  // ESC closes the panel and returns focus to the trigger that opened it.
  // We look the trigger up by `data-trigger-key` rather than holding refs —
  // simpler than threading refs through the children component.
  const closeAndRestoreFocus = useCallback(() => {
    setOpenKey((current) => {
      if (current) {
        // Defer focus until after React commits the new state — otherwise the
        // newly-rendered button (with aria-expanded=false) may not exist yet.
        queueMicrotask(() => {
          const trigger = document.querySelector<HTMLButtonElement>(
            `[data-trigger-key="${current}"]`,
          );
          trigger?.focus();
        });
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (openKey === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeAndRestoreFocus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openKey, closeAndRestoreFocus]);

  return (
    <header className="flex shrink-0 flex-col border-b bg-background/80 backdrop-blur-sm">
      {/* Topbar row */}
      <div className="flex h-12 items-center gap-5 px-4 md:px-6">
        {/* Mobile nav trigger (hidden on desktop) */}
        <MobileNav userEmail={userEmail} visibleHrefs={visibleHrefs} />

        {/* Logo */}
        <Link
          href="/"
          onClick={() => setOpenKey(null)}
          className="flex shrink-0 items-center gap-2.5"
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Zap className="size-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-heading text-sm font-semibold tracking-tight">Pulse</span>
        </Link>

        {/* Primary navigation (desktop) */}
        <TopNavMegaTriggers
          visibleHrefs={visibleHrefs}
          openKey={openKey}
          onOpenChange={setOpenKey}
        />

        <div className="flex-1" />

        {/* Actions — right */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Global create menu */}
          <CreateMenu />

          {/* Locale switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex size-8 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            className="relative size-8"
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
      </div>

      {/* Full-width mega-menu panel — sibling to the row, in normal flow.
          Renders null while no group is open, so no extra height. */}
      <TopNavMegaPanel visibleHrefs={visibleHrefs} openKey={openKey} />
    </header>
  );
}
