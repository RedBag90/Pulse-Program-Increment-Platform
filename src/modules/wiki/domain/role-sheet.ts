import type { ModuleKey } from "@/modules/core/kernel/domain/modules";
import type { Practice } from "@/modules/core/kernel/domain/operating-model";
import type { Role } from "@/modules/core/kernel/domain/roles";
import type { WikiContext } from "@/modules/wiki/domain/guide-filter";

/**
 * Ein **Rollen-Blatt** — was eine Rolle verantwortet, an einem Stueck.
 *
 * Das Wiki erzaehlt sonst **Ablaeufe**, jeden aus drei Perspektiven. Eine Rolle
 * liegt darin quer: was der RTE tut, steht in vier Anleitungen und nirgends
 * zusammen. `/meine-rolle` beantwortet dieselbe Frage — aber nur fuer die
 * **eigene** Rolle, und wer die Uebergaben verstehen will, muss die der anderen
 * lesen koennen.
 *
 * **Diese Datei traegt keinen Text.** Die Saetze stehen in
 * `onboarding/domain/role-playbook.ts`, das sich im eigenen Kopf
 * „Single-Source-of-Truth fuer das, was eine Rolle in Pulse tut" nennt. Das Wiki
 * ist ein Blatt ueber Core (ADR-0017) und darf `onboarding` nicht importieren —
 * gefuellt wird deshalb im Kompositionsroot, genau wie die Figuren
 * (`app/[locale]/(dashboard)/wiki/rollen/page.tsx`). Der Umweg ist der Grund,
 * warum es die Saetze nur einmal gibt: eine abgeschriebene Fassung liefe
 * auseinander, und `work/domain/epic-lifecycle-doc.ts` erzaehlt im eigenen Kopf,
 * wie das ausgeht.
 *
 * Rein, kein I/O.
 */

/**
 * Eine Aussage ueber die Rolle — ein Satz Verantwortung oder eine Uebergabe.
 *
 * `module` und `practice` sind **Sichtbarkeits-Tore**, keine Rechte: ein Satz
 * ueber Budget-Runden gehoert nicht in einen Mandanten ohne Budgeting. Wo das
 * Playbook stattdessen eine Capability nennt, loest der Kompositionsroot ihr
 * Modul ueber `moduleForAction()` auf — das Blatt kennt nur noch das Ergebnis.
 */
export interface RoleSheetClaim {
  textKey: string;
  module?: ModuleKey;
  practice?: Practice;
}

export interface RoleSheet {
  role: Role;
  /** `ROLE_LABELS[role]` — nicht neu getextet, sonst haetten wir zwei Namen. */
  label: string;
  /** Ein Satz: der Auftrag. Modulneutral, steht immer da. */
  missionKey: string;
  responsibilities: readonly RoleSheetClaim[];
  /** Woher die Arbeit kommt und wohin sie weitergeht. */
  handoffs: readonly RoleSheetClaim[];
}

/** Traegt der Mandant, was diese Aussage voraussetzt? */
function claimVisible(claim: RoleSheetClaim, ctx: WikiContext): boolean {
  if (claim.module != null && !ctx.enabledModules.includes(claim.module)) return false;
  if (claim.practice != null && ctx.practices[claim.practice] !== true) return false;
  return true;
}

/**
 * **Die Rolle des Lesers filtert nicht.**
 *
 * Dieselbe Regel wie in `guide-filter.ts`, und aus demselben Grund: „Eine Tour
 * zeigt, was *du* tun sollst. Ein Wiki soll auch erklaeren, was die anderen tun,
 * sonst versteht niemand die Uebergaben." Gefiltert wird ausschliesslich nach
 * **Modul und Practice** — nach dem, was dieser Mandant ueberhaupt hat.
 *
 * Insbesondere filtert auch die **Capability** nicht. Auf `/meine-rolle` tut sie
 * es (`role-tour.ts`), weil dort eine Aufgabe versprochen wird, die der Leser
 * tatsaechlich ausfuehren koennen muss. Hier wird nichts versprochen, hier wird
 * nachgeschlagen.
 *
 * Alle acht Blaetter bleiben deshalb stehen; nur einzelne Saetze koennen
 * wegfallen. Ein Blatt, von dem nichts uebrig bliebe, behaelt seinen Auftrag —
 * er ist modulneutral.
 */
export function visibleRoleSheets(sheets: readonly RoleSheet[], ctx: WikiContext): RoleSheet[] {
  return sheets.map((s) => ({
    ...s,
    responsibilities: s.responsibilities.filter((c) => claimVisible(c, ctx)),
    handoffs: s.handoffs.filter((c) => claimVisible(c, ctx)),
  }));
}
