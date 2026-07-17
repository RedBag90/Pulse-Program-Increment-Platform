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
        "mx-auto flex w-full flex-col gap-6",
        variant === "default" && "px-6 py-8 md:px-8",
        className,
      )}
      style={{ maxWidth: "var(--page-max-w)" }}
    >
      {children}
    </div>
  );
}
