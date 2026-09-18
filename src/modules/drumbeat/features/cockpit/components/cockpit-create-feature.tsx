"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateFeatureDialog } from "@/modules/work/features/feature/components/create-feature-dialog";

/**
 * „Feature anlegen"-Aktion für den Cockpit-PageHeader: eigener Auslöser plus
 * der gemeinsame Anlege-Dialog im Controlled-Modus, mit dem aktuellen ART
 * vorbelegt.
 *
 * Der Wertstrom des ARTs geht mit. Ohne ihn zeigte die Epic-Liste **jedes**
 * Epic des Mandanten, auch aus fremden Wertströmen — und der Griff daneben
 * fiel erst am Service auf, dort dann als Fehler am *ART*.
 */
export function CockpitCreateFeature({
  artId,
  artValueStreamId,
}: {
  artId: string;
  artValueStreamId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-4" />
        Feature anlegen
      </Button>
      <CreateFeatureDialog
        open={open}
        onOpenChange={setOpen}
        artId={artId}
        artValueStreamId={artValueStreamId}
      />
    </>
  );
}
