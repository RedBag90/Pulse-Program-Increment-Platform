"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createTenantAction, type ActionState } from "@/features/platform/actions/tenant-actions";
import { ModuleCheckboxes } from "./module-checkboxes";
import { GeneratedCredentials } from "./generated-credentials";
import { ALL_ROLES, ROLES, ROLE_LABELS } from "@/modules/core/kernel/domain/roles";
import { SEED_PROFILE_META } from "../../../../prisma/seed-profile-meta";

/**
 * `platform_admin` ist hier nicht wählbar — dieselbe Sperre wie im Dienst
 * (`platform-test-users.ts`): eine plattformweite Rolle wird nicht nebenbei
 * beim Anlegen eines Testmandanten vergeben.
 */
const TESTNUTZER_ROLLEN = ALL_ROLES.filter((r) => r !== ROLES.PLATFORM_ADMIN);

/**
 * Anlage-Formular für eine neue Organisation (collapsible).
 *
 * Drei optionale Abschnitte unter den Stammdaten: ein **Datensatz**, mit dem der
 * Mandant gefüllt wird, eine **Zahl je Rolle** für Testnutzer, und danach die
 * **Zugangsdaten**.
 *
 * **Bei Testnutzern wird nicht weiternavigiert.** Das Passwort steht genau
 * einmal zur Verfügung — wegzuspringen hiesse, es wegzuwerfen. Ohne Testnutzer
 * bleibt es beim bisherigen Verhalten: direkt in die Detailansicht.
 */
export function CreateTenantForm() {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState<ActionState, FormData>(createTenantAction, {});

  const zeigtZugangsdaten = Boolean(state.testUserPassword && state.testUsers?.length);

  useEffect(() => {
    if (!state.success || !state.tenantId) return;
    // Solange die Zugangsdaten hier stehen, bleibt die Seite stehen.
    if (zeigtZugangsdaten) return;
    if (state.invited) router.refresh();
    else router.push(`/platform/tenants/${state.tenantId}`);
  }, [state, router, zeigtZugangsdaten]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {t("platform.ui.neueOrganisation")}
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg bg-card shadow-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("platform.ui.neueOrganisationAnlegen")}</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t("platform.ui.abbrechen")}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="ct-name" className="mb-1 block text-xs font-medium">
            {t("platform.ui.name")}
          </label>
          <input
            id="ct-name"
            name="name"
            required
            minLength={2}
            placeholder={t("platform.ui.acmeGmbh")}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div>
          <label htmlFor="ct-region" className="mb-1 block text-xs font-medium">
            {t("platform.ui.region")}
          </label>
          <select
            id="ct-region"
            name="region"
            defaultValue="eu"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="eu">EU</option>
            <option value="us">US</option>
            <option value="apac">{t("platform.ui.apac")}</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="ct-admin" className="mb-1 block text-xs font-medium">
          {t("platform.ui.eMailDesTenant")}
        </label>
        <input
          id="ct-admin"
          name="adminEmail"
          type="email"
          required
          placeholder={t("platform.ui.adminAcmeDe")}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {t("platform.ui.existiertDerAccountWird")}
        </p>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium">
          {t("platform.ui.freigeschalteteModule")}
        </span>
        <ModuleCheckboxes selected={["ziele", "portfolio", "program", "controlling"]} />
      </div>

      <fieldset className="space-y-2 border-t pt-3">
        <legend className="sr-only">{t("platform.ui.datensatz")}</legend>
        <span className="block text-xs font-medium">{t("platform.ui.datensatz")}</span>
        <div className="space-y-1.5">
          {SEED_PROFILE_META.map((p) => (
            <label key={p.id} className="flex items-start gap-2 text-xs">
              <input
                type="radio"
                name="seedProfile"
                value={p.id}
                defaultChecked={p.id === "none"}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">{p.label}</span>
                <span className="block text-muted-foreground">{p.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2 border-t pt-3">
        <legend className="sr-only">{t("platform.ui.testnutzer")}</legend>
        <span className="block text-xs font-medium">{t("platform.ui.testnutzerJeRolle")}</span>
        <p className="text-xs text-muted-foreground">
          Echte Konten mit einem gemeinsamen Passwort, das danach{" "}
          <strong className="text-foreground">{t("platform.ui.einmal")}</strong>{" "}
          {t("platform.ui.angezeigtWirdSieSehen")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TESTNUTZER_ROLLEN.map((role) => (
            <label key={role} className="flex items-center justify-between gap-2 text-xs">
              <span>{ROLE_LABELS[role]}</span>
              <input
                type="number"
                name={`testUsers.${role}`}
                min={0}
                max={20}
                defaultValue={0}
                className="w-16 rounded-md border bg-background px-2 py-1 text-right text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
          ))}
        </div>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && state.invited && (
        <p role="status" className="text-sm text-primary">
          {t("platform.ui.organisationAngelegtEinladungAn")}
        </p>
      )}
      {state.warnings?.map((w) => (
        <p key={w} role="status" className="text-xs text-amber-600 dark:text-amber-400">
          {w}
        </p>
      ))}
      {zeigtZugangsdaten && state.tenantId && (
        <GeneratedCredentials
          users={state.testUsers ?? []}
          password={state.testUserPassword ?? ""}
          tenantId={state.tenantId}
        />
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
