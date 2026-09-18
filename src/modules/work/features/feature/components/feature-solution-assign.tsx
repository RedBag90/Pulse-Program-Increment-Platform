"use client";

import { useState, useTransition } from "react";
import { setFeatureSolutionAction } from "@/modules/work/features/feature/actions/feature";

/**
 * **Die Solution eines Features setzen.**
 *
 * Gewählt wird sofort abgeschickt — wie beim Owner-, PI- und Statusfeld
 * nebenan; scheitert es, springt die Anzeige auf den alten Wert zurück, statt
 * einen Zustand zu zeigen, den der Server nie übernommen hat.
 *
 * Der Leerwert ist ausdrücklich abschickbar und heisst **nicht** „keine
 * Solution", sondern „keine **eigene**" — dann gilt wieder die des Epics. Bei
 * einem eigenständigen Feature gibt es keine, und genau das sagt die Zeile dann
 * auch.
 *
 * Ein einfaches `<select>` genügt hier: Solutions eines Wertstroms sind eine
 * kurze Liste (im Bestand 18 im ganzen Mandanten) — anders als die Personen,
 * für die `SearchSelect` gebaut wurde.
 */
export function FeatureSolutionAssign({
  featureId,
  artId,
  ownSolutionId,
  inheritedName,
  options,
  canEdit,
}: {
  featureId: string;
  artId: string;
  /** Eigene Zuordnung; `null` = geerbt oder keine. */
  ownSolutionId: string | null;
  /** Name der geerbten Solution, für die Beschriftung des Leerwerts. */
  inheritedName: string | null;
  options: ReadonlyArray<{ id: string; name: string }>;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(ownSolutionId ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    const name = options.find((s) => s.id === current)?.name ?? inheritedName;
    return <span className="text-sm">{name ?? "—"}</span>;
  }

  function choose(next: string) {
    const previous = current;
    setCurrent(next);
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", featureId);
      fd.set("artId", artId);
      fd.set("solutionId", next);
      const res = await setFeatureSolutionAction({}, fd);
      if (res.error) {
        setError(res.error);
        setCurrent(previous);
      }
    });
  }

  return (
    <div className="space-y-1">
      <select
        value={current}
        onChange={(e) => choose(e.target.value)}
        disabled={pending}
        aria-label="Solution"
        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <option value="">{inheritedName ? `— vom Epic: ${inheritedName} —` : "— keine —"}</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
