"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { ROLE_LABELS, type Role } from "@/modules/core/kernel/domain/roles";

/**
 * **Die Zugangsdaten frisch erzeugter Testnutzer — einmalig.**
 *
 * Supabase speichert nur den Hash. Was hier nicht abgeschrieben wird, ist nicht
 * mehr zu beschaffen; ein Zurücksetzen ginge nur über eine neue Einladung. Die
 * Karte sagt das, statt es den Leser herausfinden zu lassen, und das Formular
 * navigiert deshalb **nicht** weg, solange sie steht.
 */
export function GeneratedCredentials({
  users,
  password,
  tenantId,
}: {
  users: { email: string; role: string }[];
  password: string;
  tenantId: string;
}) {
  const t = useTranslations();
  const [kopiert, setKopiert] = useState(false);

  const alles = users.map((u) => `${u.email}\t${password}`).join("\n");
  const kopieren = () => {
    void navigator.clipboard?.writeText(alles).then(
      () => setKopiert(true),
      () => setKopiert(false),
    );
  };

  return (
    <section className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold">{users.length} Testnutzer angelegt</h4>
        <button
          type="button"
          onClick={kopieren}
          className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted"
        >
          {kopiert ? "Kopiert" : "Alle kopieren"}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">{t("platform.ui.dasPasswortStehtHier")}</strong>{" "}
        {t("platform.ui.esIstFuerAlle")}
      </p>

      <p className="font-mono text-sm">
        <span className="text-muted-foreground">{t("platform.ui.passwort")} </span>
        <span className="select-all font-semibold">{password}</span>
      </p>

      <ul className="space-y-1">
        {users.map((u) => (
          <li key={u.email} className="flex items-baseline justify-between gap-3 text-xs">
            <span className="select-all font-mono">{u.email}</span>
            <span className="shrink-0 text-muted-foreground">
              {ROLE_LABELS[u.role as Role] ?? u.role}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={`/platform/tenants/${tenantId}`}
        className="inline-block text-sm text-primary hover:underline"
      >
        {t("platform.ui.zumMandanten")}
      </Link>
    </section>
  );
}
