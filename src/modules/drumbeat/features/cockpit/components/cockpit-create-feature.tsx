"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateFeatureDialog } from "@/modules/work/features/feature/components/create-feature-dialog";

/**
 * „Feature anlegen"-Aktion fuer den Cockpit-PageHeader. Deutscher Ausloeser
 * (das Dialog-Primitive selbst rendert im Uncontrolled-Modus ein englisches
 * „New Feature") + der bestehende Create-Dialog im Controlled-Modus, mit dem
 * aktuellen ART vorbelegt.
 */
export function CockpitCreateFeature({ artId }: { artId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-4" />
        Feature anlegen
      </Button>
      <CreateFeatureDialog open={open} onOpenChange={setOpen} artId={artId} />
    </>
  );
}
