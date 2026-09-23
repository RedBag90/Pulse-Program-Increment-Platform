"use client";

import { useActionState, useState, startTransition } from "react";
import { Check, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserPicker } from "@/components/detail/user-picker";
import { userLabel, initials } from "@/components/detail/initiative-labels";
import { useTransientFlag } from "@/lib/hooks/use-transient-flag";
import { updateSolutionAction } from "@/modules/core/org/features/solution/actions/solution";

/**
 * Der namentlich Verantwortliche für ein Produkt.
 *
 * Freies Personenfeld ohne Rollenbindung: Produktverantwortung fällt nicht mit
 * einer SAFe-Rolle zusammen, und niemand soll eine Rolle bekommen müssen, nur
 * um benannt werden zu können.
 *
 * Fehlt die Benennung, steht hier derselbe bernsteinfarbene Hinweis wie bei
 * einem ART ohne RTE — sichtbar, ohne zu blockieren.
 *
 * **Die Bedienung ist die der Rollenverteilung** (`structure/rollen`,
 * `role-slot.tsx`): der Name ist ein Knopf, ein Klick öffnet den Picker, die
 * Auswahl **speichert sofort**, und ein Haken bestätigt kurz. Vorher stand der
 * Picker hier dauerhaft offen und ein gelungener Speichervorgang wurde mit
 * nichts quittiert — dieselbe Form, die `epic-owner-assign.tsx` für den Epic
 * Owner bereits abgelegt hat. Dies war ihr letzter Vertreter.
 *
 * Action, Feld, Personenliste und Leerwert waren dabei schon immer dieselben
 * wie am Solution-Platz der Rollenverteilung; verschieden war allein die Geste.
 */
export function SolutionProductManager({
  solutionId,
  productManagerId,
  users,
  userLabels,
  canManage,
}: {
  solutionId: string;
  productManagerId: string | null;
  users: { userId: string; roles: string[] }[];
  userLabels: Record<string, string>;
  canManage: boolean;
}) {
  const [state, submit, busy] = useActionState(updateSolutionAction, {});
  const [open, setOpen] = useState(false);
  const saved = useTransientFlag(state?.success === true);
  const name = productManagerId ? userLabel(productManagerId, userLabels) : null;

  function save(next: string) {
    const fd = new FormData();
    fd.set("id", solutionId);
    fd.set("productManagerId", next);
    startTransition(() => submit(fd));
    setOpen(false);
  }

  const person = (
    <span className="flex min-w-0 items-center gap-2">
      {name ? (
        <>
          <Avatar size="sm">
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="truncate text-sm">{name}</span>
        </>
      ) : (
        <>
          <span className="grid size-6 shrink-0 place-items-center rounded-full border border-dashed text-muted-foreground">
            <Plus className="size-3" aria-hidden />
          </span>
          <span className="truncate text-sm text-muted-foreground">Benennen</span>
        </>
      )}
      {saved && <Check className="size-3.5 shrink-0 text-success" aria-hidden />}
    </span>
  );

  return (
    <section className="rounded-lg bg-card p-4 shadow-card">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Produkt-Manager
      </h2>

      {!canManage ? (
        /* Nur-Lese: die Bernstein-Pille bleibt. Sie sagt „hier fehlt jemand",
           ohne zu blockieren — und wer nicht benennen darf, braucht keinen
           Knopf, der nichts tut. */
        <p className="mt-2 text-sm">
          {name ?? (
            <span className="inline-flex items-center rounded-full bg-warning-surface px-2 py-0.5 text-meta text-warning">
              Nicht zugewiesen
            </span>
          )}
        </p>
      ) : open ? (
        <div className="mt-2 max-w-xs space-y-1">
          <UserPicker
            value={productManagerId ?? ""}
            onChange={save}
            options={users.map((u) => ({
              value: u.userId,
              label: userLabel(u.userId, userLabels),
              ...(u.roles.length ? { hint: u.roles.join(", ") } : {}),
            }))}
            ariaLabel="Produkt-Manager"
            placeholder="Nicht zugewiesen"
            emptyLabel="— Niemand —"
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-meta text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Abbrechen
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={busy}
          // Ein `aria-label` **ersetzt** den Inhalt des Buttons, statt ihn zu
          // ergänzen — der Name gehört also hinein.
          aria-label={name ? `Produkt-Manager: ${name}. Ändern` : "Produkt-Manager benennen"}
          className="-mx-1.5 mt-2 w-full max-w-xs rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {person}
        </button>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        Verantwortlich für dieses Produkt: darf es bearbeiten und zeichnet bei den
        Reifegrad-Freigaben seiner Epics mit — am Business Case bei allen, am Start der Umsetzung
        bei ART-Epics.
      </p>

      <span role="status" className="sr-only">
        {saved ? "Produkt-Manager gespeichert" : ""}
      </span>
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </section>
  );
}
