import { resolveInviteTarget } from "@/server/services/tenant-invite";
import { JoinForm } from "@/features/auth/components/join-form";

/**
 * Öffentliche Beitritts-Seite per Einladungslink (`/join/[token]`). Zeigt den
 * Ziel-Bereich (aus dem aktiven Invite) und braucht nur die E-Mail. Ungültiger
 * / deaktivierter Token ⇒ Hinweis.
 */
export default async function JoinByTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const target = await resolveInviteTarget({ token });

  if (!target) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Link ungültig</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dieser Einladungslink ist ungültig oder wurde deaktiviert.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold">
          Beitreten: <span className="text-primary">{target.tenantName}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Gib deine E-Mail ein, um beizutreten.</p>
      </div>
      <JoinForm token={token} />
    </div>
  );
}
