"use client";

import { useActionState, startTransition, useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { UserPicker } from "@/components/detail/user-picker";
import { initials } from "@/components/detail/initiative-labels";
import { useUrlState } from "@/lib/hooks/use-url-state";
import type {
  DirectoryEntry,
  DirectoryGroup,
  ValueStreamDirectory,
} from "@/modules/core/org/domain/role-directory";
import {
  unfilledCount,
  targetKey,
  filterDirectory,
  directoryStats,
} from "@/modules/core/org/domain/role-directory";
import { RoleDirectoryFilterBar } from "@/modules/core/org/features/structure/components/role-directory-filter-bar";
import { updateValueStreamAction } from "@/modules/core/org/features/value-stream/actions/value-stream";
import { updateArtAction } from "@/modules/core/org/features/art/actions/art";
import { updateSolutionAction } from "@/modules/core/org/features/solution/actions/solution";

/** Die Auswahloptionen — dieselbe Form wie in jedem Personen-Picker des Hauses. */
export interface DirectoryUserOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Welche Plätze der Betrachter anfassen darf, als Menge von `target.kind:id`.
 *
 * Die Fläche bekommt sie **fertig** von der Seite: die Rechte hängen am
 * Principal und am einzelnen Objekt, nicht an der Struktur. Und sie werden je
 * Objekt entschieden — wer nur einen Wertstrom pflegen darf, soll nur dort
 * Plätze anfassen können.
 */
export type EditableTargets = ReadonlySet<string>;

/**
 * **Die Rollenverteilung als Bild.**
 *
 * Eine Karte je Wertstrom, darin die Zuständigkeiten als **Zeilen mit festem
 * Raster**: links die Rolle samt Anliegen, in der Mitte die Person, rechts die
 * Tore. Das Raster ist in jeder Karte dasselbe, und die Rollen stehen überall in
 * derselben Reihenfolge — so lernt das Auge die Position und vergleicht
 * Wertströme untereinander, statt jede Karte neu zu lesen.
 *
 * Unbesetzte Zeilen bleiben **stehen**: „an niemanden" ist eine Auskunft, und
 * wer sie nicht bekommt, sucht weiter. Der gestrichelte Rahmen ist die eine
 * Rahmenform, die über den Inhalt spricht (ADR-0021).
 */
export function RoleDirectoryView({
  streams,
  users,
  editable,
}: {
  streams: ValueStreamDirectory[];
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  const { params, push } = useUrlState();
  const query = params.get("q") ?? "";
  const onlyUnfilled = params.get("offen") === "1";

  const stats = directoryStats(streams);
  const shown = filterDirectory(streams, { query, onlyUnfilled });

  if (streams.length === 0) {
    return (
      <EmptyState
        title="Noch kein Wertstrom"
        body="Ohne Struktur gibt es niemanden, den man fragen könnte. Wertströme, ARTs und Solutions entstehen unter „Organisation“."
      />
    );
  }

  return (
    <div className="space-y-3">
      <RoleDirectoryFilterBar
        query={query}
        onQueryChange={(next) => push({ q: next || null })}
        onlyUnfilled={onlyUnfilled}
        onOnlyUnfilledChange={(next) => push({ offen: next ? "1" : null })}
        unfilledCount={stats.unfilled}
      />

      {shown.length === 0 ? (
        <EmptyState
          title="Nichts gefunden"
          body={
            onlyUnfilled && query
              ? "Zu dieser Suche gibt es keinen offenen Platz. Nimm den Filter heraus oder suche anders."
              : onlyUnfilled
                ? "Alle Zuständigkeiten sind benannt."
                : "Kein Platz passt zu dieser Suche — sie trifft Person, Rolle und Anliegen."
          }
        />
      ) : (
        shown.map((vs) => <StreamCard key={vs.id} vs={vs} users={users} editable={editable} />)
      )}
    </div>
  );
}

function StreamCard({
  vs,
  users,
  editable,
}: {
  vs: ValueStreamDirectory;
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  const offen = unfilledCount(vs);
  return (
    <section className="rounded-lg bg-card p-4 shadow-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 pb-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight">{vs.name}</h2>
        {offen > 0 && (
          <span className="rounded-full bg-warning-surface px-2 py-0.5 text-meta text-warning">
            {offen} offen
          </span>
        )}
      </header>

      <div className="divide-y">
        {vs.entries.map((e) => (
          <Row key={e.key} entry={e} users={users} editable={editable} />
        ))}
      </div>

      {vs.groups.map((g) => (
        <Group key={`${g.kind}-${g.id}`} group={g} users={users} editable={editable} />
      ))}
    </section>
  );
}

const GROUP_LABEL: Record<DirectoryGroup["kind"], string> = {
  vs: "Wertstrom",
  art: "ART",
  solution: "Solution",
};

/**
 * ART und Solution hängen an einer Stammlinie unter dem Wertstrom — aus einem
 * Pseudoelement gezogen, nicht aus SVG; dasselbe Idiom wie in der
 * Strategie-Ausrichtung. Ihre Zeilen laufen im selben Raster weiter, damit der
 * Rhythmus der Karte nicht bricht.
 */
function Group({
  group,
  users,
  editable,
}: {
  group: DirectoryGroup;
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  return (
    <div className="relative mt-3 pl-4 before:absolute before:bottom-1 before:left-0 before:top-1 before:w-px before:bg-border before:content-['']">
      <p className="pb-1 text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {GROUP_LABEL[group.kind]} <span className="text-foreground">{group.name}</span>
      </p>
      <div className="divide-y">
        {group.entries.map((e) => (
          <Row key={`${group.id}-${e.key}`} entry={e} users={users} editable={editable} />
        ))}
      </div>
    </div>
  );
}

const ACTION_OF = {
  valueStream: updateValueStreamAction,
  art: updateArtAction,
  solution: updateSolutionAction,
} as const;

/** Das Raster jeder Zeile — in jeder Karte dasselbe, damit die Spalten fluchten. */
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)] gap-x-3 sm:grid-cols-[14rem_minmax(0,1fr)_auto]";

/**
 * Eine Zeile. Eigener `useActionState` je Zeile — Hooks gehen nicht in einer
 * `.map()`, in Kind-Komponenten schon; so trägt jede Zeile ihren eigenen
 * Ladezustand und ihren eigenen Fehler, statt dass ein Fehlschlag die ganze
 * Karte lahmlegt.
 *
 * **Alles im Button ist Phrasing Content.** Ein `<p>` oder `<div>` darin wäre
 * ungültiges HTML — der Parser darf den Baum umhängen. Blocklayout kommt hier
 * deshalb aus `block`/`flex` an `<span>`, wie überall im Haus.
 */
function Row({
  entry,
  users,
  editable,
}: {
  entry: DirectoryEntry;
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  const mayEdit = editable.has(targetKey(entry.target.kind, entry.target.id));
  const [open, setOpen] = useState(false);
  const [state, submit, busy] = useActionState(ACTION_OF[entry.target.kind], {});
  const saved = useTransientFlag(state.success === true);

  function save(next: string) {
    const fd = new FormData();
    fd.set("id", entry.target.id);
    // Nur die Id und das eine Feld: alle drei Actions lesen Personenfelder mit
    // `nullableString`, ein abwesendes Feld bleibt also unberührt. Deshalb
    // braucht diese Zeile kein Wissen über die übrigen Felder ihres Objekts.
    fd.set(entry.target.field, next);
    startTransition(() => submit(fd));
    setOpen(false);
  }

  if (open && mayEdit) {
    return (
      <div className={`${ROW_GRID} items-center py-2`}>
        <RoleLabel entry={entry} />
        <div className="sm:col-span-2">
          <UserPicker
            value={entry.userId ?? ""}
            onChange={save}
            options={users}
            ariaLabel={entry.role}
            placeholder="Nicht benannt"
            emptyLabel="— Niemand —"
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1 text-meta text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  const person = entry.userId ? (
    <>
      <Avatar size="sm">
        <AvatarFallback>{initials(entry.label ?? entry.userId)}</AvatarFallback>
      </Avatar>
      <span className="truncate text-sm text-foreground">{entry.label}</span>
    </>
  ) : (
    <>
      <span className="grid size-6 shrink-0 place-items-center rounded-full border border-dashed text-muted-foreground">
        <Plus className="size-3" aria-hidden />
      </span>
      <span className="text-sm text-muted-foreground">
        {mayEdit ? "Benennen" : "Nicht benannt"}
      </span>
    </>
  );

  const gates =
    entry.gates.length > 0 ? (
      <span className="hidden font-mono text-meta tabular-nums text-muted-foreground sm:block">
        {entry.gates.join(" ")}
      </span>
    ) : (
      <span aria-hidden />
    );

  const inner = (
    <>
      <RoleLabel entry={entry} />
      <span className="flex min-w-0 items-center gap-2">
        {person}
        {saved && <Check className="size-3.5 shrink-0 text-success" aria-hidden />}
      </span>
      {gates}
    </>
  );

  // Der Name gehört **in** die Ansage, nicht daneben: ein `aria-label` ersetzt
  // den Inhalt des Buttons, statt ihn zu ergänzen.
  const label = entry.userId
    ? `${entry.role}: ${entry.label}. Ändern`
    : `${entry.role}: niemand benannt. Benennen`;

  return (
    <div className="py-0.5">
      {mayEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={busy}
          aria-label={label}
          className={`${ROW_GRID} w-full items-center rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50`}
        >
          {inner}
        </button>
      ) : (
        <div className={`${ROW_GRID} items-center px-1.5 py-1.5`}>{inner}</div>
      )}
      <span role="status" className="sr-only">
        {saved ? `${entry.role} gespeichert` : ""}
      </span>
      {state.error && (
        <p role="alert" className="px-1.5 pb-1 text-meta text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}

/** Die Rolle führt, das Anliegen steht klein darunter. */
function RoleLabel({ entry }: { entry: DirectoryEntry }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium text-foreground">{entry.role}</span>
      <span className="block truncate text-meta text-muted-foreground">{entry.duty}</span>
    </span>
  );
}

/**
 * Ein Erfolg ist ein **Ereignis**, kein Zustand. `state.success` bleibt bis zum
 * nächsten Laden gesetzt; ohne diesen Haken stünden nach drei Änderungen drei
 * Häkchen da und behaupteten, gerade eben sei etwas passiert.
 */
function useTransientFlag(on: boolean, ms = 2500): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!on) return;
    setShown(true);
    const t = window.setTimeout(() => setShown(false), ms);
    return () => window.clearTimeout(t);
  }, [on, ms]);
  return shown;
}
