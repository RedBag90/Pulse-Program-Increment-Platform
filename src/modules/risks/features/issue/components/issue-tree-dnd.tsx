"use client";

import { useActionState, useRef, useState, startTransition, type DragEvent } from "react";
import type { ActionState } from "@/server/http/server-action";
import { reparentIssueAction } from "@/modules/risks/features/issue/actions/issue";

/**
 * Native HTML5 drag-and-drop for the issue head-hierarchy. Drag an issue onto
 * another issue ⇒ it becomes that issue's child (bundle under a head). Drag onto
 * the top-level zone ⇒ it becomes a root again. Dispatches `reparentIssueAction`;
 * cycle-guarded via `isDescendant` (server re-checks).
 */

export type DropTarget = { kind: "issue"; id: string } | { kind: "root" };

const initial: ActionState = {};

function targetKey(t: DropTarget): string {
  return t.kind === "root" ? "root" : `issue:${t.id}`;
}

export interface IssueTreeDnd {
  dragging: boolean;
  consumeDidDrag: () => boolean;
  dragProps: (id: string) => {
    draggable: true;
    onDragStart: (e: DragEvent) => void;
    onDragEnd: () => void;
  };
  dropProps: (t: DropTarget) => {
    isOver: boolean;
    onDragOver: (e: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: DragEvent) => void;
  };
}

export function useIssueTreeDnd(opts: {
  /** True if `maybeDescendantId` is inside `ancestorId`'s subtree. */
  isDescendant: (ancestorId: string, maybeDescendantId: string) => boolean;
}): IssueTreeDnd {
  const dragId = useRef<string | null>(null);
  const didDrag = useRef(false);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [, reparent] = useActionState(reparentIssueAction, initial);

  const isValid = (t: DropTarget): boolean => {
    const d = dragId.current;
    if (!d) return false;
    if (t.kind === "root") return true;
    if (t.id === d) return false; // self
    if (opts.isDescendant(d, t.id)) return false; // would cycle
    return true;
  };

  const dispatch = (t: DropTarget) => {
    const d = dragId.current;
    if (!d || !isValid(t)) return;
    const fd = new FormData();
    fd.append("id", d);
    fd.append("newParentId", t.kind === "issue" ? t.id : "");
    startTransition(() => reparent(fd));
  };

  const endDrag = () => {
    dragId.current = null;
    setOverKey(null);
    setDragging(false);
    setTimeout(() => {
      didDrag.current = false;
    }, 0);
  };

  return {
    dragging,
    consumeDidDrag: () => {
      const v = didDrag.current;
      didDrag.current = false;
      return v;
    },
    dragProps: (id) => ({
      draggable: true,
      onDragStart: (e) => {
        dragId.current = id;
        didDrag.current = true;
        setDragging(true);
        e.dataTransfer.effectAllowed = "move";
      },
      onDragEnd: endDrag,
    }),
    dropProps: (t) => ({
      isOver: overKey === targetKey(t) && isValid(t),
      onDragOver: (e) => {
        if (!isValid(t)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const key = targetKey(t);
        if (overKey !== key) setOverKey(key);
      },
      onDragLeave: () => {
        if (overKey === targetKey(t)) setOverKey(null);
      },
      onDrop: (e) => {
        e.preventDefault();
        dispatch(t);
        endDrag();
      },
    }),
  };
}

/** Dashed "make top-level" drop zone shown only while dragging. */
export function dropZoneClass(isOver: boolean): string {
  return `rounded-lg border border-dashed px-3 py-2 text-xs transition-colors ${
    isOver ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground"
  }`;
}
