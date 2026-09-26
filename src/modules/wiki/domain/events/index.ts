import type { Locale } from "@/i18n/routing";
import type { Role } from "@/modules/core/kernel/domain/roles";
import type { DutyKey } from "@/modules/core/org/domain/role-directory";
import { EVENTS_DE } from "@/modules/wiki/domain/events/de";
import { EVENTS_EN } from "@/modules/wiki/domain/events/en";

/**
 * **Welche Termine es braucht** — die SAFe-Events mit Rollen und Vorbereitung,
 * als Nachschlage-Seite des Wikis (`/wiki/termine`).
 *
 * Methodik, keine Funktion von Pulse: kein Event hier hat eine eigene Fläche
 * in der App, und deshalb filtert die Seite auch nicht nach gebuchten
 * Modulen. Wo es eine Anleitung zum selben Ablauf gibt, verweist `seeAlso`
 * darauf.
 *
 * Der Text liegt je Sprache als eigene Datei, wie bei den Anleitungen
 * (`guides/index.ts`): Prosa gehört nicht in den Katalog, und eine Übersetzung
 * ist ein eigener Text, kein Schlüssel je Satz. Die Struktur — Ebenen, Keys,
 * Rollen, Anteile, Verweise — ist in beiden gleich; `events.test.ts` hält sie
 * zusammen.
 */

/** ● leitet oder verantwortet · ○ nimmt aktiv teil · (○) optional. */
export type EventPart = "lead" | "active" | "optional";

/**
 * **Wer am Tisch sitzt: eine Rolle oder eine Benennung.** Nicht jeder, der
 * einen Termin leitet, trägt dafür eine Rolle in Pulse — der Produkt-Manager
 * ist eine Benennung an der Solution eines ARTs (`solution.product`,
 * `Solution.productManagerId`), keine Rolle mit Rechten. Die Tabelle nennt
 * ihn trotzdem, wie ihn das Haus nennt.
 */
export type EventSeat = { role: Role } | { duty: DutyKey };

export type EventParticipant = EventSeat & {
  part: EventPart;
  /** Was diese Rolle mitbringt — je Punkt ein Eintrag. */
  prep: string[];
};

/** Rolle oder Benennung als ein Schlüssel — für Vergleiche und React-Keys. */
export function seatKey(p: EventSeat): string {
  return "role" in p ? p.role : p.duty;
}

export interface WikiEvent {
  /** Anker auf der Seite, URL-sicher. */
  key: string;
  name: string;
  cadence: string;
  purpose: string;
  participants: EventParticipant[];
  /** Slugs von Anleitungen zum selben Ablauf. */
  seeAlso?: string[];
}

export interface EventLevel {
  key: "portfolio" | "art";
  title: string;
  /** Was neben den Events noch zur Ebene gehört. */
  note?: string;
  events: WikiEvent[];
}

export interface EventCatalog {
  title: string;
  lede: string;
  /** Anzeigenamen der Benennungen in dieser Sprache — Rollen nennt `ROLE_LABELS`. */
  dutyLabels: Partial<Record<DutyKey, string>>;
  levels: EventLevel[];
}

/**
 * **Reihenfolge je Tabelle: Leitung, Teilnehmer, optional** — an einer Stelle
 * festgelegt, nicht in jeder Datei von Hand. Innerhalb einer Gruppe gilt die
 * Reihenfolge der Datei (stabile Sortierung); eine nachgetragene Benennung
 * darf deshalb hinten stehen und landet trotzdem in ihrer Gruppe.
 */
const PART_ORDER: Record<EventPart, number> = { lead: 0, active: 1, optional: 2 };

function ordered(catalog: EventCatalog): EventCatalog {
  return {
    ...catalog,
    levels: catalog.levels.map((l) => ({
      ...l,
      events: l.events.map((e) => ({
        ...e,
        participants: [...e.participants].sort((a, b) => PART_ORDER[a.part] - PART_ORDER[b.part]),
      })),
    })),
  };
}

const DE = ordered(EVENTS_DE);
const EN = ordered(EVENTS_EN);

export function eventsFor(locale: Locale): EventCatalog {
  return locale === "en" ? EN : DE;
}

/** Alle Events aller Ebenen, in Reihenfolge. */
export function allEvents(catalog: EventCatalog): WikiEvent[] {
  return catalog.levels.flatMap((l) => l.events);
}
