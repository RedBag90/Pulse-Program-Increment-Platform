"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  deleteTenantWithDataAction,
  resetTenantAction,
  type ActionState,
} from "@/features/platform/actions/tenant-actions";
import { SEED_PROFILE_META } from "../../../../prisma/seed-profile-meta";

/**
 * **Zurücksetzen und Löschen samt Inhalt.**
 *
 * Getrennt von den Lifecycle-Knöpfen daneben, weil beides nicht umkehrbar ist:
 * `deleteTenant` verweigert jeden nicht-leeren Mandanten und verweist auf
 * „archivieren" — hier steht der ausdrückliche Weg.
 *
 * **Die Sicherung ist der abgetippte Name**, nicht ein Bestätigungsdialog. Ein
 * `window.confirm` klickt man weg; einen Namen tippt man nicht versehentlich.
 * Geprüft wird er trotzdem **im Dienst** erneut: die Server-Action ist ein
 * Endpunkt, der Knopf davor nur eine Schaltfläche.
 */
export function TenantDangerZone({
  tenantId,
  name,
  memberCount,
}: {
  tenantId: string;
  name: string;
  /** Wie viele Mitglieder der Mandant hat — für den Satz über dem Häkchen. */
  memberCount: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [getippt, setGetippt] = useState("");
  const [dState, dAction, dPending] = useActionState<ActionState, FormData>(
    deleteTenantWithDataAction,
    {},
  );
  const [rState, rAction, rPending] = useActionState<ActionState, FormData>(resetTenantAction, {});

  useEffect(() => {
    if (dState.success) router.push("/platform/tenants");
  }, [dState, router]);
  useEffect(() => {
    if (rState.success) router.refresh();
  }, [rState, router]);

  const passt = getippt.trim() === name;
  const error = dState.error ?? rState.error;

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
      >
        {t("platform.ui.zuruecksetzenOderSamtInhalt")}
      </button>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-destructive/30 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold text-destructive">
          {t("platform.ui.nichtUmkehrbar")}
        </h4>
        <button
          type="button"
          onClick={() => setOffen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t("platform.ui.schliessen")}
        </button>
      </div>

      <div>
        <label htmlFor="dz-name" className="mb-1 block text-xs font-medium">
          {t("platform.ui.zumBestaetigenDenMandantennamen")}{" "}
          <code className="font-mono">{name}</code>
        </label>
        <input
          id="dz-name"
          value={getippt}
          onChange={(e) => setGetippt(e.target.value)}
          autoComplete="off"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <form action={rAction} className="space-y-2 border-t pt-3">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="confirmName" value={getippt} />
        <span className="block text-xs font-medium">{t("platform.ui.zuruecksetzen")}</span>
        <p className="text-xs text-muted-foreground">
          {t("platform.ui.alleFachdatenWerdenGeloescht")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            name="seedProfile"
            defaultValue="none"
            className="rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {SEED_PROFILE_META.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === "none" ? t("platform.ui.leerZuruecksetzen") : p.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!passt || rPending}
            className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
          >
            {rPending ? t("platform.ui.zuruecksetzenLaeuft") : t("platform.ui.zuruecksetzen")}
          </button>
        </div>
      </form>

      <form action={dAction} className="space-y-2 border-t pt-3">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="confirmName" value={getippt} />
        <span className="block text-xs font-medium">{t("platform.ui.samtInhaltLoeschen")}</span>
        <label className="flex items-start gap-2 text-xs">
          <input type="checkbox" name="alsoDeleteUsers" className="mt-0.5" />
          <span>
            {t("platform.ui.auchDieKontenLoeschen")}{" "}
            <span className="text-muted-foreground">
              {t.rich(
                memberCount === 1
                  ? "platform.ui.kontenLoeschenHinweisEinMitglied"
                  : "platform.ui.kontenLoeschenHinweisMitglieder",
                {
                  count: memberCount,
                  strong: (c) => <strong className="text-foreground">{c}</strong>,
                },
              )}
            </span>
          </span>
        </label>
        <button
          type="submit"
          disabled={!passt || dPending}
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-40"
        >
          {dPending
            ? t("platform.ui.mandantWirdGeloescht")
            : t("platform.ui.mandantEndgueltigLoeschen")}
        </button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {dState.warnings?.map((w) => (
        <p key={w} className="text-xs text-amber-600 dark:text-amber-400">
          {w}
        </p>
      ))}
    </section>
  );
}
