"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { unlinkDependencyAction } from "@/modules/drumbeat/features/dependencies/actions/dependency";

interface Props {
  fromId: string;
  toId: string;
  type: "blocks" | "depends_on" | "relates_to";
  artId: string;
}

/** Removes a dependency link from the feature detail page. */
export function UnlinkDependencyButton({ fromId, toId, type, artId }: Props) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(unlinkDependencyAction, {});

  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="fromId" value={fromId} />
      <input type="hidden" name="toId" value={toId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="artId" value={artId} />
      {state.error && <span className="text-label text-destructive">{state.error}</span>}
      <button
        type="submit"
        disabled={isPending}
        className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        {isPending ? "…" : t("drumbeat.ui.abhaengigkeitLoesenKurz")}
      </button>
    </form>
  );
}
