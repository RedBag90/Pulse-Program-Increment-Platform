import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  /**
   * `flush` removes the page padding (for full-bleed Gantt/board pages). The
   * max-width centering still applies. Document the reason in a comment when
   * choosing this variant.
   */
  variant?: "default" | "flush";
  className?: string;
}

/**
 * Page wrapper — owns horizontal/vertical padding, content max-width and the
 * vertical rhythm between top-level children (header + sections) via the
 * layout tokens in `globals.css`.
 *
 * Renders a `<div>`, not a `<main>` — the dashboard layout's `<main>` already
 * wraps every page, and nesting `<main>`s is invalid HTML.
 *
 * See `docs/design-tokens.md`.
 */
export function Page({ children, variant = "default", className }: Props) {
  return (
    <div
      className={cn(
        // Die Tokens statt ihrer Tailwind-Entsprechungen: `docs/design-tokens.md`
        // beschrieb sie als verbindlich, gelesen wurde bis September 2026 aber
        // nur `--page-max-w`. Die Werte sind dieselben (1.5rem / 2rem) — neu ist
        // allein, dass es jetzt einen Drehpunkt gibt statt vier Klassen.
        "mx-auto flex w-full flex-col gap-[var(--page-section-gap)]",
        variant === "default" &&
          "px-[var(--page-pad-x-sm)] py-[var(--page-pad-y)] md:px-[var(--page-pad-x)]",
        className,
      )}
      style={{ maxWidth: "var(--page-max-w)" }}
    >
      {children}
    </div>
  );
}
