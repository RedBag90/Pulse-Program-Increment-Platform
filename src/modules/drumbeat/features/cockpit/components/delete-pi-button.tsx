"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useCallback } from "react";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deletePiAction } from "@/modules/drumbeat/features/cockpit/actions/pi";

interface Props {
  piId: string;
  artId: string;
  name: string;
}

/**
 * Löscht ein geplantes PI (kaskadierend) und bleibt im Cockpit.
 *
 * Vorher führte der Erfolg auf `/art/<id>` — **diese Route gibt es nicht** (die
 * ART-Seite liegt unter `/structure/…/art/[id]`). Wer ein PI löschte, landete
 * auf einer 404 und verlor Sicht, Filter und Scope. Jetzt bleibt er, wo er war;
 * nur das gelöschte PI ist fort.
 */
export function DeletePiButton({ piId, artId, name }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const onSuccess = useCallback(() => router.replace(`/umsetzung?art=${artId}`), [router, artId]);

  return (
    <ConfirmMutateForm
      action={deletePiAction}
      fields={{ id: piId, artId }}
      label={t("drumbeat.ui.piLoeschen")}
      pendingLabel="Löscht…"
      confirmPrompt={`„${name}" wirklich löschen? Seine Sprints und Objectives werden mit entfernt; zugeordnete Features gehen zurück in den Backlog.`}
      variant="outline"
      destructive
      icon={<Trash2 className="size-4 mr-1.5" />}
      onSuccess={onSuccess}
    />
  );
}
