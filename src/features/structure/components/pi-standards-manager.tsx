"use client";

import { useActionState, useState, startTransition } from "react";
import { Settings2, Trash2 } from "lucide-react";
import {
  createPiStandardAction,
  deletePiStandardAction,
} from "@/features/structure/actions/pi-standard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PiStandard {
  id: string;
  name: string;
  anchorMonth: number;
  anchorDay: number;
  cadenceWeeks: number;
  piCount: number;
}

/**
 * Standards manager — create and delete named PI calendars (anchor day/month +
 * cadence + count). Opened from the Structure Timeline header, gated by
 * `pi_standard.manage`. The captured "Event Management Travel ART" values
 * (Jan 14, 8 weeks, 6 PIs) prefill the create form.
 */
export function PiStandardsManager({ standards }: { standards: PiStandard[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Settings2 className="mr-1.5 size-4" />
        PI-Standards
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>PI-Standards</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {standards.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Standards angelegt.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {standards.map((s) => (
                  <StandardRow key={s.id} standard={s} />
                ))}
              </ul>
            )}
          </div>

          <CreateStandardForm />
        </DialogContent>
      </Dialog>
    </>
  );
}

function StandardRow({ standard }: { standard: PiStandard }) {
  const [state, run, pending] = useActionState(deletePiStandardAction, {});

  function remove() {
    const fd = new FormData();
    fd.set("id", standard.id);
    startTransition(() => run(fd));
  }

  return (
    <li className="flex items-center gap-2 p-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{standard.name}</p>
        <p className="text-xs text-muted-foreground">
          Anker {standard.anchorDay}.{standard.anchorMonth}. · {standard.cadenceWeeks} Wo ·{" "}
          {standard.piCount} PIs
        </p>
        {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={remove}
        aria-label={`Standard „${standard.name}" löschen`}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </li>
  );
}

const NUM_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function CreateStandardForm() {
  const [state, action, pending] = useActionState(createPiStandardAction, {});

  return (
    <form action={action} className="space-y-3 border-t pt-3">
      <h3 className="text-sm font-medium">Neuen Standard anlegen</h3>
      <div className="space-y-1.5">
        <Label htmlFor="std-name">Name</Label>
        <Input
          id="std-name"
          name="name"
          required
          maxLength={100}
          placeholder="z. B. Standard 8 Wochen"
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="std-month">Monat</Label>
          <input
            id="std-month"
            name="anchorMonth"
            type="number"
            min={1}
            max={12}
            defaultValue={1}
            required
            className={NUM_CLASS}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="std-day">Tag</Label>
          <input
            id="std-day"
            name="anchorDay"
            type="number"
            min={1}
            max={31}
            defaultValue={14}
            required
            className={NUM_CLASS}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="std-cadence">Wochen</Label>
          <input
            id="std-cadence"
            name="cadenceWeeks"
            type="number"
            min={1}
            max={26}
            defaultValue={8}
            required
            className={NUM_CLASS}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="std-count">PIs</Label>
          <input
            id="std-count"
            name="piCount"
            type="number"
            min={1}
            max={12}
            defaultValue={6}
            required
            className={NUM_CLASS}
          />
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Speichern…" : "Standard anlegen"}
      </Button>
    </form>
  );
}
