"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  createTransformationActionAction,
  updateTransformationActionAction,
  deleteTransformationActionAction,
} from "@/features/transformation/actions/target-action";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface ActionView {
  id: string;
  title: string;
  status: string;
  ownerId: string | null;
  dueDate: string | null;
}

export interface UserOption {
  id: string;
  label: string;
}

interface Props {
  actions: ActionView[];
  userOptions: UserOption[];
  canManage: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  open: "Offen",
  in_progress: "In Arbeit",
  done: "Erledigt",
};

const SELECT =
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ownerName(ownerId: string | null, users: UserOption[]): string | null {
  if (!ownerId) return null;
  return users.find((u) => u.id === ownerId)?.label ?? ownerId;
}

function ActionRow({
  action,
  userOptions,
  canManage,
  busy,
  onStatus,
  onOwner,
  onDelete,
}: {
  action: ActionView;
  userOptions: UserOption[];
  canManage: boolean;
  busy: boolean;
  onStatus: (id: string, status: string) => void;
  onOwner: (id: string, ownerId: string) => void;
  onDelete: (id: string) => void;
}) {
  const done = action.status === "done";
  const owner = ownerName(action.ownerId, userOptions);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border p-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${done ? "text-muted-foreground line-through" : ""}`}>
          {action.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {owner ? `Owner: ${owner}` : "Kein Owner"}
          {action.dueDate ? ` · bis ${action.dueDate}` : ""}
        </p>
      </div>
      {canManage ? (
        <div className="flex items-center gap-2">
          <select
            className={SELECT}
            value={action.ownerId ?? ""}
            disabled={busy}
            onChange={(e) => onOwner(action.id, e.target.value)}
            aria-label="Owner"
          >
            <option value="">— Owner —</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          <select
            className={SELECT}
            value={action.status}
            disabled={busy}
            onChange={(e) => onStatus(action.id, e.target.value)}
            aria-label="Status"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={busy}
            aria-label="Maßnahme löschen"
            onClick={() => onDelete(action.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ) : (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {STATUS_LABELS[action.status] ?? action.status}
        </span>
      )}
    </li>
  );
}

/** The transformation backlog — track the actions that move Ist toward Soll. */
export function TransformationActionsManager({ actions, userOptions, canManage }: Props) {
  const [createState, createAction, creating] = useActionState(
    createTransformationActionAction,
    {},
  );
  const [, updateAction, updating] = useActionState(updateTransformationActionAction, {});
  const [, deleteAction, deleting] = useActionState(deleteTransformationActionAction, {});
  const busy = creating || updating || deleting;

  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");

  function add() {
    const fd = new FormData();
    fd.set("title", title);
    if (owner) fd.set("ownerId", owner);
    if (due) fd.set("dueDate", due);
    createAction(fd);
    setTitle("");
    setOwner("");
    setDue("");
  }

  function setStatus(id: string, status: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", status);
    updateAction(fd);
  }

  function assignOwner(id: string, ownerId: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("ownerId", ownerId); // "" clears the owner
    updateAction(fd);
  }

  function remove(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    deleteAction(fd);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-sm font-medium">Maßnahmen-Backlog</h2>
        <p className="text-xs text-muted-foreground">
          Die verfolgten Schritte, die die Organisation zum Zielzustand bewegen.
        </p>
      </div>

      {actions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Maßnahmen.</p>
      ) : (
        <ul className="space-y-2">
          {actions.map((a) => (
            <ActionRow
              key={a.id}
              action={a}
              userOptions={userOptions}
              canManage={canManage}
              busy={busy}
              onStatus={setStatus}
              onOwner={assignOwner}
              onDelete={remove}
            />
          ))}
        </ul>
      )}

      {canManage && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed p-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="ta-title">Neue Maßnahme</Label>
            <Input
              id="ta-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Zweites ART starten"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ta-owner">Owner (optional)</Label>
            <select
              id="ta-owner"
              className={`${SELECT} h-9`}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">— niemand —</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ta-due">Termin (optional)</Label>
            <Input
              id="ta-due"
              type="date"
              className="w-40"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
          <Button type="button" disabled={busy || title.trim() === ""} onClick={add}>
            {creating ? "Speichert…" : "Hinzufügen"}
          </Button>
        </div>
      )}

      {createState.error && (
        <p role="alert" className="text-sm text-destructive">
          {createState.error}
        </p>
      )}
    </section>
  );
}
