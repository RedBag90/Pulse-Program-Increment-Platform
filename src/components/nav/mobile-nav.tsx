"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/nav/sidebar";

interface Props {
  userEmail: string;
  visibleHrefs: string[];
}

/**
 * Mobile primary navigation — a left drawer holding the same Sidebar, opened
 * from a hamburger in the topbar. The desktop sidebar is `hidden md:flex`, so
 * without this phone users have no navigation. Auto-closes on route change.
 */
export function MobileNav({ userEmail, visibleHrefs }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("nav");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8 md:hidden"
            aria-label={t("openMenu")}
          />
        }
      >
        <Menu className="size-4" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <Sidebar userEmail={userEmail} visibleHrefs={visibleHrefs} />
      </SheetContent>
    </Sheet>
  );
}
