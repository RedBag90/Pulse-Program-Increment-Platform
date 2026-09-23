"use client";

import { useActionState, startTransition, useState, type ReactNode } from "react";
import { Check, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserPicker } from "@/components/detail/user-picker";
import { initials } from "@/components/detail/initiative-labels";
import { cn } from "@/lib/utils";
import { useTransientFlag } from "@/lib/hooks/use-transient-flag";
import type { DirectoryEntry } from "@/modules/core/org/domain/role-directory";
import { targetKey } from "@/modules/core/org/domain/role-directory";
import { updateValueStreamAction } from "@/modules/core/org/features/value-stream/actions/value-stream";
import { updateArtAction } from "@/modules/core/org/features/art/actions/art";
import { updateSolutionAction } from "@/modules/core/org/features/solution/actions/solution";

/**
 * **Ein Platz — ein Verhalten, zwei Formen.**
 *
 * Die Rollenverteilung zeigt dieselben Plätze zweimal: als breite Zeile in der
 * Tabelle und als gestapelte Zelle in einer 15-rem-Spalte der Karte. Das
 * *Verhalten* ist beidesmal identisch — und es ist der heikle Teil: ein eigener
 * `useActionState` je Platz, die Rechteprüfung, der Picker, der Haken nach dem
 * Speichern, die Fehlerzeile, die Ansage mit dem Namen darin.
 *
 * Deshalb steht es **einmal** im Hook und nicht zweimal in zwei Komponenten.
 * Was sich unterscheidet, ist nur das Raster.
 */
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

const ACTION_OF = {
  valueStream: updateValueStreamAction,
  art: updateArtAction,
  solution: updateSolutionAction,
} as const;

/** Das Raster der Tabellenzeile — in jeder Karte dasselbe, damit sie fluchten. */
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)] gap-x-3 sm:grid-cols-[14rem_minmax(0,1fr)_auto]";

interface Slot {
  mayEdit: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  save: (next: string) => void;
  busy: boolean;
  saved: boolean;
  error: string | undefined;
  /** Die Ansage für Hilfsmittel — der Name gehört **hinein**, nicht daneben. */
  label: string;
}

/**
 * Eigener `useActionState` je Platz — Hooks gehen nicht in einer `.map()`, in
 * Kind-Komponenten schon. So trägt jeder Platz seinen eigenen Ladezustand und
 * seinen eigenen Fehler, statt dass ein Fehlschlag die ganze Karte lahmlegt.
 */
function useRoleSlot(entry: DirectoryEntry, editable: EditableTargets): Slot {
  const mayEdit = editable.has(targetKey(entry.target.kind, entry.target.id));
  const [open, setOpen] = useState(false);
  const [state, submit, busy] = useActionState(ACTION_OF[entry.target.kind], {});
  const saved = useTransientFlag(state.success === true);

  function save(next: string) {
    const fd = new FormData();
    fd.set("id", entry.target.id);
    // Nur die Id und das eine Feld: alle drei Actions lesen Personenfelder mit
    // `nullableString`, ein abwesendes Feld bleibt also unberührt. Deshalb
    // braucht dieser Platz kein Wissen über die übrigen Felder seines Objekts.
    fd.set(entry.target.field, next);
    startTransition(() => submit(fd));
    setOpen(false);
  }

  // Ein `aria-label` **ersetzt** den Inhalt des Buttons, statt ihn zu ergänzen.
  const label = entry.userId
    ? `${entry.role}: ${entry.label}. Ändern`
    : `${entry.role}: niemand benannt. Benennen`;

  return { mayEdit, open, setOpen, save, busy, saved, error: state.error, label };
}

/**
 * Die Person — oder der gestrichelte Platz, der sagt „an niemanden".
 *
 * **Die Größe folgt dem Ort, nicht der Komponente.** In der Tabellenzeile trägt
 * der Rollenname 14 px, also trägt die Person ebenfalls 14. In der Kartenzelle
 * ist alles eine Stufe kleiner — bliebe die Person auf 14, wäre sie der grösste
 * Text der ganzen Spalte und damit grösser als ihre eigene Überschrift. Genau
 * das sah die Fläche vorher „random" aus.
 */
function Person({
  entry,
  mayEdit,
  saved,
  size,
}: {
  entry: DirectoryEntry;
  mayEdit: boolean;
  saved: boolean;
  size: "sm" | "xs";
}) {
  const text = size === "sm" ? "text-sm" : "text-xs";
  return (
    <span className="flex min-w-0 items-center gap-2">
      {entry.userId ? (
        <>
          <Avatar size="sm">
            <AvatarFallback>{initials(entry.label ?? entry.userId)}</AvatarFallback>
          </Avatar>
          <span className={cn("truncate text-foreground", text)}>{entry.label}</span>
        </>
      ) : (
        <>
          <span className="grid size-6 shrink-0 place-items-center rounded-full border border-dashed text-muted-foreground">
            <Plus className="size-3" aria-hidden />
          </span>
          <span className={cn("truncate text-muted-foreground", text)}>
            {mayEdit ? "Benennen" : "Nicht benannt"}
          </span>
        </>
      )}
      {saved && <Check className="size-3.5 shrink-0 text-success" aria-hidden />}
    </span>
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
 * Woran diese Rolle zeichnet.
 *
 * **Das Mono richtet eine Spalte aus — in einer Zelle gibt es keine.** In der
 * Tabelle stehen die Tore rechts untereinander und sollen fluchten; dort ist
 * die dicktengleiche Schrift die halbe Miete. In der Kartenzelle steht die
 * Marke allein, und das Mono macht sie nur schwerer als den Rollennamen
 * darüber.
 */
function Gates({
  entry,
  mono = true,
  className,
}: {
  entry: DirectoryEntry;
  mono?: boolean;
  className?: string;
}) {
  if (entry.gates.length === 0) return <span aria-hidden />;
  return (
    <span
      className={cn("text-meta text-muted-foreground", mono && "font-mono tabular-nums", className)}
      title={`Zeichnet an: ${entry.gates.join(", ")}`}
    >
      {entry.gates.join(" ")}
    </span>
  );
}

function Picker({
  entry,
  users,
  slot,
  className,
}: {
  entry: DirectoryEntry;
  users: DirectoryUserOption[];
  slot: Slot;
  className?: string;
}) {
  return (
    <div className={className}>
      <UserPicker
        value={entry.userId ?? ""}
        onChange={slot.save}
        options={users}
        ariaLabel={entry.role}
        placeholder="Nicht benannt"
        emptyLabel="— Niemand —"
        disabled={slot.busy}
      />
      <button
        type="button"
        onClick={() => slot.setOpen(false)}
        className="mt-1 text-meta text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Abbrechen
      </button>
    </div>
  );
}

/**
 * Die gemeinsame Hülle: Bedienelement nur mit Recht, Erfolgsansage, Fehlerzeile.
 *
 * **Alles im Button ist Phrasing Content.** Ein `<p>` oder `<div>` darin wäre
 * ungültiges HTML — der Parser darf den Baum umhängen. Blocklayout kommt
 * deshalb aus `block`/`flex` an `<span>`, wie überall im Haus.
 */
function Shell({
  entry,
  slot,
  grid,
  children,
}: {
  entry: DirectoryEntry;
  slot: Slot;
  grid: string;
  children: ReactNode;
}) {
  return (
    <div className="py-0.5">
      {slot.mayEdit ? (
        <button
          type="button"
          onClick={() => slot.setOpen(true)}
          disabled={slot.busy}
          aria-label={slot.label}
          className={cn(
            grid,
            "w-full rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        >
          {children}
        </button>
      ) : (
        <div className={cn(grid, "px-1.5 py-1.5")}>{children}</div>
      )}
      <span role="status" className="sr-only">
        {slot.saved ? `${entry.role} gespeichert` : ""}
      </span>
      {slot.error && (
        <p role="alert" className="px-1.5 pb-1 text-meta text-destructive">
          {slot.error}
        </p>
      )}
    </div>
  );
}

/** Die breite Zeile der Tabelle: Rolle | Person | Tore. */
export function RoleRow({
  entry,
  users,
  editable,
}: {
  entry: DirectoryEntry;
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  const slot = useRoleSlot(entry, editable);

  if (slot.open && slot.mayEdit) {
    return (
      <div className={cn(ROW_GRID, "items-center py-2")}>
        <RoleLabel entry={entry} />
        <Picker entry={entry} users={users} slot={slot} className="sm:col-span-2" />
      </div>
    );
  }

  return (
    <Shell entry={entry} slot={slot} grid={cn(ROW_GRID, "items-center")}>
      <RoleLabel entry={entry} />
      <Person entry={entry} mayEdit={slot.mayEdit} saved={slot.saved} size="sm" />
      <Gates entry={entry} className="hidden sm:block" />
    </Shell>
  );
}

/**
 * Die gestapelte Zelle der Karte — **eine Angabe je Zeile**.
 *
 * Rolle und Tore standen zuerst nebeneinander: `flex-1 truncate` am Namen gegen
 * `shrink-0` an den Toren. In der Vierer-Spalte des Streifens gewannen die
 * Tore, und aus „Portfolio Manager" wurde „Portfolio …". Sechs Tor-Marken
 * brauchen mehr Platz als der Name, den sie erläutern — also bekommen sie eine
 * eigene, letzte Zeile.
 *
 * Zwei Größen, wie in der Kachel der Organisations-Fläche: 12 px für das, was
 * **benennt** (Rolle, Person), 11 px für das, was es **erläutert** (Anliegen,
 * Tore).
 */
export function RoleCell({
  entry,
  users,
  editable,
}: {
  entry: DirectoryEntry;
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  const slot = useRoleSlot(entry, editable);

  if (slot.open && slot.mayEdit) {
    return (
      // **Die Zelle behält ihre Anatomie.** Vorher blieb beim Öffnen nur der
      // Rollenname stehen — Anliegen und Tore verschwanden, und die Zelle sah
      // neben ihren geschlossenen Nachbarn aus wie ein anderes Bedienelement.
      // Die Zeilenansicht (`RoleRow`) hat das nie getan. Getauscht wird nur
      // die Person gegen den Picker.
      <div className="flex flex-col gap-0.5 py-1">
        <span className="block truncate text-xs font-medium text-foreground">{entry.role}</span>
        <span className="block truncate text-meta text-muted-foreground">{entry.duty}</span>
        <Picker entry={entry} users={users} slot={slot} />
        {entry.gates.length > 0 && <Gates entry={entry} mono={false} className="block truncate" />}
      </div>
    );
  }

  return (
    <Shell entry={entry} slot={slot} grid="flex flex-col gap-0.5">
      <span className="block truncate text-xs font-medium text-foreground">{entry.role}</span>
      <span className="block truncate text-meta text-muted-foreground">{entry.duty}</span>
      <Person entry={entry} mayEdit={slot.mayEdit} saved={slot.saved} size="xs" />
      {entry.gates.length > 0 && <Gates entry={entry} mono={false} className="block truncate" />}
    </Shell>
  );
}
