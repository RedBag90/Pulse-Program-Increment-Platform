"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw, Power } from "lucide-react";
import {
  rotateInviteAction,
  deactivateInviteAction,
  setInviteAutoAcceptAction,
} from "@/features/admin/actions/join-request-actions";

/**
 * Verwaltung des offenen Einladungslinks + Beitrittscodes eines Tenants
 * (tenant_admin). Kopieren · autoAccept umschalten · neu generieren ·
 * deaktivieren. Direkt-Aufruf der Server-Actions über useTransition.
 */
export function InviteManager({
  linkToken,
  joinCode,
  autoAccept,
  active,
}: {
  linkToken: string;
  joinCode: string;
  autoAccept: boolean;
  active: boolean;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/${locale}/join/${linkToken}`;

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res.error) setError(res.error);
      else router.refresh();
    });

  const copy = (value: string, which: "link" | "code") => {
    void navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!active) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-4">
        <p className="text-sm text-muted-foreground">Kein aktiver Einladungslink.</p>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(rotateInviteAction)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          Link erstellen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Einladungslink</span>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link}
            className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-3 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => copy(link, "link")}
            aria-label="Link kopieren"
            className="inline-flex size-8 items-center justify-center rounded-md border transition-colors hover:bg-muted"
          >
            {copied === "link" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Beitrittscode</span>
        <div className="flex items-center gap-2">
          <span className="rounded-md border bg-muted/40 px-3 py-1.5 font-mono text-sm tracking-widest">
            {joinCode}
          </span>
          <button
            type="button"
            onClick={() => copy(joinCode, "code")}
            aria-label="Code kopieren"
            className="inline-flex size-8 items-center justify-center rounded-md border transition-colors hover:bg-muted"
          >
            {copied === "code" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={autoAccept}
          disabled={isPending}
          onChange={(e) => run(() => setInviteAutoAcceptAction(e.target.checked))}
          className="size-4"
        />
        Beitritt automatisch bestätigen (ohne Freigabe)
      </label>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(rotateInviteAction)}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Neu generieren
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(deactivateInviteAction)}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Power className="size-3.5" aria-hidden />
          Deaktivieren
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
