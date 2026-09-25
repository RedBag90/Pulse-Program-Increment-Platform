"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, startTransition } from "react";
import {
  ArrowUp,
  ArrowRight,
  Check,
  Circle,
  CircleDot,
  LifeBuoy,
  ListChecks,
  Undo2,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  requestGateTransitionAction,
  decideGateTransitionAction,
  withdrawGateTransitionAction,
} from "@/modules/work/features/portfolio/actions/stage-gate";
import { setEpicHelpRequestedAction } from "@/modules/work/features/portfolio/actions/epic";
import { CRITERION_TARGET } from "@/modules/work/domain/gate-criterion-target";
import { gateStepLabel } from "@/modules/work/domain/stage-gate";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { EpicGateSlice } from "@/modules/work/server/views/epic-detail";
import {
  GatePartyPicker,
  type TenantApprover,
} from "@/modules/work/features/portfolio/components/approver-picker";
import { GateRevertDialog } from "./gate-revert-dialog";
import { ClassificationDriftDialog, type DriftInfo } from "./classification-drift-dialog";

/**
 * Die **eine** Affordanz für den Reifegrad-Wechsel.
 *
 * Vorher gab es vier: ein Vorschlags-Banner, zwei fest verdrahtete Buttons im
 * Timeline-Tab (je einer für L1→L2 und L3→L4) und einen eigenen Impact-Dialog
 * für L4→L5 — jede mit eigener Sichtbarkeitsregel, eine davon mit einer
 * client-seitigen Kopie der Übergangsregeln. Hier ist es ein Vorgang mit drei
 * Zuständen, die sich gegenseitig ausschliessen:
 *
 *   1. kein Antrag offen  → Kriterien-Checkliste + „Push beantragen"
 *   2. Antrag offen       → wer noch fehlt + „Antrag zurückziehen"
 *   3. ich bin Abnehmer   → Freigeben / In Klärung / Ablehnen
 *
 * Welcher Zustand gilt, entscheidet die Slice im Read-Model — nicht diese
 * Komponente.
 */

const PRIMARY =
  "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
const GHOST =
  "inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50";
/**
 * Zustimmen · Ablehnen · Zurückgeben — die drei Entscheidungen am Tor, und
 * damit die drei semantischen Rollen aus ADR-0021. Vorher standen hier acht
 * rohe Palettenwerte (Emerald, Rot, Amber) **ohne** `dark:`-Partner: im
 * Dunkelmodus leuchtende Flecken auf dunklem Grund.
 */
const APPROVE =
  "rounded-md bg-success px-3 py-1.5 text-xs font-medium text-background hover:bg-success/90 disabled:opacity-50";
const REJECT =
  "rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive-surface disabled:opacity-50";
const CLARIFY =
  "rounded-md border border-warning/40 px-3 py-1.5 text-xs font-medium text-warning hover:bg-warning-surface disabled:opacity-50";

// Hier werden **Schritte** benannt, nicht Major-Gates: `L4` heißt deshalb
// „L4.1 Umsetzung läuft" — dieselbe Zahl, die danach am Epic steht.
/**
 * **Kein `gateLabel`-Alias mehr.**
 *
 * Hier stand `const gateLabel = gateStepLabel;` — ein Name, der über seinen
 * Rückgabewert log: `gateStepLabel` liefert einen **Schlüssel**, kein Wort. Wer
 * „Label" liest, schreibt `{gateLabel(x)}` und nicht `{gateStepLabel(x, t)}`,
 * und genau das ist an drei Stellen passiert: auf dem Bildschirm stand
 * wörtlich „work.gateStep.analysis". Der Compiler sieht das nicht — ein
 * Schlüssel ist eine gültige Zeichenkette.
 */

interface Props {
  epicId: string;
  gate: EpicGateSlice;
  /** Personenpool des Mandanten — Quelle des Abnehmer-Pickers am Antrag. */
  approvers: TenantApprover[];
  /** userId → Anzeigename, wie überall auf der Epic-Seite. */
  userLabels: Record<string, string>;
  /**
   * Abweichung zwischen der beim Anlegen hinterlegten Erwartung und der aus dem
   * Business Case abgeleiteten Klasse. Gesetzt nur, wenn es eine gibt — dann
   * tritt vor dem L3.1-Antrag ein Dialog dazwischen.
   */
  classDrift?: DriftInfo | null | undefined;
}

export function EpicGateCard({ epicId, gate, approvers, userLabels, classDrift }: Props) {
  const t = useTranslations();
  if (gate.disabled) return null;

  return (
    /* Die Akzentschiene hebt die Kachel aus der Reihe der uebrigen: sie ist die
       einzige Flaeche der Seite, die sagt, was als Naechstes zu tun ist, trug
       aber dieselbe neutrale Huelle wie jede andere.
       **Schiene, kein Umriss** — dieselbe Geste, mit der `SectionCard.atGate`
       die Kacheln des aktuellen Reifegrads markiert, und die einzige, die
       ADR-0021 an einer Karte zulaesst (ein `border` ringsum waere die
       handgerollte Karte, die `Card` ersetzen soll). */
    <div className="space-y-3 rounded-lg border-l-2 border-l-primary bg-card p-3.5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {/* Die Ueberschrift nennt das Ziel und sagt, wofuer die Liste
              darunter da ist. Vorher stand hier eine Zustandsmeldung
              („Reifegrad: … → naechster: …") — richtig, aber keine Ansage.
              Am Endgate gibt es nichts zu tun; dort entfaellt sie, statt
              „To-dos fuer nichts" zu behaupten. */}
          {gate.next && (
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <ListChecks className="size-4 shrink-0 text-primary" aria-hidden />
              {t("work.gate.todosFor", { step: gateStepLabel(gate.next, t) })}
            </h2>
          )}
          <p className={gate.next ? "mt-0.5 text-xs text-muted-foreground" : "text-sm"}>
            <span className={gate.next ? "" : "font-medium"}>{t("work.gate.reifegradHeute")}</span>{" "}
            {/* `gateLabel` liefert einen **Katalog-Schlüssel**, kein Wort. Ohne
                das `t()` stand hier bis September 2026 wörtlich
                „work.gateStep.analysis" auf dem Bildschirm — die Überschrift
                drei Zeilen höher macht es richtig, diese Zeile war die
                Ausnahme. Genau die Art Fehler, die kein Compiler sieht: ein
                Schlüssel ist eine gültige Zeichenkette. */}
            {gateStepLabel(gate.current, t)}
          </p>
        </div>
        {gate.canRevert && <GateRevertDialog epicId={epicId} current={gate.current} />}
      </div>

      {gate.openRequest ? (
        <OpenRequest gate={gate} userLabels={userLabels} />
      ) : (
        <NoRequest
          epicId={epicId}
          gate={gate}
          approvers={approvers}
          userLabels={userLabels}
          classDrift={classDrift ?? null}
        />
      )}

      {gate.canRequestHelp && <HelpRequestControl epicId={epicId} requested={gate.helpRequested} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// „I need help" — Owner-only
// ---------------------------------------------------------------------------

/**
 * Der Epic-Owner bittet um Unterstützung: ankreuzen stempelt `helpRequestedAt`,
 * und in „Meine Tasks" erscheint bei VMO und Portfolio-Management ein Hinweis.
 * Abhaken nimmt die Bitte zurück.
 */
function HelpRequestControl({ epicId, requested }: { epicId: string; requested: boolean }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(setEpicHelpRequestedAction, {});

  function toggle(next: boolean) {
    const fd = new FormData();
    fd.set("id", epicId);
    fd.set("value", next ? "true" : "false");
    startTransition(() => action(fd));
  }

  return (
    <div className="space-y-1.5 border-t border-border pt-3">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={requested}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
          className="size-4 rounded-sm border-input"
        />
        <span className="inline-flex items-center gap-1.5 font-medium">
          <LifeBuoy className="size-3.5 text-muted-foreground" />
          {t("work.gate.iNeedHelp")}
        </span>
      </label>
      {requested && (
        <p className="pl-6 text-meta text-muted-foreground">
          {t("work.gate.vmoUndPortfolioManagement")}
        </p>
      )}
      {state.error && <p className="pl-6 text-xs text-destructive">{state.error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zustand 1 — kein Antrag offen
// ---------------------------------------------------------------------------

function NoRequest({
  epicId,
  gate,
  approvers,
  userLabels,
  classDrift,
}: {
  epicId: string;
  gate: Extract<EpicGateSlice, { disabled: false }>;
  approvers: TenantApprover[];
  userLabels: Record<string, string>;
  classDrift: DriftInfo | null;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(requestGateTransitionAction, {});
  const [driftOpen, setDriftOpen] = useState(false);
  // Besetzung der Parteien — nur an den Schritten, die eine je Epic zulassen
  // (heute L2 → L3.1). Vorbelegt aus der Wertstrom-Governance.
  const staffing = gate.partyStaffing;
  const [parties, setParties] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    for (const { role } of staffing?.roles ?? []) {
      init[role] = new Set(staffing?.defaults[role] ?? []);
    }
    return init;
  });

  function toggleParty(role: string, userId: string) {
    setParties((prev) => {
      const next = new Set(prev[role] ?? []);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return { ...prev, [role]: next };
    });
  }

  if (!gate.next) {
    return (
      <p className="text-xs text-muted-foreground">{t("work.gate.endgateErreichtKeinWeiterer")}</p>
    );
  }

  const blocked = gate.readiness ? !gate.readiness.ready : false;

  /**
   * Der Antrag selbst — vom Klick getrennt, weil an L3.1 der Dialog
   * dazwischentritt, wenn der Business Case die Erwartung widerlegt.
   */
  function submit() {
    setDriftOpen(false);
    const fd = new FormData();
    fd.set("epicId", epicId);
    fd.set("toGate", gate.next as string);
    // `<rolle>:<userId>` — die Rolle muss mit, sonst steht auf der
    // Abnahme-Zeile hinterher niemand mehr für „Business Owner".
    for (const [role, userIds] of Object.entries(parties)) {
      for (const userId of userIds) fd.append("approvers", `${role}:${userId}`);
    }
    startTransition(() => action(fd));
  }

  // Nur an L3.1: dort entsteht die Klasse, und dort wird die Abweichung
  // erstmals sichtbar.
  const driftBlocks = classDrift != null && classDrift.drift !== "none" && gate.next === "L2";

  /**
   * **Erfüllte wiederkehrende Kriterien fallen heraus.**
   *
   * „Epic Owner ist benannt" steht in drei Toren hintereinander und bleibt
   * nach der ersten Benennung dauerhaft grün — in jeder Folge-Checkliste ein
   * abgehakter Punkt, der nichts mehr zu tun gibt. Erfüllte Kriterien, die nur
   * in *einem* Tor vorkommen, bleiben stehen: ihr Haken sagt, dass der Schritt
   * getan ist.
   */
  const sichtbareKriterien = (gate.readiness?.criteria ?? []).filter(
    (c) => !(c.recurring && c.satisfied),
  );

  return (
    <div className="space-y-3">
      {sichtbareKriterien.length > 0 && (
        <ul className="space-y-1.5">
          {sichtbareKriterien.map((c) => {
            const target = CRITERION_TARGET[c.key];
            return (
              <li
                key={c.key}
                /* Die Betonung liegt auf **offen vs. erledigt**, nicht auf
                   blockierend vs. beratend. Eine Aufgabenliste soll zeigen, was
                   noch aussteht; mit vier beratenden von fuenf Punkten waere
                   die alte Achse fast vollstaendig grau geworden. */
                className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5 text-sm ${
                  c.satisfied ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                <span className="flex min-w-0 items-start gap-2">
                  {c.satisfied ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex flex-wrap items-baseline gap-x-1.5">
                    {c.helpKey ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2" />
                          }
                        >
                          {t(c.labelKey)}
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{t(c.helpKey)}</TooltipContent>
                      </Tooltip>
                    ) : (
                      t(c.labelKey)
                    )}
                    {/* Markiert wird die **Ausnahme**. Solange nur ein Punkt
                        blockiert, ist „Pflicht" an ihm eine Information —
                        „(optional)" an allen anderen war Tapete. */}
                    {c.blocking && (
                      <span className="rounded-sm bg-muted px-1.5 py-0.5 text-label font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        {t("work.gate.pflicht")}
                      </span>
                    )}
                  </span>
                </span>
                {/* Der Weg zum Reiter stand bis September 2026 in einem
                    Popover hinter einem Text in halber Deckkraft. Jetzt steht
                    er in der Zeile. */}
                {target && (
                  <Link
                    href={target.href(epicId)}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {t(target.labelKey)}
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {staffing && gate.canRequest && (
        <GatePartyPicker
          staffing={staffing}
          approvers={approvers}
          selected={parties}
          onToggle={toggleParty}
          userLabels={userLabels}
        />
      )}

      {gate.canRequest && (
        <button
          type="button"
          onClick={() => (driftBlocks ? setDriftOpen(true) : submit())}
          disabled={pending || blocked}
          title={
            blocked
              ? gate.readiness?.criteria
                  .filter((c) => c.blocking && !c.satisfied)
                  .map((c) => t(c.labelKey))
                  .join("; ")
              : undefined
          }
          className={PRIMARY}
        >
          <ArrowUp className="size-3.5" />
          {pending ? "…" : t("work.gate.pushBeantragen", { step: gateStepLabel(gate.next, t) })}
        </button>
      )}

      {state.error && <p className="text-xs text-destructive">{state.error}</p>}

      {driftBlocks && classDrift && (
        <ClassificationDriftDialog
          epicId={epicId}
          info={classDrift}
          open={driftOpen}
          onOpenChange={setDriftOpen}
          onProceed={submit}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zustand 2 + 3 — Antrag offen
// ---------------------------------------------------------------------------

function OpenRequest({
  gate,
  userLabels,
}: {
  gate: Extract<EpicGateSlice, { disabled: false }>;
  userLabels: Record<string, string>;
}) {
  const request = gate.openRequest;
  const [withdrawState, withdraw, withdrawing] = useActionState(withdrawGateTransitionAction, {});
  if (!request) return null;

  const t = useTranslations();
  const name = (id: string) => userLabels[id] ?? "Unbekannt";

  function onWithdraw() {
    if (!request) return;
    const fd = new FormData();
    fd.set("transitionId", request.id);
    fd.set("reason", "Vom Antragsteller zurückgezogen");
    startTransition(() => withdraw(fd));
  }

  return (
    <div className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-3">
      <p className="text-xs">
        <span className="font-medium">
          {t("work.gate.pushBeantragt", { step: gateStepLabel(request.toGate, t) })}
        </span>{" "}
        {t("work.gate.von")} {name(request.requestedBy)}
        {request.quorum === "any" && (
          <span className="text-muted-foreground">{t("work.gate.eineAbnahmeGenuegt")}</span>
        )}
      </p>
      {request.reason && <p className="text-xs text-muted-foreground">„{request.reason}"</p>}

      <ul className="space-y-1">
        {request.approvers.map((a) => (
          <li key={a.id} className="flex items-start gap-2 text-xs">
            {a.status === "approved" ? (
              <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
            ) : a.status === "rejected" ? (
              <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            ) : (
              <CircleDot className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
            )}
            <span>
              {name(a.userId)}
              {a.roleLabelKey && (
                <span className="text-muted-foreground"> ({t(a.roleLabelKey)})</span>
              )}
              {a.comment && <span className="text-muted-foreground"> — „{a.comment}"</span>}
            </span>
          </li>
        ))}
      </ul>

      {gate.viewerMustDecide && <DecideButtons transitionId={request.id} />}

      {gate.canWithdraw && !gate.viewerMustDecide && (
        <button type="button" onClick={onWithdraw} disabled={withdrawing} className={GHOST}>
          <Undo2 className="size-3.5" />
          {withdrawing ? "…" : "Antrag zurückziehen"}
        </button>
      )}

      {withdrawState.error && <p className="text-xs text-destructive">{withdrawState.error}</p>}
    </div>
  );
}

/**
 * Das Drei-Knopf-Muster aus „Meine Freigaben" — bewusst dieselbe Geste, damit
 * eine Gate-Abnahme sich anfühlt wie jede andere Abnahme im Produkt. Ablehnen
 * und In-Klärung verlangen eine Begründung.
 */
function DecideButtons({ transitionId }: { transitionId: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(decideGateTransitionAction, {});
  const [open, setOpen] = useState<"reject" | "clarification" | null>(null);
  const [comment, setComment] = useState("");

  function send(decision: "approve" | "reject", text?: string) {
    const fd = new FormData();
    fd.set("transitionId", transitionId);
    fd.set("decision", decision);
    if (text?.trim()) fd.set("comment", text.trim());
    startTransition(() => action(fd));
  }

  if (open) {
    const label = open === "reject" ? "Ablehnen" : "In Klärung schicken";
    return (
      <div className="space-y-2 rounded-md border border-warning/30 bg-warning-surface/60 p-2.5">
        <p className="text-xs font-medium">{label} — bitte begründen</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={t("work.gate.begruendungErforderlich")}
          className="w-full rounded-md border border-input px-2 py-1 text-xs"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending || !comment.trim()}
            className={open === "reject" ? REJECT : CLARIFY}
            onClick={() => send("reject", comment)}
          >
            {pending ? "…" : label}
          </button>
          <button
            type="button"
            disabled={pending}
            className={GHOST}
            onClick={() => {
              setOpen(null);
              setComment("");
            }}
          >
            {t("work.gate.abbrechen")}
          </button>
        </div>
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">{t("work.gate.duBistAlsAbnehmende")}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className={APPROVE}
          onClick={() => send("approve")}
        >
          {pending ? "…" : "Freigeben"}
        </button>
        <button
          type="button"
          disabled={pending}
          className={CLARIFY}
          onClick={() => setOpen("clarification")}
        >
          {t("work.gate.inKlaerungSchicken")}
        </button>
        <button
          type="button"
          disabled={pending}
          className={REJECT}
          onClick={() => setOpen("reject")}
        >
          {t("work.gate.ablehnen")}
        </button>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </div>
  );
}
