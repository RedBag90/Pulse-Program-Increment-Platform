"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, startTransition } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { startArtAction } from "@/features/transformation/actions/start-art";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPicker } from "@/components/detail/user-picker";

interface Option {
  id: string;
  label: string;
}

interface Props {
  valueStreams: Option[];
  rteUsers: Option[];
  canManage: boolean;
}

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Guided „ART starten"-Flow. Legt ART (+ optional RTE) unter einem Wertstrom an.
 * **Kadenz-frei**: eine PI-Timeline/Kadenz wird bewusst NICHT hier gewählt —
 * das ist Drumbeat und wird nachträglich pro ART zugewiesen (nur mit Drumbeat).
 */
export function StartArtForm({ valueStreams, rteUsers, canManage }: Props) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(startArtAction, {});

  const [valueStreamId, setValueStreamId] = useState(valueStreams[0]?.id ?? "");
  const [name, setName] = useState("");
  const [rteId, setRteId] = useState("");

  function submit() {
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        valueStreamId,
        name,
        rteId: rteId || null,
      }),
    );
    startTransition(() => formAction(fd));
  }

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("transformation.ui.nurAdministratorInnenKoennen")}
      </p>
    );
  }

  if (valueStreams.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("transformation.ui.legeZuerstEinenWertstrom")}
      </p>
    );
  }

  if (state.created) {
    return (
      <div className="space-y-2">
        <p role="status" className="flex items-center gap-2 text-sm text-success">
          {t("transformation.ui.artGestartet")}
          {state.created.href && (
            <Link
              href={state.created.href}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {t("transformation.ui.zumArt")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{t("transformation.ui.einePiKadenzKann")}</p>
      </div>
    );
  }

  const canSubmit = !isPending && valueStreamId && name.trim();

  return (
    <div className="max-w-xl space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="sa-vs">{t("transformation.ui.wertstrom")}</Label>
        <select
          id="sa-vs"
          className={SELECT}
          value={valueStreamId}
          onChange={(e) => setValueStreamId(e.target.value)}
        >
          {valueStreams.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sa-name">{t("transformation.ui.artName")}</Label>
        <Input id="sa-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>{t("transformation.ui.rteOptional")}</Label>
        <UserPicker
          value={rteId}
          onChange={setRteId}
          options={rteUsers.map((u) => ({ value: u.id, label: u.label }))}
          ariaLabel={t("transformation.ui.rte")}
          placeholder={t("transformation.ui.niemand")}
          emptyLabel={t("transformation.ui.niemand")}
        />
      </div>

      <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        {t("transformation.ui.einePiKadenzIst")}
      </p>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="button" disabled={!canSubmit} onClick={submit}>
        {isPending ? t("transformation.ui.artStartetLaeuft") : t("pages.ui.artStarten")}
      </Button>
    </div>
  );
}
