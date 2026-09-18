/**
 * **Der Filter „welchem Epic gehört dieses Feature" — einschliesslich „keinem".**
 *
 * Das Cockpit konnte auf **ein** Epic filtern, aber nicht auf das **Fehlen**
 * eines. Damit wäre das ART-Backlog als Menge unsichtbar: eigenständige
 * Features stünden zwar im Board und im Fahrplan unter „Ohne Epic", liessen
 * sich aber nirgends zusammen betrachten.
 *
 * Der Merkwert steht hier und nicht in der Fläche, damit er nicht versehentlich
 * als Epic-Id in eine Abfrage gerät — er ist kein UUID und würde dort stumm
 * nichts treffen.
 *
 * Rein, kein I/O; die Prisma-Bedingung ist ein einfaches Objekt.
 */

/** Der Wert, den die Optionsliste für „ohne Epic" trägt. Bewusst kein UUID. */
export const NO_EPIC = "__none__";

export interface ParentFilter {
  /** Gesetzt, wenn nach echten Epics gefiltert wird. */
  parentId?: { in: string[] } | null;
  OR?: Array<{ parentId: { in: string[] } | null }>;
}

/**
 * Baut die Bedingung für eine Auswahl aus Epic-Ids und/oder dem Merkwert.
 *
 * - leere Auswahl → **keine** Bedingung (alles)
 * - nur Epics → `parentId in [...]`
 * - nur „ohne Epic" → `parentId is null`
 * - beides → `OR`, damit sich die Auswahl **kombinieren** lässt
 */
export function epicFilterWhere(selected: readonly string[]): ParentFilter {
  const wantsNone = selected.includes(NO_EPIC);
  const ids = selected.filter((v) => v !== NO_EPIC);

  if (selected.length === 0) return {};
  if (!wantsNone) return { parentId: { in: ids } };
  if (ids.length === 0) return { parentId: null };
  return { OR: [{ parentId: { in: ids } }, { parentId: null }] };
}
