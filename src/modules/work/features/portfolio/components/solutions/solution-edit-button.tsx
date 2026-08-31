"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { SolutionDetailModel } from "@/modules/work/server/views/solution-detail";
import { CreateSolutionDialog } from "./create-solution-dialog";
import { Button } from "@/components/ui/button";

/**
 * „Bearbeiten" als Kopf-Aktion der Detail-Shell — dieselbe Position, an der die
 * Epic-Seite ihren Löschen-Knopf trägt. Der Dialog braucht seinen `open`-State,
 * deshalb dieser schmale Client-Wrapper.
 */
export function SolutionEditButton({ model }: { model: SolutionDetailModel }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="mr-1.5 size-3.5" />
        Bearbeiten
      </Button>
      <CreateSolutionDialog
        open={open}
        onOpenChange={setOpen}
        solution={{
          id: model.id,
          name: model.name,
          description: model.description,
          valueStreamId: model.valueStreamId,
          artId: model.artId,
          horizon: model.horizon,
          investmentMode: model.investmentMode,
        }}
      />
    </>
  );
}
