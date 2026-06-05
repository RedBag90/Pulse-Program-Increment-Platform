"use client";

import { useActionState, useState, useMemo, useEffect } from "react";
import { Plus, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkGoalEpicAction } from "@/features/transformation/actions/target-goal";
import type { EpicOption, LinkedEpicView } from "@/server/views/transformation-goals";

interface Props {
  goalId: string;
  /** All available epics in the tenant (unfiltered). */
  epicOptions: EpicOption[];
  /** Already-linked epics for this goal — excluded from the picker list. */
  linkedEpics: LinkedEpicView[];
}

/**
 * Searchable typeahead for linking an Epic to a strategic goal. Replaces the
 * single-select `<option>` dropdown that didn't scale past ~5 candidates with
 * a popover-driven filter: type a few characters of the Epic title, click an
 * option to link via `linkGoalEpicAction`.
 *
 * Already-linked epics are filtered out so a user can't double-link the same
 * pair (the action's unique constraint would reject it anyway). The popover
 * closes on a successful link so the user can keep linking by re-opening it,
 * or pick another goal to manage.
 */
export function EpicLinker({ goalId, epicOptions, linkedEpics }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [state, link, linking] = useActionState(linkGoalEpicAction, {});

  const linkedIds = useMemo(() => new Set(linkedEpics.map((e) => e.id)), [linkedEpics]);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return epicOptions
      .filter((e) => !linkedIds.has(e.id))
      .filter((e) => (q === "" ? true : e.title.toLowerCase().includes(q)))
      .slice(0, 20);
  }, [epicOptions, linkedIds, query]);

  // Close + clear the query after a successful link so the row count visually
  // updates and the user can re-open to add another.
  useEffect(() => {
    if (state.success) {
      setOpen(false);
      setQuery("");
    }
  }, [state.success]);

  function selectEpic(epicId: string) {
    const fd = new FormData();
    fd.set("goalId", goalId);
    fd.set("epicId", epicId);
    link(fd);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" size="sm" variant="outline" className="h-8">
            <Plus className="size-3.5" /> Epic verknüpfen
          </Button>
        }
      />
      <PopoverContent align="start" className="w-80">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Epic suchen…"
              className="h-8 pl-7"
            />
          </div>
          {candidates.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {epicOptions.length === 0
                ? "Keine Epics vorhanden."
                : query.trim() === ""
                  ? "Alle vorhandenen Epics sind bereits verknüpft."
                  : "Kein Epic gefunden."}
            </p>
          ) : (
            <ul className="max-h-64 space-y-0.5 overflow-y-auto">
              {candidates.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => selectEpic(e.id)}
                    disabled={linking}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-50"
                  >
                    <span className="truncate">{e.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {state.error && (
            <p role="alert" className="text-xs text-destructive">
              {state.error}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
