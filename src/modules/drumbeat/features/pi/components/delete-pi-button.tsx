"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useCallback } from "react";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deletePiAction } from "@/modules/drumbeat/features/pi/actions/pi";

interface Props {
  piId: string;
  artId: string;
  name: string;
}

/** Deletes a planned PI (cascading) and navigates back to the ART overview. */
export function DeletePiButton({ piId, artId, name }: Props) {
  const router = useRouter();
  const onSuccess = useCallback(() => router.replace(`/art/${artId}`), [router, artId]);

  return (
    <ConfirmMutateForm
      action={deletePiAction}
      fields={{ id: piId, artId }}
      label="Delete PI"
      pendingLabel="Deleting…"
      confirmPrompt={`Delete "${name}"? Its sprints and objectives are removed and assigned features return to the backlog.`}
      variant="outline"
      destructive
      icon={<Trash2 className="size-4 mr-1.5" />}
      onSuccess={onSuccess}
    />
  );
}
