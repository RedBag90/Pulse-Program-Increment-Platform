"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createArtAction } from "@/features/art/actions/art";
import { useCreateResult } from "@/features/create/use-create-result";
import { useEntityOptions, optionsEndpoint } from "@/features/create/use-entity-options";
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
import { CreateTimelineButton } from "@/features/structure/components/create-timeline-button";
import { CreateTimelineFromStandard } from "@/features/structure/components/create-timeline-from-standard";
import type { PiStandard } from "@/features/structure/components/pi-standards-manager";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface ValueStream {
  id: string;
  name: string;
}

interface TimelineOption {
  id: string;
  name: string;
  cadenceWeeks: number;
}

export interface CreateArtDialogProps {
  /** Controlled mode (global "+" menu). Omit to render a self-triggering button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Page-supplied value streams; when omitted they are fetched lazily. */
  valueStreams?: ValueStream[];
  /** Page-supplied PI standards — used by the inline "no Timeline yet" fallback
   *  so the user can spawn one without leaving the dialog. */
  standards?: PiStandard[];
}

const initialState: ActionState = {};

export function CreateArtDialog({
  open,
  onOpenChange,
  valueStreams,
  standards,
}: CreateArtDialogProps) {
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const [state, action, isPending] = useActionState(createArtAction, initialState);
  useCreateResult(state, () => setDialogOpen(false));

  const needFetch = valueStreams === undefined;
  const fetched = useEntityOptions<ValueStream>(
    needFetch ? optionsEndpoint("valueStream") : null,
    needFetch && dialogOpen,
  );
  const options = valueStreams ?? fetched.data;

  // Timelines are always fetched — the picker is required and we want it to
  // reflect any in-dialog Timeline creation. `refetchKey` is bumped each time
  // the parent revalidates after a timeline.* action.
  const [refetchKey, setRefetchKey] = useState(0);
  const timelines = useEntityOptions<TimelineOption>(
    optionsEndpoint("timeline"),
    dialogOpen,
    refetchKey,
  );
  const noTimelinesYet = !timelines.loading && timelines.data.length === 0;

  // Fetch PI Standards lazily — only relevant when the fallback panel is shown.
  const needStandards = standards === undefined;
  const fetchedStandards = useEntityOptions<PiStandard>(
    needStandards ? optionsEndpoint("piStandard") : null,
    needStandards && dialogOpen && noTimelinesYet,
  );
  const standardOptions = standards ?? fetchedStandards.data;

  return (
    <>
      {!isControlled && (
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          New ART
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Agile Release Train</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="art-vs">
                Value Stream <span className="text-destructive">*</span>
              </Label>
              <select
                id="art-vs"
                name="valueStreamId"
                required
                disabled={fetched.loading}
                className={SELECT_CLASS}
              >
                <option value="">{fetched.loading ? "Loading…" : "Select a value stream…"}</option>
                {options.map((vs) => (
                  <option key={vs.id} value={vs.id}>
                    {vs.name}
                  </option>
                ))}
              </select>
              {fetched.error && <p className="text-xs text-destructive">{fetched.error}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="art-name"
                name="name"
                required
                maxLength={100}
                placeholder="e.g. Platform ART"
              />
            </div>

            {noTimelinesYet ? (
              <div className="space-y-2 rounded-md border border-dashed p-3">
                <p className="text-sm font-medium">Noch keine Timeline vorhanden.</p>
                <p className="text-xs text-muted-foreground">
                  Lege erst eine Timeline an — dann wird sie hier automatisch wählbar.
                </p>
                <div
                  className="flex flex-wrap items-center gap-2"
                  onClick={() => setRefetchKey((k) => k + 1)}
                  onKeyDown={() => setRefetchKey((k) => k + 1)}
                  role="presentation"
                >
                  <CreateTimelineButton />
                  {standardOptions.length > 0 && (
                    <CreateTimelineFromStandard standards={standardOptions} />
                  )}
                </div>
                {/* Required hidden input so the form still submits the field if
                    the user somehow tries — Zod will then reject `""`. */}
                <input type="hidden" name="timelineId" value="" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="art-timeline">
                  Timeline <span className="text-destructive">*</span>
                </Label>
                <select
                  id="art-timeline"
                  name="timelineId"
                  required
                  disabled={timelines.loading}
                  className={SELECT_CLASS}
                >
                  <option value="">{timelines.loading ? "Lädt…" : "Timeline wählen…"}</option>
                  {timelines.data.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.cadenceWeeks} Wo)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Die ART tritt der gewählten Timeline bei und übernimmt deren PI-Serie.
                </p>
                {timelines.error && <p className="text-xs text-destructive">{timelines.error}</p>}
              </div>
            )}

            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || noTimelinesYet}>
                {isPending ? "Creating…" : "Create ART"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
