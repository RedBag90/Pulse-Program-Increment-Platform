"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FEATURE_STATUS_LABELS, type FeatureStatus } from "@/modules/drumbeat/domain/status";

/**
 * **Die Rückfrage vor „Blockiert" und „Verworfen"** — für alle Schreibwege
 * dieselbe.
 *
 * Sie stand als Inline-JSX nur im Board. Tabelle und Bulk-Leiste riefen dieselbe
 * Action **ohne** `reason` auf; dieselbe Handlung folgte je nach Weg zwei
 * Regeln, und wer den Grund nicht angeben wollte, nahm die Tabelle. Als
 * gemeinsames Bauteil kann das nicht wieder auseinanderlaufen.
 *
 * `count` beziffert, wie viele Features betroffen sind — die Bulk-Leiste hält
 * mehrere auf einmal an, und das soll dastehen, bevor jemand bestätigt.
 */
export function StatusReasonDialog({
  targetStatus,
  count = 1,
  onCancel,
  onConfirm,
}: {
  /** `null` = zu. */
  targetStatus: FeatureStatus | null;
  count?: number;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  // Jede neue Rückfrage beginnt leer — sonst schlüge der Grund von vorhin still
  // auf das nächste Feature durch.
  useEffect(() => {
    if (targetStatus) setReason("");
  }, [targetStatus]);

  const label = targetStatus ? FEATURE_STATUS_LABELS[targetStatus] : "";

  return (
    <Dialog
      open={targetStatus != null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grund erforderlich</DialogTitle>
          <DialogDescription>
            {count > 1
              ? `${count} Features werden auf „${label}“ gesetzt. Das hält Arbeit an — dafür braucht es einen Satz, den die anderen später lesen können.`
              : `Ein Wechsel nach „${label}“ hält die Arbeit an. Er braucht einen Grund — wie im Feature-Detail.`}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          autoFocus
          aria-label="Grund"
          placeholder="Warum wird die Arbeit angehalten?"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={reason.trim() === ""}
            onClick={() => onConfirm(reason.trim())}
          >
            {targetStatus === "cancelled" ? "Verwerfen" : "Blockieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
