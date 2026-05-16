"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { deletePiAction } from "@/features/pi/actions/pi";

interface Props {
  piId: string;
  artId: string;
  name: string;
}

/** Deletes a planned PI (cascading) and navigates back to the ART overview. */
export function DeletePiButton({ piId, artId, name }: Props) {
  const [state, action, isPending] = useActionState(deletePiAction, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.replace(`/art/${artId}`);
  }, [state, artId, router]);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            `Delete "${name}"? Its sprints and objectives are removed and assigned features return to the backlog.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={piId} />
      <input type="hidden" name="artId" value={artId} />
      {state?.error && <span className="text-red-600 text-xs block mb-1">{state.error}</span>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Delete PI"}
      </button>
    </form>
  );
}
