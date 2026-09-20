/**
 * **Die Lieferseite der Seeds — als reine Regel.**
 *
 * Geld und Reifegrad sind in diesen Seeds durchgerechnet: ein eigener
 * Rundenmotor, Laufzeit-Invarianten, Tests ohne Datenbank. Die **Lieferung** war
 * es nicht. Gemessen am Bestand vom September 2026:
 *
 *  - **232 von 461 Features** trugen eine Job Size, die das Produkt gar nicht
 *    schreiben kann: `js = 2 + ((i + f) % 9)` ergibt 2…10, waehrend
 *    `src/domain/schemas/initiative.ts` nur Fibonacci zulaesst. Jedes neunte
 *    Feature bekam ausserdem zufaellig die 3 — und die Flaeche meldete es als
 *    „Schnellanlage-Platzhalter", ohne dass das gemeint war.
 *  - **Sechs von zehn abgeschlossenen PIs waren leer.** Fertige Features landeten
 *    ausschliesslich in zwei festen PI-Rollen; die uebrigen blieben ohne einen
 *    einzigen Eintrag.
 *  - **Abgeschlossene PIs lieferten exakt 100 %**, der laufende 0 %. Die
 *    Abweichung, die eine Guardrail zeigen soll, gab es im Datensatz nicht.
 *
 * Diese Datei ist die Gegenrichtung, und sie ist **rein**: dieselbe Bauart wie
 * `seed-large-rounds.ts`, damit sich ohne Datenbank pruefen laesst, was am
 * fertigen Mandanten nur mit Muehe zu sehen waere.
 *
 * **Sie erfindet nichts, um eine Kennzahl zu fuellen.** Ein Feature liefert in
 * dem PI, in dem sein Epic tatsaechlich umgesetzt wurde — das Abschlussdatum
 * folgt dem Vorgang, statt einem Abstand zu „heute".
 */

/** Die Werte, die `fibonacci` in `src/domain/schemas/initiative.ts` zulaesst. */
export const JOB_SIZE_SCALE = [1, 2, 3, 5, 8, 13, 20] as const;

/**
 * Die Skala, aus der ein geseedetes Feature schoepft.
 *
 * **Ohne die 3 und ohne die 20.** Die 3 ist der Schnellanlage-Platzhalter und
 * wird gezielt gesetzt (`PLACEHOLDER_JOB_SIZE`), nicht zufaellig getroffen; die
 * 20 ist in der Praxis ein Zeichen dafuer, dass ein Feature haette geschnitten
 * werden muessen, und gehoert nicht in den Normalfall.
 */
const REGULAR_SCALE = [1, 2, 5, 8, 13] as const;

/** Der Platzhalter, den die Schnellanlage setzt — bewusst selten. */
export const PLACEHOLDER_JOB_SIZE = 3;

/**
 * Die Job Size eines Features. Deterministisch aus den Indizes, damit ein
 * zweiter Lauf denselben Mandanten ergibt.
 *
 * Jedes elfte Feature traegt den Platzhalter: genug, damit der Vorbehalt im
 * €-Satz sichtbar wird, zu wenig, um ihn zu bestimmen.
 */
export function jobSizeFor(epicIdx: number, featureIdx: number): number {
  const n = epicIdx * 7 + featureIdx;
  if (n % 11 === 0) return PLACEHOLDER_JOB_SIZE;
  return REGULAR_SCALE[n % REGULAR_SCALE.length]!;
}

export type PiStatus = "completed" | "active" | "planned";
export type FeatureStatus = "approved" | "in_progress" | "blocked" | "completed";

export interface DeliveryPi {
  id: string;
  start: Date;
  end: Date;
  status: PiStatus;
}

const MS_DAY = 86_400_000;
const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * MS_DAY);

/**
 * **Die PIs, in denen dieses Epic tatsaechlich umgesetzt wurde.**
 *
 * Nicht „die zwei juengsten", sondern die abgeschlossenen PIs, deren Fenster das
 * Umsetzungsfenster des Epics beruehrt. Genau daran hing der Befund: die alte
 * Regel kannte zwei feste Rollen und liess sechs PIs leer.
 *
 * Beruehrt keines — das Epic wurde ausserhalb der PI-Reihe umgesetzt —, gilt das
 * juengste abgeschlossene. Ein Feature ohne PI waere hier die schlechtere
 * Auskunft: es ist ja geliefert.
 */
export function deliveryPis(
  completed: readonly DeliveryPi[],
  implStart: Date | null,
  implDone: Date | null,
): DeliveryPi[] {
  if (completed.length === 0) return [];
  if (implStart == null) return [completed[completed.length - 1]!];
  const bis = implDone ?? completed[completed.length - 1]!.end;
  const treffer = completed.filter((p) => p.start <= bis && p.end >= implStart);
  return treffer.length > 0 ? treffer : [completed[completed.length - 1]!];
}

export interface FeaturePlanInput {
  epicIdx: number;
  featureIdx: number;
  /** Reifegrad des Epics am Ende des gespielten Fensters. */
  gate: string;
  implStart: Date | null;
  implDone: Date | null;
  /** Die abgeschlossenen PIs der Kadenz dieses ARTs, aufsteigend. */
  completedPis: readonly DeliveryPi[];
  activePi: DeliveryPi | null;
  /**
   * Die geplanten PIs der Kadenz — **alle**, nicht nur das naechste.
   *
   * Gemessen trug das erste geplante PI 791 Punkte, waehrend die beiden dahinter
   * leer blieben; das laufende hatte 336. Ein Zug, der alles in den naechsten
   * Sprung legt und die zwei danach frei laesst, plant nicht — er staut.
   */
  plannedPis: readonly DeliveryPi[];
  /** „Jetzt" — der laufende PI darf nur bis hierher geliefert haben. */
  now: Date;
}

export interface FeaturePlan {
  status: FeatureStatus;
  pi: DeliveryPi | null;
  completedAt: Date | null;
}

/**
 * **Wo ein Feature steht — und warum.**
 *
 * Vier Lagen, und die dritte ist die, die im Datensatz fehlte:
 *
 *  - **Bis L2** geschnitten, aber nicht eingeplant. Genau der Vorrat, ueber den
 *    die PI-Planung entscheidet.
 *  - **L3** finanziert: das naechste PI ist gesetzt, gearbeitet wird noch nicht.
 *  - **L4** mitten in der Umsetzung: ein Teil ist geliefert, ein Teil laeuft —
 *    und ein kleiner Teil steht **offen in einem abgeschlossenen PI**. Das ist
 *    der Uebertrag, und er ist der Grund, warum ein PI unter 100 % landet.
 *  - **L5**: die Umsetzung ist fertig, also sind es die Deliverables auch.
 *    Etwas anderes waere ein Widerspruch zur Reifegrad-Historie, die dieser
 *    Seed sorgfaeltig fuehrt.
 */
export function planFeature(input: FeaturePlanInput): FeaturePlan {
  const { gate, epicIdx, featureIdx } = input;
  const running = gate === "L4" || gate === "L5";
  const n = epicIdx * 3 + featureIdx;

  if (!running) {
    return {
      status: "approved",
      // Auf L2 geschnitten, aber nicht eingeplant: der Vorrat, ueber den die
      // PI-Planung entscheidet. Auf L3 ist das Geld da — verteilt ueber die
      // geplanten PIs, nicht gestapelt auf das naechste.
      pi:
        gate === "L2" || input.plannedPis.length === 0
          ? null
          : input.plannedPis[n % input.plannedPis.length]!,
      completedAt: null,
    };
  }

  const kandidaten = deliveryPis(input.completedPis, input.implStart, input.implDone);
  const geliefertIn = kandidaten.length > 0 ? kandidaten[n % kandidaten.length]! : null;

  if (gate === "L5") {
    return {
      status: "completed",
      pi: geliefertIn,
      completedAt: geliefertIn ? completionInside(geliefertIn, n, input.now) : null,
    };
  }

  /**
   * L4 — die Mischung. Sechs Lagen, und zwei davon fehlten im Bestand: der
   * **Uebertrag** (offen in einem abgeschlossenen PI) und die Lieferung **im
   * laufenden PI**. Ohne die zweite stand ein PI, das zu zwei Dritteln durch
   * war, auf 0 % — gemessen 336 eingeplante Punkte, keiner davon fertig.
   */
  switch (n % 6) {
    case 0:
    case 1:
      return {
        status: "completed",
        pi: geliefertIn,
        completedAt: geliefertIn ? completionInside(geliefertIn, n, input.now) : null,
      };
    case 2:
      // Der Uebertrag: eingeplant gewesen, nicht geliefert, steht noch da.
      return {
        status: "in_progress",
        pi: kandidaten.length > 0 ? kandidaten[kandidaten.length - 1]! : null,
        completedAt: null,
      };
    case 3:
      // Im laufenden PI bereits geliefert — nur wenn es ueberhaupt schon
      // gelaufen ist. Ein Abschluss am Tag des Starts waere keine Lieferung.
      if (input.activePi != null && input.now > addDays(input.activePi.start, 7)) {
        return {
          status: "completed",
          pi: input.activePi,
          completedAt: completionInside(input.activePi, n, input.now),
        };
      }
      return { status: "in_progress", pi: input.activePi, completedAt: null };
    case 4:
      return { status: "blocked", pi: input.activePi, completedAt: null };
    default:
      return { status: "in_progress", pi: input.activePi, completedAt: null };
  }
}

/**
 * Ein Abschlussdatum **innerhalb** des PI-Fensters.
 *
 * Der Large-Seed haelt im eigenen Kommentar fest, was passiert, wenn man das
 * nicht tut: „ein erster Versuch mit `now - 430` landete zwoelf Tage **nach**
 * dem Ende von PI 2 — ein Feature, das abgeschlossen wurde, nachdem sein PI
 * vorbei war."
 */
function completionInside(pi: DeliveryPi, n: number, now: Date): Date {
  const tage = Math.max(1, Math.round((pi.end.getTime() - pi.start.getTime()) / MS_DAY));
  // Im letzten Drittel, gestreut — so, wie ein PI tatsaechlich landet.
  const at = addDays(pi.start, Math.round(tage * 0.6) + (n % Math.max(1, Math.round(tage * 0.3))));
  // **Nie in der Zukunft.** Im laufenden PI liegt das letzte Drittel teilweise
  // noch vor uns; ein Abschluss von morgen waere eine erfundene Lieferung.
  return at > now ? addDays(now, -1 - (n % 5)) : at;
}

// ---------------------------------------------------------------------------
// Invarianten — der Teil, der verhindert, dass es wieder abdriftet
// ---------------------------------------------------------------------------

export interface DeliveredFeature {
  jobSize: number;
  status: FeatureStatus;
  piId: string | null;
  completedAt: Date | null;
}

/**
 * **Job Size ist Fibonacci.** Das Produkt laesst nichts anderes zu; ein Seed,
 * der es doch tut, schreibt einen Zustand, den kein Nutzer je erzeugen koennte.
 */
export function assertJobSizes(features: readonly DeliveredFeature[], label: string): void {
  const erlaubt = new Set<number>(JOB_SIZE_SCALE);
  const bad = features.filter((f) => !erlaubt.has(f.jobSize));
  if (bad.length > 0) {
    const werte = [...new Set(bad.map((f) => f.jobSize))].sort((a, b) => a - b);
    throw new Error(
      `Seed-Invariante verletzt (${label}): ${bad.length} Features mit Job Size ausserhalb ` +
        `Fibonacci — ${werte.join(", ")}. Erlaubt: ${JOB_SIZE_SCALE.join(", ")}.`,
    );
  }
}

export interface PiQuota {
  piId: string;
  name: string;
  status: PiStatus;
  geplant: number;
  fertig: number;
  quote: number;
}

/** Die Erfuellungsquote je PI — Σ Job Size fertig gegen Σ Job Size eingeplant. */
export function piQuotas(
  features: readonly DeliveredFeature[],
  pis: readonly (DeliveryPi & { name: string })[],
): PiQuota[] {
  return pis.map((p) => {
    const eigene = features.filter((f) => f.piId === p.id);
    const geplant = eigene.reduce((s, f) => s + f.jobSize, 0);
    const fertig = eigene
      .filter((f) => f.status === "completed")
      .reduce((s, f) => s + f.jobSize, 0);
    return {
      piId: p.id,
      name: p.name,
      status: p.status,
      geplant,
      fertig,
      quote: geplant === 0 ? 0 : fertig / geplant,
    };
  });
}

/**
 * **Die Lieferung ist verteilt, und sie ist nicht perfekt.**
 *
 * Zwei Regeln, und beide beschreiben genau das, was im Bestand schiefging:
 *
 *  - **Mehr als die Haelfte** der abgeschlossenen PIs traegt Arbeit. Gemessen
 *    waren sechs von zehn leer, weil fertige Features nur in zwei feste Rollen
 *    fielen.
 *  - **Nicht jedes** abgeschlossene PI liefert 100 %. Die alte Regel machte aus
 *    jedem eine perfekte Bilanz — ein Datensatz, in dem nie etwas danebengeht,
 *    kann keine Flaeche vorfuehren, die Abweichungen zeigt.
 *
 * **Bewusst keine Vollabdeckung.** Ein fruehes PI ohne Arbeit ist kein Fehler:
 * ein Programm faengt irgendwann an, und die Epics, die es traegt, reifen erst.
 * Diese Invariante darf nicht verlangen, was die Gate-Historie nicht hergibt —
 * sie wirft **mitten im Lauf**, also nach dem Loeschen der alten Daten.
 */
export function assertPiQuotas(quotas: readonly PiQuota[], label: string): void {
  const abgeschlossen = quotas.filter((q) => q.status === "completed");
  if (abgeschlossen.length === 0) return;

  const gefuellt = abgeschlossen.filter((q) => q.geplant > 0);
  if (gefuellt.length * 2 <= abgeschlossen.length) {
    const leer = abgeschlossen.filter((q) => q.geplant === 0).map((q) => q.name);
    throw new Error(
      `Seed-Invariante verletzt (${label}): nur ${gefuellt.length} von ${abgeschlossen.length} ` +
        `abgeschlossenen PIs tragen ueberhaupt ein Feature — leer: ${leer.join(", ")}. ` +
        `Der €-Satz je Job-Size-Punkt braucht Lieferung in mehreren Halbjahren.`,
    );
  }

  if (gefuellt.every((q) => q.quote >= 1)) {
    throw new Error(
      `Seed-Invariante verletzt (${label}): **jedes** gefuellte abgeschlossene PI liefert ` +
        `100 % (${gefuellt.map((q) => q.name).join(", ")}). Ein Datensatz ohne Abweichung ` +
        `kann keine Guardrail vorfuehren.`,
    );
  }
}
