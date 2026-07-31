import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 🔒-Upsell-Hinweis für modul-gesperrte Flächen (Freemium) — konsistent mit
 * der Nav-Optik (ausgegrauter Lock). Zwei Varianten:
 *  - `inline` (Default): kompakte Zeile für Drawer-Sektionen statt eines Pickers.
 *  - `card`: Platzhalter-Karte für ganze Tab-Inhalte (z. B. Money-Tab).
 */
export function LockedHint({
  text,
  variant = "inline",
  className,
}: {
  text: string;
  variant?: "inline" | "card";
  className?: string;
}) {
  if (variant === "card") {
    return (
      <div
        className={cn(
          "grid place-items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center",
          className,
        )}
      >
        <Lock className="size-5 text-muted-foreground/60" aria-hidden />
        <p className="max-w-md text-sm text-muted-foreground">{text}</p>
        <p className="text-xs font-medium text-muted-foreground/70">Teil der Vollversion</p>
      </div>
    );
  }
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground/80",
        className,
      )}
    >
      <Lock className="size-3 shrink-0 opacity-60" aria-hidden />
      <span>{text} — Teil der Vollversion.</span>
    </p>
  );
}
