import type { ReadonlyURLSearchParams } from "next/navigation";

/**
 * Baut einen Ziel-Deep-Link, der die **bestehenden** Query-Params (Filter,
 * Layout, Tab) erhält und nur den Patch anwendet. Wichtig: ein bares
 * `?entity=goal&id=…` würde die ganze Query ersetzen und aktive Filter
 * (`?status=`/`?period=`/…) wegwerfen.
 */
export function goalHref(
  sp: ReadonlyURLSearchParams,
  patch: Record<string, string | null>,
): string {
  const p = new URLSearchParams(sp.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) p.delete(k);
    else p.set(k, v);
  }
  const qs = p.toString();
  return qs ? `?${qs}` : "?";
}

/** Deep-Link zum Ziel-Detail (Drawer öffnen), Filter/Layout bleiben erhalten. */
export function goalDetailHref(sp: ReadonlyURLSearchParams, id: string): string {
  return goalHref(sp, { entity: "goal", id, new: null, parent: null });
}

/**
 * Wie {@link goalDetailHref}, wirft aber zusätzlich die Scope-Filter weg. Nötig,
 * wenn das Ziel unter den aktiven Filtern gar nicht geladen wird — der Drawer
 * löst den Knoten aus dem gefilterten Baum auf und stünde sonst leer da.
 * Layout/Tab bleiben erhalten.
 */
export function goalDetailHrefClearingScope(sp: ReadonlyURLSearchParams, id: string): string {
  return goalHref(sp, {
    entity: "goal",
    id,
    new: null,
    parent: null,
    period: null,
    vs: null,
    art: null,
    status: null,
  });
}

/** Deep-Link „neues Ziel anlegen" (optional unter `parentId`), Params erhalten. */
export function goalCreateHref(sp: ReadonlyURLSearchParams, parentId?: string): string {
  return goalHref(sp, {
    entity: "goal",
    new: "1",
    id: null,
    ...(parentId ? { parent: parentId } : { parent: null }),
  });
}
