"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User, ChevronUp, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";
import { clearTenantCookieAction } from "@/features/auth/actions/switch-tenant";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserNavProps {
  email: string;
  /** `sidebar` (default) = full-width row, menu opens upward; `topbar` = compact avatar, menu opens down. */
  placement?: "sidebar" | "topbar";
  /** Blendet den Einstieg in die Plattform-Verwaltung ein (globaler platform_admin). */
  isPlatformAdmin?: boolean;
}

function getInitials(email: string): string {
  const parts = email.split("@")[0]?.split(/[._-]/) ?? [];
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function UserNav({ email, placement = "sidebar", isPlatformAdmin = false }: UserNavProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      // Tenant-Auswahl serverseitig räumen (httpOnly-Cookie), dann Session beenden.
      await clearTenantCookieAction();
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/sign-in");
      router.refresh();
    });
  };

  const topbar = placement === "topbar";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          topbar
            ? "flex items-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            : "flex items-center gap-2.5 w-full rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent transition-colors text-left disabled:opacity-50"
        }
        disabled={isPending}
        aria-label={topbar ? email : undefined}
      >
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className="text-[10px] font-semibold bg-primary text-primary-foreground">
            {getInitials(email)}
          </AvatarFallback>
        </Avatar>
        {!topbar && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{email}</p>
            </div>
            <ChevronUp className="size-3 text-sidebar-foreground/50 shrink-0" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={topbar ? "bottom" : "top"} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled>
            <User className="size-4 mr-2" />
            Profile
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {isPlatformAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/platform/tenants" />}>
                <Shield className="size-4 mr-2" />
                Plattform-Verwaltung
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={handleSignOut}
            disabled={isPending}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="size-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
