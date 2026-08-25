"use client";

import { useActionState, useState, startTransition } from "react";
import { Star, Link2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { setEpicSolutionsAction } from "@/modules/work/features/portfolio/actions/solution";
import { HorizonBadge } from "@/modules/work/features/portfolio/components/horizon-badge";
import { Button } from "@/components/ui/button";

export interface EpicSolutionOption {
  id: string;
  name: string;
  horizon: string;
}

/**
 * Solutions-Abschnitt am Epic: Mehrfach-Zuordnung (n:m) auf die Solutions des
 * Value Streams + Primär-Markierung (★, liefert den Horizont). Ohne Zuordnung →
 * Horizont „Ohne".
 */
export function EpicSolutionsSection({
  epicId,
  solutions,
  linkedIds,
  primaryId,
  canEdit,
}: {
  epicId: string;
  solutions: EpicSolutionOption[];
  linkedIds: string[];
  primaryId: string | null;
  canEdit: boolean;
}) {
  const [state, submit, pending] = useActionState(setEpicSolutionsAction, {});
  const [selected, setSelected] = useState<Set<string>>(new Set(linkedIds));
  const [primary, setPrimary] = useState<string | null>(primaryId);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (primary === id) setPrimary(null);
      } else {
        next.add(id);
        if (primary == null) setPrimary(id);
      }
      return next;
    });
  }

  function save() {
    const fd = new FormData();
    fd.set("epicId", epicId);
    for (const id of selected) fd.append("solutionIds", id);
    const eff = primary && selected.has(primary) ? primary : (selected.values().next().value ?? "");
    if (eff) fd.set("primarySolutionId", eff);
    startTransition(() => submit(fd));
  }

  if (solutions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card/50 px-3 py-3 text-sm text-muted-foreground">
        Keine Solutions im Value Stream dieses Epics.{" "}
        {canEdit && (
          <Link href="/portfolio/solutions?create=solution" className="text-primary hover:underline">
            Solution anlegen
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Ein ★ markiert die Primär-Solution (liefert den Horizont).
      </p>
      <ul className="divide-y divide-border rounded-lg border">
        {solutions.map((s) => {
          const isLinked = selected.has(s.id);
          const isPrimary = primary === s.id;
          return (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <label className="flex flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  checked={isLinked}
                  disabled={!canEdit}
                  onChange={() => toggle(s.id)}
                  className="size-4 accent-primary"
                />
                <Link2 className="size-3.5 text-muted-foreground/60" />
                <span className="font-medium">{s.name}</span>
                <HorizonBadge horizon={s.horizon} />
              </label>
              <button
                type="button"
                aria-label="Als primär setzen"
                disabled={!canEdit || !isLinked}
                onClick={() => setPrimary(s.id)}
                className={isPrimary ? "text-amber-500" : "text-muted-foreground/40 hover:text-amber-500 disabled:opacity-40"}
              >
                <Star className={`size-4 ${isPrimary ? "fill-amber-400" : ""}`} />
              </button>
            </li>
          );
        })}
      </ul>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-700">Zuordnung gespeichert.</p>}
      {canEdit && (
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Speichern…" : "Zuordnung speichern"}
        </Button>
      )}
    </div>
  );
}
