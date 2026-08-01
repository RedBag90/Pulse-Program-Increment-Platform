import { JoinForm } from "@/features/auth/components/join-form";

/**
 * Öffentliche Beitritts-Seite per Code (`/join`). Für den Link-Weg s.
 * `/join/[token]`. Kein Auth — die Server-Action prüft Code + E-Mail.
 */
export default function JoinByCodePage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Einem Bereich beitreten</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gib deinen Beitrittscode und deine E-Mail ein.
        </p>
      </div>
      <JoinForm />
    </div>
  );
}
