"use client";

import { useActionState, startTransition } from "react";
import { UserPicker } from "@/components/detail/user-picker";
import { userLabel } from "@/components/detail/initiative-labels";
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

  function save(next: string) {
    const fd = new FormData();
    fd.set("id", solutionId);
    fd.set("productManagerId", next);
    startTransition(() => submit(fd));
  }

  return (
    <section className="rounded-lg bg-card p-4 shadow-card">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Produkt-Manager
      </h2>
      {canManage ? (
        <div className="mt-2 max-w-xs">
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
            emptyLabel="Nicht zugewiesen"
            disabled={busy}
          />
        </div>
      ) : (
        <p className="mt-2 text-sm">
          {productManagerId ? (
            userLabel(productManagerId, userLabels)
          ) : (
            <span className="inline-flex items-center rounded-full bg-warning-surface px-2 py-0.5 text-meta text-warning">
              Nicht zugewiesen
            </span>
          )}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Verantwortlich für dieses Produkt: darf es bearbeiten und zeichnet bei den
        Reifegrad-Freigaben seiner Epics mit — am Business Case bei allen, am Start der Umsetzung
        bei ART-Epics.
      </p>
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </section>
  );
}
