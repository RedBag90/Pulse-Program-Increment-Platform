/**
 * Die fünf Schritte, über die ein ART an sein Budget kommt — die Orientierung
 * „wo stehe ich, und auf wen warte ich".
 *
 * Baugleich zu `period-phases.ts`, mit **einem** wesentlichen Zusatz. Die Phasen
 * einer Kachel laufen an einem Ort in einer Rolle; diese Kette läuft über drei
 * Flächen und drei Rollen, und für vier von fünf Schritten kann der ART selbst
 * nichts tun. Eine Leiste, die nur sagt, *was* dran ist, führte ihn deshalb ins
 * Leere. Jede Phase trägt darum ihren `actor`.
 *
 * Der zweite Unterschied: die Sprungziele sind **ganze Routen**, keine
 * `?tab=`-Anhänge derselben Seite. Das geht erst, seit alle drei Flächen unter
 * `/budgeting` liegen.
 *
 * Rein, kein I/O.
 */

import { type PhaseState } from "@/modules/budgeting/domain/period-phases";

/** Wer handelt — als Tatsache. Wie sich das liest, entscheidet die Komponente. */
export const FUNDING_ACTORS = ["value_stream", "period", "art"] as const;
export type FundingActor = (typeof FUNDING_ACTORS)[number];

export interface FundingPhase {
  key: string;
  label: string;
  state: PhaseState;
  actor: FundingActor;
  /** Ganze Route — die Schritte liegen auf verschiedenen Flächen. */
  href: string | null;
  /** Warum der Schritt (noch) nicht drankommt — nur bei `blocked`. */
  blockedBy?: string;
  /** Zusatz für den letzten Schritt in der Wertstrom-Sicht („2 von 3"). */
  detail?: string;
}

export interface ArtPotFacts {
  artId: string;
  total: number;
  distributed: number;
}

export interface FundingPhaseFacts {
  valueStreamId: string;
  cycleKey: string;
  /** Es gibt mindestens eine aktive ART-Epic-Budget-Position. */
  hasBudgetItem: boolean;
  /** Die Kachel dieses Halbjahres, falls es eine gibt. */
  roundId: string | null;
  /** Die Positionen stehen als Kandidat auf der PB-Liste dieser Kachel. */
  onPbList: boolean;
  /** Der Wertstrom hat einen Zuspruch bekommen (Kachel abgeschlossen). */
  awarded: boolean;
  /** Der Zuspruch ist auf die Positionen aufgeteilt. */
  splitDone: boolean;
  /** Je ART sein zugesprochenes Budget und was davon verteilt ist. */
  arts: readonly ArtPotFacts[];
  /**
   * Gesetzt auf der ART-Fläche: dann ist Schritt 5 „sein" Schritt. Leer auf dem
   * Wertstrom — dort fasst Schritt 5 alle ARTs zusammen, und genau deshalb
   * braucht die Wertstrom-Fläche keinen ART-Wähler: die Schritte 1–4 sind
   * ohnehin Wertstrom-Schritte.
   */
  focusArtId?: string | undefined;
}

/**
 * Die fünf Phasen mit Zustand. `current` ist die **erste**, die weder erledigt
 * noch blockiert ist — daraus liest der Nutzer, was als Nächstes dran ist, ohne
 * dass irgendwo ein Zeiger gespeichert werden müsste.
 */
export function artFundingPhases(f: FundingPhaseFacts): FundingPhase[] {
  const vsHref = `/budgeting/value-streams/${f.valueStreamId}?tab=betrieb`;
  const roundHref = (tab: string) =>
    f.roundId == null ? null : `/budgeting/periods/${f.roundId}?tab=${tab}`;

  const focus =
    f.focusArtId == null ? null : (f.arts.find((a) => a.artId === f.focusArtId) ?? null);
  const withBudget = f.arts.filter((a) => a.total > 0);
  const done = withBudget.filter((a) => a.distributed >= a.total);

  const distributed =
    focus != null
      ? focus.total > 0 && focus.distributed >= focus.total
      : withBudget.length > 0 && done.length === withBudget.length;

  const raw: Array<Omit<FundingPhase, "state"> & { done: boolean; blockedBy?: string }> = [
    {
      key: "budget",
      label: "ART-Epic-Budget",
      actor: "value_stream",
      href: vsHref,
      done: f.hasBudgetItem,
    },
    {
      key: "pb_list",
      label: "Auf der PB-Liste",
      actor: "period",
      href: roundHref("setup"),
      done: f.onPbList,
      ...(f.hasBudgetItem
        ? f.roundId == null
          ? { blockedBy: `Für ${f.cycleKey} gibt es keine Kachel.` }
          : {}
        : { blockedBy: "Erst mit einem ART-Epic-Budget." }),
    },
    {
      key: "award",
      label: "Zuspruch",
      actor: "period",
      href: roundHref("ergebnis"),
      done: f.awarded,
      ...(f.onPbList ? {} : { blockedBy: "Erst auf der PB-Liste einer Kachel." }),
    },
    {
      key: "split",
      label: "Aufteilen",
      actor: "value_stream",
      href: vsHref,
      done: f.splitDone,
      ...(f.awarded ? {} : { blockedBy: "Die Kachel ist noch nicht abgeschlossen." }),
    },
    {
      key: "distribute",
      label: "Verteilen",
      actor: "art",
      href:
        focus != null
          ? `/budgeting/arts/${focus.artId}?tab=verteilen`
          : `/budgeting/arts?vs=${f.valueStreamId}`,
      done: distributed,
      ...(f.splitDone ? {} : { blockedBy: "Der Zuspruch ist noch nicht aufgeteilt." }),
      ...(focus == null && withBudget.length > 0
        ? { detail: `${done.length} von ${withBudget.length}` }
        : {}),
    },
  ];

  let currentTaken = false;
  return raw.map(({ done: isDone, blockedBy, ...rest }) => {
    if (isDone) return { ...rest, state: "done" as const };
    if (blockedBy !== undefined) return { ...rest, state: "blocked" as const, blockedBy };
    if (!currentTaken) {
      currentTaken = true;
      return { ...rest, state: "current" as const };
    }
    return { ...rest, state: "open" as const };
  });
}

/** Kurzform für Listen — „Schritt 5 · Verteilen", wie `phaseSummary` bei der Kachel. */
export function fundingSummary(phases: readonly FundingPhase[]): string {
  const i = phases.findIndex((p) => p.state === "current");
  if (i === -1) {
    return phases.every((p) => p.state === "done")
      ? "fertig"
      : (phases.find((p) => p.state === "blocked")?.label ?? "—");
  }
  return `Schritt ${i + 1} · ${phases[i]!.label}`;
}
