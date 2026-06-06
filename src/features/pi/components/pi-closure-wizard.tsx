"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { setPiClosureMetaAction, transitionPiAction } from "@/features/pi/actions/pi";
import { setImpedimentRoamAction } from "@/features/impediment/actions/impediment";

interface OpenImpediment {
  id: string;
  title: string;
  severity: string;
  roamStatus: string;
  artId: string;
}

interface Props {
  piId: string;
  piName: string;
  systemDemoAt: string | null;
  inspectAdaptAt: string | null;
  retrospectiveNotes: string | null;
  /** Vorab vom Server berechnete Pre-Check-Verstöße — nur informativ; der Server erzwingt sie ein zweites Mal. */
  issues: string[];
  openImpediments: OpenImpediment[];
}

type Step = "objectives" | "roam" | "events" | "retro" | "confirm";
const STEPS: { id: Step; label: string }[] = [
  { id: "objectives", label: "1. Ziele bewerten" },
  { id: "roam", label: "2. Risks ROAMen" },
  { id: "events", label: "3. Demo & I&A" },
  { id: "retro", label: "4. Retrospektive" },
  { id: "confirm", label: "5. Abschließen" },
];

const ROAM_LABEL: Record<string, string> = {
  open: "Offen",
  resolved: "Resolved",
  owned: "Owned",
  accepted: "Accepted",
  mitigated: "Mitigated",
};

/**
 * PI-Closure-Wizard. Wird vom CTA „PI abschließen" auf der
 * Objectives-Seite geöffnet, sobald `endDate` ≤ heute + 14 Tage. Der
 * Wizard kapselt die vier Pre-Checks (Confidence bewertet · Risks
 * ROAMed · Demo & I&A terminiert · Retrospektive festgehalten) und
 * ruft `pi.complete` erst, wenn alle vier Server-Checks grün sind.
 */
export function PiClosureWizard({
  piId,
  piName,
  systemDemoAt,
  inspectAdaptAt,
  retrospectiveNotes,
  issues,
  openImpediments,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("objectives");
  const [demo, setDemo] = useState(systemDemoAt ?? "");
  const [ia, setIa] = useState(inspectAdaptAt ?? "");
  const [retro, setRetro] = useState(retrospectiveNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Issue-Liste matches the server-side evaluator. We surface them so
  // Anna can see at a glance what's blocking the close button.
  const hasObjectiveIssue = issues.some((i) => i.includes("Objective"));
  const hasRoamIssue = issues.some((i) => i.includes("ROAM"));
  const hasDemoIssue = issues.some((i) => i.includes("System-Demo"));
  const hasIaIssue = issues.some((i) => i.includes("Inspect"));
  const hasRetroIssue = issues.some((i) => i.includes("Retrospektive"));
  const ready = issues.length === 0;

  function saveEvents() {
    const fd = new FormData();
    fd.set("id", piId);
    if (demo) fd.set("systemDemoAt", demo);
    if (ia) fd.set("inspectAdaptAt", ia);
    startTransition(async () => {
      setError(null);
      await setPiClosureMetaAction({}, fd);
    });
  }

  function saveRetro() {
    const fd = new FormData();
    fd.set("id", piId);
    fd.set("retrospectiveNotes", retro);
    startTransition(async () => {
      setError(null);
      await setPiClosureMetaAction({}, fd);
    });
  }

  function complete() {
    startTransition(async () => {
      setError(null);
      const res = await transitionPiAction(piId, "completed");
      if (res.error) setError(res.error);
      else setOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={ready ? "default" : "outline"}
        onClick={() => setOpen(true)}
        className={ready ? "" : "border-amber-300 text-amber-800"}
      >
        {ready ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
        PI abschließen
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>PI abschließen — {piName}</DialogTitle>
          </DialogHeader>

          <nav className="flex flex-wrap gap-2 border-b pb-3">
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`rounded-md px-3 py-1 text-xs font-medium ${
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="min-h-[240px] py-3 text-sm">
            {step === "objectives" && (
              <StepObjectives blocked={hasObjectiveIssue} issues={issues} />
            )}
            {step === "roam" && <StepRoam impediments={openImpediments} blocked={hasRoamIssue} />}
            {step === "events" && (
              <StepEvents
                demo={demo}
                ia={ia}
                onDemo={setDemo}
                onIa={setIa}
                onSave={saveEvents}
                pending={pending}
                demoIssue={hasDemoIssue}
                iaIssue={hasIaIssue}
              />
            )}
            {step === "retro" && (
              <StepRetro
                notes={retro}
                onChange={setRetro}
                onSave={saveRetro}
                pending={pending}
                blocked={hasRetroIssue}
              />
            )}
            {step === "confirm" && (
              <StepConfirm ready={ready} issues={issues} onComplete={complete} pending={pending} />
            )}
          </div>

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              <X className="size-3.5" /> Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StepObjectives({ blocked, issues }: { blocked: boolean; issues: string[] }) {
  const msg = issues.find((i) => i.includes("Objective"));
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground">
        Jedes committed Objective braucht eine Confidence-Bewertung (1‒5). Die Bewertung passiert
        direkt auf der Objectives-Liste unter dem Wizard — schließe den Dialog, setze die
        Confidence, öffne ihn erneut.
      </p>
      {blocked ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          {msg ?? "Confidence-Bewertung fehlt."}
        </p>
      ) : (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
          ✓ Alle committed Objectives sind bewertet.
        </p>
      )}
    </div>
  );
}

function StepRoam({ impediments, blocked }: { impediments: OpenImpediment[]; blocked: boolean }) {
  const open = impediments.filter((i) => i.roamStatus === "open");
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground">
        Jedes noch offene / eskalierte Impediment dieses PIs braucht einen ROAM-Status.
      </p>
      {open.length === 0 ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
          ✓ Alle Impediments sind ROAMed.
        </p>
      ) : (
        <ul className="space-y-2">
          {open.map((imp) => (
            <RoamRow key={imp.id} imp={imp} />
          ))}
        </ul>
      )}
      {blocked && open.length > 0 && (
        <p className="text-xs text-amber-700">
          Solange ein Impediment „Offen" ist, bleibt der PI-Abschluss gesperrt.
        </p>
      )}
    </div>
  );
}

function RoamRow({ imp }: { imp: OpenImpediment }) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(imp.roamStatus);
  const [err, setErr] = useState<string | null>(null);

  function pick(roamStatus: string) {
    const prev = current;
    setCurrent(roamStatus);
    const fd = new FormData();
    fd.set("id", imp.id);
    fd.set("artId", imp.artId);
    fd.set("roamStatus", roamStatus);
    startTransition(async () => {
      setErr(null);
      const res = await setImpedimentRoamAction({}, fd);
      if (res.error) {
        setCurrent(prev);
        setErr(res.error);
      }
    });
  }

  return (
    <li className="rounded-md border bg-card px-3 py-2">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium" title={imp.title}>
            {imp.title}
          </p>
          <p className="text-[11px] text-muted-foreground">Schwere: {imp.severity}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {(["resolved", "owned", "accepted", "mitigated"] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => pick(s)}
              className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                current === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-muted/40 hover:bg-muted"
              }`}
            >
              {ROAM_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      {err && (
        <p role="alert" className="mt-1 text-[10px] text-destructive">
          {err}
        </p>
      )}
    </li>
  );
}

function StepEvents({
  demo,
  ia,
  onDemo,
  onIa,
  onSave,
  pending,
  demoIssue,
  iaIssue,
}: {
  demo: string;
  ia: string;
  onDemo: (v: string) => void;
  onIa: (v: string) => void;
  onSave: () => void;
  pending: boolean;
  demoIssue: boolean;
  iaIssue: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground">
        Termine für den System Demo und für Inspect &amp; Adapt festhalten.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium">
          System Demo
          <input
            type="date"
            value={demo}
            onChange={(e) => onDemo(e.target.value)}
            className={`rounded-md border px-2 py-1 text-sm ${demoIssue ? "border-amber-400" : "border-input"}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Inspect &amp; Adapt
          <input
            type="date"
            value={ia}
            onChange={(e) => onIa(e.target.value)}
            className={`rounded-md border px-2 py-1 text-sm ${iaIssue ? "border-amber-400" : "border-input"}`}
          />
        </label>
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={pending} onClick={onSave}>
          Termine speichern
        </Button>
      </div>
    </div>
  );
}

function StepRetro({
  notes,
  onChange,
  onSave,
  pending,
  blocked,
}: {
  notes: string;
  onChange: (v: string) => void;
  onSave: () => void;
  pending: boolean;
  blocked: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground">
        Lessons Learned aus diesem PI — wird im Cockpit als Closure-Notiz mitgeführt.
      </p>
      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        maxLength={10_000}
        placeholder="Was lief gut? Was nehmen wir mit?"
        className={`w-full rounded-md border px-3 py-2 text-sm ${blocked ? "border-amber-400" : "border-input"}`}
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={pending} onClick={onSave}>
          Notizen speichern
        </Button>
      </div>
    </div>
  );
}

function StepConfirm({
  ready,
  issues,
  onComplete,
  pending,
}: {
  ready: boolean;
  issues: string[];
  onComplete: () => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-3">
      {ready ? (
        <>
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
            ✓ Alle Pre-Checks grün — das PI ist abschlussreif.
          </p>
          <div className="flex justify-end">
            <Button type="button" disabled={pending} onClick={onComplete}>
              <CheckCircle2 className="size-4" /> PI jetzt abschließen
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
            PI-Abschluss noch nicht möglich — {issues.length} offene Punkte:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-amber-900">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
