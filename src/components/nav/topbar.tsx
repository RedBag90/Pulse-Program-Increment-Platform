"use client";

import { signOut } from "@/features/auth/actions/sign-out";

export function Topbar() {
  return (
    <header className="h-14 border-b bg-white flex items-center justify-end px-6 shrink-0">
      <form action={signOut}>
        <button type="submit" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
          Sign out
        </button>
      </form>
    </header>
  );
}
