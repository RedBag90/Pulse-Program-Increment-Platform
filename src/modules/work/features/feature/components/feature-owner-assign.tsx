"use client";

import { useMemo, useState, useTransition } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { userLabel } from "@/components/detail/initiative-labels";
import { assignFeatureOwnerAction } from "@/modules/work/features/feature/actions/feature";

/**
 * Owner eines Features zuweisen oder entfernen.
 *
 * Die Auswahl ist eine **Suche**, kein Aufklappmenü: die Kandidatenliste ist
 * jede Person des Mandanten mit einer Rolle, das sind in echten Mandanten
 * schnell dreistellig viele. Ein natives `<select>` zwingt dann zum Scrollen
 * durch alles.
 *
 * Gewählt wird sofort abgeschickt — wie beim PI- und beim Statusfeld nebenan;
 * scheitert es, springt die Anzeige auf den alten Owner zurück, statt einen
 * Zustand zu zeigen, den der Server nie übernommen hat.
 *
 * Der Leerwert („— kein Owner —") ist ausdrücklich abschickbar. Das ist der
 * bewusste Unterschied zu `EpicOwnerAssign`, das mit `if (!sel) return` abbricht
 * und einen einmal gesetzten Owner damit nicht mehr entfernen lässt.
 */

interface Props {
  featureId: string;
  artId: string;
  ownerId: string | null;
  canAssignOwner: boolean;
  approvers: ReadonlyArray<{ userId: string; roles: string[] }>;
  userLabels: Record<string, string>;
}

function initials(name: string): string {
  const head = name.split("@")[0] ?? name;
  return head.slice(0, 2).toUpperCase();
}

export function FeatureOwnerAssign({
  featureId,
  artId,
  ownerId,
  canAssignOwner,
  approvers,
  userLabels,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(ownerId ?? "");
  const [error, setError] = useState<string | null>(null);

  const options = useMemo<SearchSelectOption[]>(
    () =>
      approvers.map((u) => ({
        value: u.userId,
        label: userLabel(u.userId, userLabels),
        ...(u.roles.length > 0 ? { hint: u.roles.join(", ") } : {}),
      })),
    [approvers, userLabels],
  );

  const ownerName = current ? userLabel(current, userLabels) : null;

  function assign(next: string) {
    const previous = current;
    setCurrent(next);
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", featureId);
      fd.set("artId", artId);
      // Leerer String = „kein Owner"; der Service übersetzt ihn nach `null`.
      fd.set("ownerId", next);
      const res = await assignFeatureOwnerAction({}, fd);
      if (res.error) {
        setError(res.error);
        setCurrent(previous);
      }
    });
  }

  return (
    <div className="space-y-2">
      {ownerName ? (
        <span className="flex items-center gap-2 text-sm">
          <Avatar size="sm">
            <AvatarFallback>{initials(ownerName)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{ownerName}</span>
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Nicht zugewiesen</span>
      )}

      {canAssignOwner && (
        <>
          <SearchSelect
            value={current}
            onChange={assign}
            options={options}
            emptyLabel="— kein Owner —"
            placeholder="Owner wählen …"
            searchPlaceholder="Person suchen …"
            ariaLabel="Feature-Owner"
            disabled={pending}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
}
