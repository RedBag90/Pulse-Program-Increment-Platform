"use client";

import { useActionState, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  createImpedimentAction,
  type ImpedimentActionState,
} from "@/features/impediment/actions/impediment";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Props {
  artId: string;
  onCreated?: () => void;
}

const initialState: ImpedimentActionState = {};

export function CreateImpedimentDialog({ artId, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: ImpedimentActionState, formData: FormData) => {
      const result = await createImpedimentAction(prev, formData);
      if (result.success) {
        toast.success("Impediment logged");
        setOpen(false);
        formRef.current?.reset();
        onCreated?.();
      }
      return result;
    },
    initialState,
  );

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <AlertTriangle className="size-4 mr-1.5" />
        Log Impediment
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Impediment</DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={formAction} className="space-y-4">
            <input type="hidden" name="artId" value={artId} />

            <div className="space-y-1.5">
              <Label>
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                name="title"
                required
                maxLength={300}
                placeholder="Short description of the impediment"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                name="description"
                rows={3}
                maxLength={5000}
                placeholder="Additional context, impact, or details"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Severity</Label>
              <select name="severity" defaultValue="medium" className={SELECT_CLASS}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Log Impediment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
