"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createTenantAction, type ActionState } from "@/features/platform/actions/tenant-actions";
import { ModuleCheckboxes } from "./module-checkboxes";

/**
 * Anlage-Formular für eine neue Organisation (collapsible). Bei Erfolg navigiert
 * es in die Detail-Ansicht des frisch angelegten Tenants; wurde der Initial-Admin
 * per E-Mail eingeladen (unbekannter User), bleibt ein Hinweis stehen.
 */
export function CreateTenantForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState<ActionState, FormData>(createTenantAction, {});

  useEffect(() => {
    if (state.success && state.tenantId && !state.invited) {
      router.push(`/platform/tenants/${state.tenantId}`);
    } else if (state.success && state.tenantId && state.invited) {
      router.refresh();
    }
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Neue Organisation
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Neue Organisation anlegen</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Abbrechen
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="ct-name" className="mb-1 block text-xs font-medium">
            Name
          </label>
          <input
            id="ct-name"
            name="name"
            required
            minLength={2}
            placeholder="Acme GmbH"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="ct-region" className="mb-1 block text-xs font-medium">
            Region
          </label>
          <select
            id="ct-region"
            name="region"
            defaultValue="eu"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="eu">EU</option>
            <option value="us">US</option>
            <option value="apac">APAC</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="ct-admin" className="mb-1 block text-xs font-medium">
          E-Mail des Tenant-Admins
        </label>
        <input
          id="ct-admin"
          name="adminEmail"
          type="email"
          required
          placeholder="admin@acme.de"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Existiert der Account, wird die Rolle direkt vergeben — sonst eine Einladung versendet.
        </p>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium">Freigeschaltete Module</span>
        <ModuleCheckboxes selected={["ziele", "portfolio", "program", "controlling"]} />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && state.invited && (
        <p role="status" className="text-sm text-primary">
          Organisation angelegt — Einladung an den Admin versendet.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "Wird angelegt…" : "Anlegen"}
      </button>
    </form>
  );
}
