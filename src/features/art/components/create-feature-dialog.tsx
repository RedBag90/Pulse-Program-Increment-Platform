"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createFeatureAction } from "@/features/art/actions/feature";
import { useCreateResult } from "@/features/create/use-create-result";
import { useEntityOptions, optionsEndpoint } from "@/features/create/use-entity-options";
import type { CreateContext } from "@/features/create/create-context";
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

const FIBONACCI = [1, 2, 3, 5, 8, 13, 20] as const;

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Art {
  id: string;
  name: string;
}
interface Epic {
  id: string;
  title: string;
}

export interface CreateFeatureDialogProps {
  /** Controlled mode (global "+" menu). Omit to render a self-triggering button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Page-supplied parent ART; when omitted an ART select is shown. */
  artId?: string;
  /** Page-supplied parent epics; when omitted they are fetched lazily. */
  epics?: Epic[];
  /** Route context used to pre-select ART / Epic in the global menu. */
  context?: CreateContext;
}

const initialState: ActionState = {};

export function CreateFeatureDialog({
  open,
  onOpenChange,
  artId,
  epics,
  context,
}: CreateFeatureDialogProps) {
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const [state, action, isPending] = useActionState(createFeatureAction, initialState);
  useCreateResult(state, () => setDialogOpen(false));

  const needArt = artId === undefined;
  const arts = useEntityOptions<Art>(
    needArt ? optionsEndpoint("art") : null,
    needArt && dialogOpen,
  );

  const needEpics = epics === undefined;
  const fetchedEpics = useEntityOptions<Epic>(
    needEpics ? optionsEndpoint("epic") : null,
    needEpics && dialogOpen,
  );
  const epicOptions = epics ?? fetchedEpics.data;

  return (
    <>
      {!isControlled && (
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          New Feature
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Feature</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            {artId !== undefined ? (
              <input type="hidden" name="artId" value={artId} />
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="f-art">
                  ART <span className="text-destructive">*</span>
                </Label>
                <select
                  id="f-art"
                  name="artId"
                  required
                  defaultValue={context?.artId ?? ""}
                  disabled={arts.loading}
                  className={SELECT_CLASS}
                >
                  <option value="">{arts.loading ? "Loading…" : "Select an ART…"}</option>
                  {arts.data.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.name}
                    </option>
                  ))}
                </select>
                {arts.error && <p className="text-xs text-destructive">{arts.error}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="f-parent">
                Parent Epic <span className="text-destructive">*</span>
              </Label>
              <select
                id="f-parent"
                name="parentId"
                required
                defaultValue={context?.epicId ?? ""}
                disabled={fetchedEpics.loading}
                className={SELECT_CLASS}
              >
                <option value="">
                  {fetchedEpics.loading ? "Loading…" : "Select a parent epic…"}
                </option>
                {epicOptions.map((epic) => (
                  <option key={epic.id} value={epic.id}>
                    {epic.title}
                  </option>
                ))}
              </select>
              {fetchedEpics.error && (
                <p className="text-xs text-destructive">{fetchedEpics.error}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="f-title"
                name="title"
                required
                maxLength={200}
                placeholder="e.g. User can reset password via email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-desc">Description</Label>
              <Textarea id="f-desc" name="description" rows={3} />
            </div>

            <fieldset className="border border-border rounded-md p-4 space-y-3">
              <legend className="text-sm font-medium px-1">WSJF Scoring</legend>
              {(
                [
                  ["wsjfBusinessValue", "Business Value"],
                  ["wsjfTimeCriticality", "Time Criticality"],
                  ["wsjfRiskReduction", "Risk Reduction / Opportunity Enablement"],
                  ["wsjfJobSize", "Job Size"],
                ] as const
              ).map(([name, label]) => (
                <div key={name} className="space-y-1">
                  <Label htmlFor={`f-${name}`}>
                    {label} <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id={`f-${name}`}
                    name={name}
                    required
                    defaultValue=""
                    className={SELECT_CLASS}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {FIBONACCI.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="f-ac">Acceptance Criteria</Label>
              <Textarea
                id="f-ac"
                name="acceptanceCriteria"
                rows={4}
                placeholder={"Given…\nWhen…\nThen…"}
              />
              <p className="text-xs text-muted-foreground">One criterion per line</p>
            </div>

            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create Feature"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
