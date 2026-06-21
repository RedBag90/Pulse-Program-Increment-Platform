"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  StandardPreviewDialog,
  type FullPiStandardOption,
} from "@/features/structure/components/standard-preview-dialog";

export type PiStandardOption = FullPiStandardOption;

interface ExistingPi {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

/**
 * Per-Timeline control: oeffnet einen Preview-Dialog, in dem der User einen
 * PI-Standard waehlt, das Anchor-Jahr setzt und die zu erzeugenden PIs sieht
 * (inkl. Konflikt-Markierung) — bevor `addStandardPisAction` ausgefuehrt wird.
 * Gated by `canManageTimeline`.
 */
export function AddStandardPisControl({
  timelineId,
  standards,
  existingPis,
}: {
  timelineId: string;
  standards: PiStandardOption[];
  existingPis: ExistingPi[];
}) {
  const [open, setOpen] = useState(false);

  if (standards.length === 0) return null;

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Standard anwenden…
      </Button>
      <StandardPreviewDialog
        open={open}
        onOpenChange={setOpen}
        timelineId={timelineId}
        standards={standards}
        existingPis={existingPis}
      />
    </>
  );
}
