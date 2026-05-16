"use client";

import { useActionState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { deletePiAction } from "@/features/pi/actions/pi";
import { Button } from "@/components/ui/button";

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
      {state?.error && <span className="text-destructive text-xs block mb-1">{state.error}</span>}
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={isPending}
        className="text-destructive border-destructive/30 hover:bg-destructive/10"
      >
        <Trash2 className="size-4 mr-1.5" />
        {isPending ? "Deleting…" : "Delete PI"}
      </Button>
    </form>
  );
}
