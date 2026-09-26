"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Building2, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchTenantAction } from "@/features/auth/actions/switch-tenant";

export interface TenantOption {
  id: string;
  name: string;
  /** "personal" | "organization". */
  kind: string;
}

interface Props {
  tenants: TenantOption[];
  activeTenantId: string;
}

/**
 * Bereichs-Wechsler (W2) — rechts in der Topbar. Zeigt den aktiven Tenant
 * (🔒 Privat / 🏢 Organisation); Auswahl setzt das pulse-tenant-Cookie per
 * Server-Action und lädt die Seite neu (der Layout-Route-Guard leitet auf ein
 * freigeschaltetes Modul um, falls die aktuelle Route im Ziel-Tenant gesperrt
 * ist). Bei nur einem Tenant: stilles Label ohne Dropdown.
 */
export function TenantSwitcher({ tenants, activeTenantId }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const active = tenants.find((t) => t.id === activeTenantId) ?? tenants[0];
  if (!active) return null;

  const label = active.kind === "personal" ? t("nav.ui.privaterBereich") : active.name;
  const ActiveIcon = active.kind === "personal" ? Lock : Building2;

  const switchTo = (tenantId: string) => {
    if (tenantId === activeTenantId) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("tenantId", tenantId);
      const result = await switchTenantAction({}, fd);
      if (!result.error) router.refresh();
    });
  };

  if (tenants.length <= 1) {
    return (
      <span className="hidden items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground md:inline-flex">
        <ActiveIcon className="size-3" aria-hidden />
        <span className="max-w-32 truncate">{label}</span>
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        aria-label={t("nav.ui.bereichWechseln")}
      >
        <ActiveIcon className="size-3" aria-hidden />
        <span className="max-w-32 truncate">{label}</span>
        <ChevronDown className="size-3 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {t("nav.ui.bereichWechseln")}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {tenants.map((tenant) => {
            const Icon = tenant.kind === "personal" ? Lock : Building2;
            const isActive = tenant.id === activeTenantId;
            return (
              <DropdownMenuItem
                key={tenant.id}
                onClick={() => switchTo(tenant.id)}
                className={cn("gap-2", isActive && "font-medium")}
              >
                <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {tenant.kind === "personal"
                    ? t("nav.ui.privaterBereichName", { name: tenant.name })
                    : tenant.name}
                </span>
                {isActive && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
