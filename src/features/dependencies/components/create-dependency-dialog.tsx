"use client";

import { useActionState, useRef, useState } from "react";
import { createDependencyAction } from "@/features/dependencies/actions/dependency";
import { useCreateResult } from "@/features/create/use-create-result";
import { InitiativeSearchField } from "@/features/create/initiative-search-field";
import type { ActionState } from "@/server/http/server-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const initialState: ActionState = {};

export interface CreateDependencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Global dependency dialog — picks both initiatives via typeahead search. */
export function CreateDependencyDialog({ open, onOpenChange }: CreateDependencyDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createDependencyAction, initialState);
  useCreateResult(state, () => {
    onOpenChange(false);
    formRef.current?.reset();
  });

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link Dependency</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={action} className="space-y-4">
          <InitiativeSearchField
            name="fromId"
            label="From initiative"
            value={fromId}
            onChange={setFromId}
          />

          <div className="space-y-1.5">
            <Label htmlFor="dep-type">Type</Label>
            <select id="dep-type" name="type" defaultValue="blocks" className={SELECT_CLASS}>
              <option value="blocks">blocks</option>
              <option value="depends_on">depends on</option>
              <option value="relates_to">relates to</option>
            </select>
          </div>

          <InitiativeSearchField
            name="toId"
            label="To initiative"
            value={toId}
            onChange={setToId}
          />

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !fromId || !toId}>
              {pending ? "Linking…" : "Link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
