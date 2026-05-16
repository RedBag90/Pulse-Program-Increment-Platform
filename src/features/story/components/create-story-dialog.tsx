"use client";

import { useActionState, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createStoryAction } from "@/features/story/actions/story";
import type { ActionState } from "@/server/http/server-action";
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

interface Sprint {
  id: string;
  indexInPi: number;
  team: { name: string };
}

interface Props {
  featureId: string;
  artId: string;
  sprints: Sprint[];
}

const initialState: ActionState = {};

export function CreateStoryDialog({ featureId, artId, sprints }: Props) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createStoryAction, initialState);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1" />
        Add Story
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Story</DialogTitle>
          </DialogHeader>
          <form
            ref={formRef}
            action={async (fd) => {
              await action(fd);
              if (!state.fieldErrors && !state.error) {
                toast.success("Story created");
                setOpen(false);
                formRef.current?.reset();
              }
            }}
            className="space-y-4"
          >
            <input type="hidden" name="featureId" value={featureId} />
            <input type="hidden" name="artId" value={artId} />

            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input name="title" required placeholder="As a user, I want to…" />
              {state.fieldErrors?.title && (
                <p className="text-xs text-destructive">{state.fieldErrors.title[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea name="description" rows={2} placeholder="Optional context…" />
            </div>

            <div className="space-y-1.5">
              <Label>
                Acceptance Criteria
                <span className="text-muted-foreground font-normal ml-1">(one per line)</span>
              </Label>
              <Textarea name="acceptanceCriteria" rows={3} placeholder="Given… When… Then…" />
            </div>

            <div className="flex gap-4">
              <div className="flex-1 space-y-1.5">
                <Label>Story Points</Label>
                <Input name="storyPoints" type="number" min={1} max={100} placeholder="5" />
              </div>

              {sprints.length > 0 && (
                <div className="flex-1 space-y-1.5">
                  <Label>Sprint</Label>
                  <select
                    name="sprintId"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Unassigned</option>
                    {sprints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.team.name} — Sprint {s.indexInPi}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Add Story"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
