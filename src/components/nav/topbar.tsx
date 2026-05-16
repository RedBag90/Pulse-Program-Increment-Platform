"use client";

import { useTranslations } from "next-intl";
import { signOut } from "@/features/auth/actions/sign-out";
import { LocaleSwitcher } from "@/components/nav/locale-switcher";

export function Topbar() {
  const t = useTranslations("auth");

  return (
    <header className="h-14 border-b bg-white flex items-center justify-end gap-4 px-6 shrink-0">
      <LocaleSwitcher />
      <form action={signOut}>
        <button type="submit" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
          {t("signOut")}
        </button>
      </form>
    </header>
  );
}
