"use client";

import { useState, useActionState, startTransition } from "react";
import { useTranslations } from "next-intl";
import { setPortfolioOverrideAction } from "@/modules/work/features/portfolio/actions/epic";

/**
 * **Ein ART-Epic zur Portfolio-Sache erklären** — mit Begründung, und nur in
 * diese Richtung.
 *
 * Die Klasse entsteht aus den Kosten gegen das Portfolio-Limit. Es gibt
 * Vorhaben, die darunter liegen und trotzdem vors Portfolio gehören: weil sie
 * einen kritischen Wertstrom berühren, weil sie politisch sind, weil die
 * Kostenschätzung zu optimistisch wirkt. Dafür ist diese Ausnahme da.
 *
 * **Umgekehrt geht es nicht.** Was über dem Limit liegt, braucht eine
 * Portfolio-Entscheidung, und der Rahmen eines ARTs könnte es ohnehin nicht
 * tragen — eine Ausnahme nach unten wäre eine Ausnahme von der Arithmetik.
 *
 * Die Begründung ist Pflicht (der Dienst erzwingt `min(1)`): eine Ausnahme
 * ohne Grund ist im Nachhinein nicht zu beurteilen.
 */
export function PortfolioOverrideDialog({
  epicId,
  valueStreamId,
}: {
  epicId: string;
  valueStreamId: string;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, submit, busy] = useActionState(setPortfolioOverrideAction, {});

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-md border border-warning/40 px-2 py-0.5 text-xs font-medium text-warning hover:bg-warning-surface"
      >
        {t("work.epic.alsPortfolioSacheFuehren")}
      </button>
    );
  }

  return (
    <div className="w-full space-y-2">
      <label htmlFor="override-reason" className="block text-xs font-medium">
        {t("work.epic.begruendungPflicht")}
      </label>
      <textarea
        id="override-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || reason.trim() === ""}
          onClick={() => {
            const fd = new FormData();
            fd.set("epicId", epicId);
            fd.set("valueStreamId", valueStreamId);
            fd.set("reason", reason);
            startTransition(() => submit(fd));
          }}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t("common.ui.speichern")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
        >
          {t("common.ui.abbrechen")}
        </button>
      </div>
    </div>
  );
}
