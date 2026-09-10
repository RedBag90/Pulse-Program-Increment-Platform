import type { Guide, Perspective } from "@/modules/wiki/domain/guide";
import type { ModuleKey } from "@/modules/core/kernel/domain/modules";
import type { PracticeFlags } from "@/modules/core/kernel/domain/operating-model";
import type { Role } from "@/modules/core/kernel/domain/roles";

/**
 * **Welche Anleitungen sieht dieser Mandant, und wo faengt dieser Leser an?**
 *
 * Spiegelt `onboarding/domain/role-tour.ts` — mit **einem bewussten
 * Unterschied**, und der ist der ganze Unterschied zwischen einer Tour und
 * einem Wiki:
 *
 *  - **Modul und Practice filtern.** Eine Budget-Anleitung in einem Mandanten
 *    ohne Budgeting ist Rauschen; eine Anleitung fuer eine Flaeche, die man
 *    nicht hat, ist schlimmer als keine.
 *  - **Die Rolle filtert nicht — sie waehlt vor.** Eine Tour zeigt, was *du*
 *    tun sollst. Ein Wiki soll auch erklaeren, was die anderen tun, sonst
 *    versteht niemand die Uebergaben. Die eigene Perspektive steht deshalb
 *    obenauf und ist markiert; die fremden bleiben lesbar.
 *
 * Rein, kein I/O.
 */

export interface WikiContext {
  enabledModules: readonly ModuleKey[];
  practices: PracticeFlags;
  /** Die Rollen des Lesers — nur fuer die Vorauswahl, nie zum Ausblenden. */
  roles: readonly Role[];
}

/** Traegt der Mandant, was dieser Ablauf voraussetzt? */
export function guideVisible(guide: Guide, ctx: WikiContext): boolean {
  if (guide.module != null && !ctx.enabledModules.includes(guide.module)) return false;
  if (guide.practice != null && ctx.practices[guide.practice] !== true) return false;
  return true;
}

/** Die sichtbaren Anleitungen, in der Reihenfolge der Quelle. */
export function visibleGuides(guides: readonly Guide[], ctx: WikiContext): Guide[] {
  return guides.filter((g) => guideVisible(g, ctx));
}

/**
 * Die Perspektive, mit der ein Leser einsteigt: die erste, deren Rolle er
 * traegt — sonst die erste ueberhaupt. `null` nur bei einer Anleitung ohne
 * Perspektiven, die es nicht geben sollte.
 */
export function preferredPerspective(guide: Guide, roles: readonly Role[]): Perspective | null {
  const own = guide.perspectives.find((p) => isOwnPerspective(p, roles));
  return own ?? guide.perspectives[0] ?? null;
}

/**
 * `true` = diese Perspektive gehoert dem Leser. Faerbt die Markierung.
 *
 * Eine Perspektive **ohne** `role` gehoert niemandem im Rollen-Sinn — „Finance"
 * und „Produkt-Manager" sind Benennungen an Feldern, keine Rollen. Sie werden
 * nie als „deine" markiert; das waere eine Behauptung, die das Rechtemodell
 * nicht deckt.
 */
export function isOwnPerspective(p: Perspective, roles: readonly Role[]): boolean {
  return p.role != null && roles.includes(p.role);
}

/**
 * Wie viele der sichtbaren Anleitungen den Leser unmittelbar angehen — die Zahl
 * fuer die Rollen-Zeile am Hub („7 von 11 haben eine Perspektive fuer dich").
 */
export function guidesForRoles(guides: readonly Guide[], roles: readonly Role[]): Guide[] {
  return guides.filter((g) => g.perspectives.some((p) => isOwnPerspective(p, roles)));
}
