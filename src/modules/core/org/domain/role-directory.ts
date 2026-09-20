/**
 * **„Ich arbeite in diesem Wertstrom — wen frage ich wofür?"** — als reine Regel.
 *
 * Der Struktur-Baum unter `/structure` beantwortet die Frage *von der Struktur
 * her*: hier ist ein Wertstrom, das sind seine Leute. Wer im Portfolio arbeitet,
 * stellt sie andersherum — er hat ein Anliegen und sucht einen Namen. Diese
 * Funktion dreht denselben Baum auf diese zweite Frage.
 *
 * Deshalb ist die **Zuständigkeit** die Zeile, nicht das Feld: nicht
 * „financeApproverId: anna@…", sondern „Geld, Budget, Zuteilung → Anna". Wer die
 * Spalte nicht kennt, findet trotzdem hin.
 *
 * ## Warum die Tor-Pflichten hereingereicht werden
 *
 * Woran jemand tatsächlich zeichnet, steht in der Gate-Policy — und die gehört
 * dem Work-Modul. Core darf nicht aufwärts importieren (ADR-0013), also nimmt
 * diese Funktion die Auflösung als **einfache Daten** entgegen; verdrahtet wird
 * sie im App-Root, der einzigen Schicht, die mehrere Module zusammenführen darf.
 *
 * Das ist kein Umweg, sondern der Grund, warum die Angabe stimmt: sie kommt aus
 * der **Konfiguration dieses Wertstroms**, nicht aus einem abgeschriebenen Satz.
 * Trägt jemand den Architect Lead an ein Tor ein, erscheint es hier von selbst.
 *
 * Rein, kein I/O.
 */

import { nestSolutionsByArt } from "@/modules/core/org/domain/structure-nesting";

/** Die Kennung einer Zuständigkeit — stabil, für Tests und die Tor-Karte. */
export type DutyKey =
  | "vs.finance"
  | "vs.portfolio"
  | "vs.business"
  | "vs.architecture"
  | "art.cadence"
  | "art.technical"
  | "solution.product";

/**
 * **Wohin ein Platz schreibt.** `kind` wählt die Server-Action, `id` das Objekt,
 * `field` den FormData-Schlüssel.
 *
 * Das steht hier und nicht auf der Fläche, weil die Zuordnung „Zuständigkeit →
 * Spalte" fachlich ist und genau einmal existieren darf. Kennte die Fläche sie
 * ein zweites Mal, wäre ein Vertippen ein **stiller** Datenfehler: der Name
 * landete im falschen Feld, die Fläche zeigte ihn trotzdem an der richtigen
 * Stelle — bis jemand den Wertstrom öffnet und sich wundert.
 */
export interface EntryTarget {
  kind: "valueStream" | "art" | "solution";
  id: string;
  field: string;
}

/**
 * Die Adresse eines Platzes als **ein** String — der Schlüssel, unter dem die
 * Fläche nachschlägt, ob der Betrachter ihn anfassen darf.
 *
 * Steht hier und nicht bei der Fläche, weil beide Seiten ihn brauchen: die
 * Server-Komponente baut die Menge, die Client-Komponente fragt sie ab. Ein
 * `"use client"`-Modul exportiert zur Laufzeit nur Referenzen — ein Aufruf von
 * der Serverseite ginge still schief.
 */
export function targetKey(kind: EntryTarget["kind"] | string, id: string): string {
  return `${kind}:${id}`;
}

/** Eine Zeile: das Anliegen, die Rollenbezeichnung, die Person. */
export interface DirectoryEntry {
  key: DutyKey;
  /** Die Frage, mit der jemand herkommt. */
  duty: string;
  /** Wie die Rolle im Haus heißt. */
  role: string;
  /** `null` = niemand benannt. Die Zeile bleibt trotzdem stehen. */
  userId: string | null;
  /** Aufgelöster Name; `null`, wenn niemand benannt ist. */
  label: string | null;
  /**
   * Woran diese Rolle in **diesem** Wertstrom zeichnet, z. B. `["L3.2", "L5"]`.
   * Leer = zeichnet nirgends. Kommt aus der Gate-Policy, nicht von hier.
   */
  gates: string[];
  /** Welches Objekt und welches Feld dieser Platz schreibt. */
  target: EntryTarget;
}

/** Eine Solution mit ihrem einen Platz — die Kachel in der ART-Spalte. */
export interface SolutionDirectory {
  id: string;
  name: string;
  /** Roh durchgereicht; die Fläche entscheidet, ob sie ihn kennt. */
  horizon: string;
  investmentMode: string | null;
  entries: DirectoryEntry[];
}

/** Ein ART mit seinen zwei Plätzen und den Solutions, die es baut. */
export interface ArtDirectory {
  id: string;
  name: string;
  entries: DirectoryEntry[];
  solutions: SolutionDirectory[];
}

/**
 * **Die Verschachtelung ist die Aussage.**
 *
 * Bis September 2026 lag hier eine flache `groups`-Liste: erst alle ARTs, dann
 * alle Solutions — eine Solution wusste nicht, zu welchem ART sie gehört, und
 * der Eingabetyp las `artId` gar nicht erst. Für eine Fläche mit Zeilen reichte
 * das; für eine mit **Spalten und Kacheln darin** nicht.
 *
 * Jetzt trägt das Verzeichnis dieselbe Gestalt wie die Organisations-Karte
 * (`structure-overview.ts`) — beide über denselben Helfer `nestSolutionsByArt`.
 */
export interface ValueStreamDirectory {
  id: string;
  name: string;
  /** Die Zuständigkeiten des Wertstroms selbst. */
  entries: DirectoryEntry[];
  arts: ArtDirectory[];
  /** Solutions ohne sichtbaren ART — sie hängen direkt am Wertstrom. */
  looseSolutions: SolutionDirectory[];
}

/**
 * Welche Tore eine Rolle in einem Wertstrom bedient. Äußerer Schlüssel ist die
 * Wertstrom-Id, innerer die {@link DutyKey}. Fehlt ein Eintrag, steht die Zeile
 * ohne Tor-Angabe da — das ist der Normalfall für rein benannte Personen.
 */
export type GateDuties = Record<string, Partial<Record<DutyKey, string[]>>>;

/** Was der Struktur-Baum liefert (Ausschnitt — nur das, was hier zählt). */
export interface DirectoryTreeVs {
  id: string;
  name: string;
  financeApproverId: string | null;
  vmoId: string | null;
  businessOwnerId: string | null;
  architectLeadId: string | null;
  arts: {
    id: string;
    name: string;
    rteId: string | null;
    technicalLeadId: string | null;
  }[];
  /** `artId` entscheidet, unter welcher Spalte die Solution steht. */
  solutions: {
    id: string;
    name: string;
    artId: string | null;
    /**
     * Nur zur Einfärbung der Kachel. Dieselbe Solution soll auf der
     * Organisations- und der Rollen-Fläche **dieselbe Farbe** tragen — sonst
     * wäre „Digital Banking Core" hier violett und dort orange, und niemand
     * erkennt, dass es dasselbe Ding ist.
     */
    horizon: string;
    investmentMode: string | null;
    productManagerId: string | null;
  }[];
}

/**
 * **Der Katalog der Zuständigkeiten** — die sieben Plätze, die es gibt.
 *
 * Bis September 2026 stand hier nur die Wertstrom-Tabelle, und die beiden
 * ART-Plätze samt dem der Solution lagen als Literale mitten in
 * `buildRoleDirectory`. Für die Fläche reichte das: sie baut sie ohnehin nur
 * dort. Wer sie **aufzählen** will — das Wiki erklärt sie —, musste sie
 * abschreiben, und eine abgeschriebene Liste läuft auseinander.
 *
 * Deshalb je Ebene eine eigene Tabelle statt einer gemeinsamen: `of` benennt
 * eine echte Spalte, und die ist je Ebene eine andere. Ein gemeinsamer Typ
 * müsste `string` sagen und verlöre genau die Sicherung, die hier zählt — ein
 * Vertippen im Feldnamen wäre ein **stiller** Datenfehler (siehe
 * {@link EntryTarget}).
 */
export const VS_DUTIES: {
  key: DutyKey;
  duty: string;
  role: string;
  /** Die Spalte am Wertstrom — zugleich Lesequelle und FormData-Schlüssel. */
  of: "financeApproverId" | "vmoId" | "businessOwnerId" | "architectLeadId";
}[] = [
  {
    key: "vs.finance",
    duty: "Geld, Budget, Zuteilung",
    role: "Finance Approver",
    of: "financeApproverId",
  },
  {
    key: "vs.portfolio",
    duty: "Reifegrade, Portfolio-Steuerung",
    role: "Portfolio Manager",
    of: "vmoId",
  },
  {
    key: "vs.business",
    duty: "Fachlicher Nutzen, Priorität",
    role: "Business Owner",
    of: "businessOwnerId",
  },
  {
    key: "vs.architecture",
    duty: "Architektur, Machbarkeit",
    role: "Value Stream Architect Lead",
    of: "architectLeadId",
  },
];

/** Die zwei Plätze eines ARTs. Der Technical Lead trägt nie Tore. */
export const ART_DUTIES: {
  key: DutyKey;
  duty: string;
  role: string;
  of: "rteId" | "technicalLeadId";
}[] = [
  { key: "art.cadence", duty: "Takt, Planung, PI", role: "RTE", of: "rteId" },
  {
    key: "art.technical",
    duty: "Technik im Zug",
    role: "ART Technical Lead",
    of: "technicalLeadId",
  },
];

/** Der eine Platz einer Solution. */
export const SOLUTION_DUTIES: {
  key: DutyKey;
  duty: string;
  role: string;
  of: "productManagerId";
}[] = [
  {
    key: "solution.product",
    duty: "Dieses Produkt",
    role: "Produkt-Manager",
    of: "productManagerId",
  },
];

/** Auf welcher Ebene ein Platz sitzt — die dritte Spalte beim Aufzählen. */
export type DutyLevel = "valueStream" | "art" | "solution";

export const DUTY_LEVEL_LABEL: Record<DutyLevel, string> = {
  valueStream: "Wertstrom",
  art: "ART",
  solution: "Solution",
};

/**
 * Alle sieben Plätze am Stück, von oben nach unten — für jeden, der sie
 * **aufzählt** statt sie zu besetzen. Abgeleitet, damit es keine achte Liste
 * gibt: wer oben eine Zuständigkeit ergänzt, findet sie hier von selbst wieder.
 */
export const ALL_DUTIES: readonly {
  key: DutyKey;
  duty: string;
  role: string;
  level: DutyLevel;
}[] = [
  ...VS_DUTIES.map((d) => ({ ...d, level: "valueStream" as const })),
  ...ART_DUTIES.map((d) => ({ ...d, level: "art" as const })),
  ...SOLUTION_DUTIES.map((d) => ({ ...d, level: "solution" as const })),
];

/**
 * `labelOf` bleibt draußen, weil die Namensauflösung I/O-nah ist (Supabase) und
 * diese Funktion rein bleiben soll. Sie bekommt sie als Abbildung.
 */
export function buildRoleDirectory(
  tree: readonly DirectoryTreeVs[],
  labelOf: (userId: string) => string,
  gateDuties: GateDuties = {},
): ValueStreamDirectory[] {
  return tree.map((vs) => {
    const duties = gateDuties[vs.id] ?? {};
    const entry = (
      key: DutyKey,
      duty: string,
      role: string,
      userId: string | null,
      target: EntryTarget,
    ): DirectoryEntry => ({
      key,
      duty,
      role,
      userId,
      label: userId ? labelOf(userId) : null,
      gates: duties[key] ?? [],
      target,
    });

    const solution = (sol: DirectoryTreeVs["solutions"][number]): SolutionDirectory => ({
      id: sol.id,
      name: sol.name,
      horizon: sol.horizon,
      investmentMode: sol.investmentMode,
      entries: SOLUTION_DUTIES.map((d) =>
        entry(d.key, d.duty, d.role, sol[d.of], {
          kind: "solution",
          id: sol.id,
          field: d.of,
        }),
      ),
    });

    const nested = nestSolutionsByArt(vs);

    return {
      id: vs.id,
      name: vs.name,
      entries: VS_DUTIES.map((d) =>
        entry(d.key, d.duty, d.role, vs[d.of], {
          kind: "valueStream",
          id: vs.id,
          field: d.of,
        }),
      ),
      arts: vs.arts.map(
        (art): ArtDirectory => ({
          id: art.id,
          name: art.name,
          // Der Technical Lead trägt nie Tore: vorerst nur benannt.
          entries: ART_DUTIES.map((d) =>
            entry(d.key, d.duty, d.role, art[d.of], {
              kind: "art",
              id: art.id,
              field: d.of,
            }),
          ),
          solutions: (nested.byArt.get(art.id) ?? []).map(solution),
        }),
      ),
      looseSolutions: nested.loose.map(solution),
    };
  });
}

/** Alle Solutions eines Wertstroms — unter ihren ARTs und die losen. */
export function allSolutions(vs: ValueStreamDirectory): SolutionDirectory[] {
  return [...vs.arts.flatMap((a) => a.solutions), ...vs.looseSolutions];
}

/** Alle Plätze eines Wertstroms, Ebenen zusammengefasst. */
export function allEntries(vs: ValueStreamDirectory): DirectoryEntry[] {
  return [
    ...vs.entries,
    ...vs.arts.flatMap((a) => a.entries),
    ...allSolutions(vs).flatMap((so) => so.entries),
  ];
}

export interface DirectoryStats {
  /** **Verschiedene** Personen, nicht Plätze. */
  people: number;
  /** Plätze ohne Person. */
  unfilled: number;
  streams: number;
}

/**
 * Die drei Zahlen über der Fläche.
 *
 * `people` zählt **Köpfe, nicht Posten** — und das ist die ganze Aussage: in
 * einem gewachsenen Portfolio tragen auffallend wenige Menschen auffallend viele
 * Zuständigkeiten. Wer stattdessen die besetzten Plätze zählte, bekäme eine
 * beruhigend große Zahl und übersähe genau das.
 */
export function directoryStats(streams: readonly ValueStreamDirectory[]): DirectoryStats {
  const people = new Set<string>();
  let unfilled = 0;
  for (const vs of streams) {
    for (const e of allEntries(vs)) {
      if (e.userId) people.add(e.userId);
      else unfilled += 1;
    }
  }
  return { people: people.size, unfilled, streams: streams.length };
}

/**
 * Wie viele Zuständigkeiten in einem Wertstrom unbesetzt sind — die Zahl, die
 * die Fläche als Hinweis zeigt. Eine unbesetzte Zeile ist keine Störung, aber
 * sie ist die Antwort „an niemanden", und die soll man sehen.
 */
export function unfilledCount(vs: ValueStreamDirectory): number {
  return allEntries(vs).filter((e) => e.userId === null).length;
}

/** Was die Fläche gerade zeigt. */
export interface DirectoryFilter {
  /** Freitext über Person **und** Rolle; leer = alles. */
  query: string;
  /** Nur Plätze ohne Person. */
  onlyUnfilled: boolean;
}

/**
 * Die Filterung — **rein**, damit sie prüfbar ist und nicht in der Fläche
 * versickert.
 *
 * Zwei Entscheidungen stecken darin:
 *
 * - **Leere Spalten, Kacheln und Wertströme fallen weg.** Eine Karte mit Kopf
 *   und nichts darunter sähe aus wie ein Ergebnis, ist aber keins.
 * - **Die Suche trifft Person und Rolle.** „anna" beantwortet „wo überall ist
 *   sie eingetragen", „architect" beantwortet „wer macht das bei uns" — zwei
 *   Fragen, ein Feld. Das Anliegen (`duty`) zählt mit, weil jemand auch
 *   „budget" tippen wird.
 */
export function filterDirectory(
  streams: readonly ValueStreamDirectory[],
  filter: DirectoryFilter,
): ValueStreamDirectory[] {
  const needle = filter.query.trim().toLowerCase();
  const keep = (e: DirectoryEntry): boolean => {
    if (filter.onlyUnfilled && e.userId !== null) return false;
    if (needle === "") return true;
    return [e.label ?? "", e.role, e.duty].some((t) => t.toLowerCase().includes(needle));
  };

  const solutions = (list: readonly SolutionDirectory[]) =>
    list
      .map((so) => ({ ...so, entries: so.entries.filter(keep) }))
      .filter((so) => so.entries.length > 0);

  const out: ValueStreamDirectory[] = [];
  for (const vs of streams) {
    const entries = vs.entries.filter(keep);
    // Ein ART bleibt stehen, solange **es selbst oder eine seiner Solutions**
    // etwas beiträgt — sonst verschwände die Spalte unter der Kachel, die man
    // gerade gesucht hat.
    const arts = vs.arts
      .map((a) => ({ ...a, entries: a.entries.filter(keep), solutions: solutions(a.solutions) }))
      .filter((a) => a.entries.length > 0 || a.solutions.length > 0);
    const looseSolutions = solutions(vs.looseSolutions);
    if (entries.length === 0 && arts.length === 0 && looseSolutions.length === 0) continue;
    out.push({ ...vs, entries, arts, looseSolutions });
  }
  return out;
}
