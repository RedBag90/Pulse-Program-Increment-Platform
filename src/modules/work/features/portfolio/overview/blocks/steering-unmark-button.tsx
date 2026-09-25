"use client";

import { useActionState, startTransition } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { setEpicFlagAction } from "@/modules/work/features/portfolio/actions/epic";

/**
 * Der Merker „zur Steuerung" wieder weg — **an der Zeile, in der er stört.**
 *
 * Die Liste ist die Agenda des nächsten Steering-Meetings. Was darauf erledigt
 * ist, gehört herunter, und der Weg dorthin war bisher: Epic öffnen, Overview,
 * Haken suchen, zurück. Bei einer Agenda mit zwölf Zeilen ist das zwölfmal
 * derselbe Umweg.
 *
 * Nach dem Klick verschwindet die Zeile — die Liste steht auf `/portfolio`, und
 * `setEpicFlagAction` revalidiert sie über die Gruppe `epic`. Dass das
 * funktioniert, ist neu: bis September 2026 traf kein einziger
 * `revalidatePath`-Aufruf im Projekt (siehe `server/http/revalidation.ts`).
 */
export function SteeringUnmarkButton({ epicId, title }: { epicId: string; title: string }) {
  const t = useTranslations();
  const [, submit, busy] = useActionState(setEpicFlagAction, {});

  return (
    <button
      type="button"
      disabled={busy}
      title={t("work.overview.steuerungsmerkerEntfernen")}
      aria-label={t("work.overview.steuerungsmerkerEntfernenFuer", { title })}
      onClick={() => {
        const fd = new FormData();
        fd.set("id", epicId);
        fd.set("flag", "steering");
        fd.set("value", "false");
        startTransition(() => submit(fd));
      }}
      className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
    >
      <X className="size-3.5" />
    </button>
  );
}
