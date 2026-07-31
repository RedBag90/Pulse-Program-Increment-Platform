import type { ReactNode } from "react";
import { AuthHero } from "@/features/auth/components/auth-hero";

/**
 * Auth-Split-Layout (W5): links das dunkle Hero-Panel mit der Freemium-Story,
 * rechts das helle Formular-Panel. Auf Mobile gestapelt (Hero kompakt oben).
 * Alle (auth)-Seiten — sign-in, sign-up, forgot/reset-password, invite —
 * teilen dieses Layout.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <AuthHero />
      <div className="flex flex-1 items-center justify-center bg-background p-6 lg:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}
