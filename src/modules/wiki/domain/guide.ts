import type { Block } from "@/modules/wiki/domain/blocks";
import type { Cadence } from "@/modules/wiki/domain/cadence";
import type { ModuleKey } from "@/modules/core/kernel/domain/modules";
import type { Practice } from "@/modules/core/kernel/domain/operating-model";
import type { Role } from "@/modules/core/kernel/domain/roles";
import type { Action } from "@/server/auth/policies";

/**
 * Eine **Anleitung** — ein Ablauf, aus mehreren Perspektiven erzaehlt.
 *
 * Das Wiki ist ein **Blatt ueber Core** (dieselbe Konstruktion wie das
 * Onboarding-Modul, ADR-0017): es erklaert alle Module, darf sie aber nicht
 * importieren. Es kennt sie deshalb nur ueber **Strings** — Route, Anker,
 * Capability — und ueber die Schluessel `ModuleKey` und `Practice`, die in Core
 * wohnen.
 *
 * Dass diese Strings stimmen, sichern **Tests** statt Typen: jede Route muss auf
 * ein registriertes Segment und eine echte `page.tsx` zeigen, jede Capability in
 * `POLICIES` existieren. Genau dieser Test hat in derselben Sitzung elf
 * Tour-Schritte gefunden, die ins Leere navigierten.
 *
 * Rein, kein I/O.
 */

/** Eine Station: ein Schritt im Ablauf, mit einem Ziel in der Anwendung. */
export interface Station {
  title: string;
  body: Block[];
  /**
   * Wohin dieser Schritt fuehrt — locale-los und **statisch** (kein `[param]`),
   * damit der Sprung konkret ist und der Test ihn pruefen kann.
   */
  route?: string;
  /**
   * `data-tour`-Anker des Bedienelements. Wird heute noch nicht benutzt — der
   * Knopf „Zeig es mir", der das vorhandene Spotlight startet, kommt spaeter.
   * Er steht trotzdem schon hier und wird vom Test geprueft, damit spaeter nur
   * noch verdrahtet werden muss.
   */
  anchor?: string;
}

/**
 * Eine Perspektive: dieselbe Sache aus der Sicht eines Beteiligten.
 *
 * **Nicht jeder Beteiligte ist eine Rolle**, und das ist kein Schoenheitsfehler,
 * sondern eine Aussage ueber Pulse: „Finance" ist die Finance-Partei eines
 * Wertstroms (`financeApproverId`), „Produkt-Manager" eine Benennung am Feld
 * (`Solution.productManagerId`), „Der Neue" traegt beim Beitritt noch gar
 * nichts. Nur wo `role` gesetzt ist, kann das Wiki vorwaehlen — bei den
 * uebrigen steht die Perspektive einfach da, wie jede andere.
 */
export interface Perspective {
  /** „Der Portfolio Manager", „Finance", „Das Gruppenmitglied". */
  label: string;
  /** Gesetzt, wenn es wirklich eine Rolle ist — nur dann wird vorgewaehlt. */
  role?: Role;
  /** „Meine Frage lautet: …" — sie steht unter der Ueberschrift. */
  question: string;
  stations: Station[];
}

export interface Guide {
  /** Teil der Route: `/wiki/<slug>`. Eindeutig, vom Test geprueft. */
  slug: string;
  title: string;
  /** Ein bis drei Saetze unter dem Titel. */
  standfirst: string;
  /**
   * Die Zeile auf der Kachel am Hub — **eine** Aufzaehlung der Stationen, kein
   * Satz und keine gekuerzte Fassung des Vorspanns. Am Bogen stehen bis zu vier
   * Kacheln nebeneinander; wer dort einen Absatz unterbringt, macht aus dem
   * Ueberblick wieder eine Textwand.
   */
  teaser: string;
  cadence: Cadence;
  /**
   * Das Modul, ohne das dieser Ablauf nicht stattfindet. Fehlt es dem Mandanten,
   * fehlt die Anleitung — eine Anleitung fuer eine Flaeche, die man nicht hat,
   * ist schlimmer als keine.
   */
  module?: ModuleKey;
  /** Dasselbe fuer eine abgeschaltete Arbeitsweise. */
  practice?: Practice;
  /** „Die gemeinsame Mechanik" — was fuer alle Perspektiven gilt. */
  mechanics: Block[];
  perspectives: Perspective[];
  /** „Saetze, die naheliegen und nicht stimmen." */
  misconceptions: { claim: string; why: string }[];
  /** „Wer welchen Schritt macht." */
  who: { step: string; who: string; capability?: Action }[];
  /** Die Naehte — Slugs verwandter Anleitungen. */
  seeAlso: string[];
}
