"use client";

import { useActionState, useState, startTransition } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { startArtAction } from "@/features/transformation/actions/start-art";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Option {
  id: string;
  label: string;
}

interface TimelineOption {
  id: string;
  name: string;
  cadenceWeeks: number;
}

interface Props {
  valueStreams: Option[];
  rteUsers: Option[];
  timelines: TimelineOption[];
  canManage: boolean;
}

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Guided „ART starten"-Flow. Legt ART + Timeline-Subscription + (optional) RTE
 * in einem Formular an. Seit dem Timeline-Rollout entstehen PIs zentral aus
 * dem PI-Standard auf der Timeline — das Formular fragt keine PI-Felder mehr
 * ab und zeigt nach Erfolg den Weg zur Standard-Anwendung.
 */
export function StartArtForm({ valueStreams, rteUsers, timelines, canManage }: Props) {
  const [state, formAction, isPending] = useActionState(startArtAction, {});

  const [valueStreamId, setValueStreamId] = useState(valueStreams[0]?.id ?? "");
  const [name, setName] = useState("");
  const [timelineId, setTimelineId] = useState(timelines[0]?.id ?? "");
  const [rteId, setRteId] = useState("");

  function submit() {
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        valueStreamId,
        name,
        timelineId,
        rteId: rteId || null,
      }),
    );
    startTransition(() => formAction(fd));
  }

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        Nur Administrator:innen können einen ART starten.
      </p>
    );
  }

  if (valueStreams.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Lege zuerst einen Wertstrom an — ein ART gehört immer zu einem Wertstrom.
      </p>
    );
  }

  if (timelines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Lege zuerst eine Timeline an —{" "}
        <Link href="/structure?tab=timeline" className="text-primary hover:underline">
          Struktur › Timeline
        </Link>
        . ARTs übernehmen die Kadenz ihrer Timeline; PIs entstehen anschließend aus dem PI-Standard,
        den du auf die Timeline anwendest.
      </p>
    );
  }

  if (state.created) {
    return (
      <div className="space-y-2">
        <p role="status" className="flex items-center gap-2 text-sm text-emerald-700">
          ART gestartet.
          {state.created.href && (
            <Link
              href={state.created.href}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Zum ART <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          PIs entstehen jetzt aus dem PI-Standard, der auf die Timeline angewendet wird —{" "}
          <Link href="/structure?tab=timeline" className="text-primary hover:underline">
            Struktur › Timeline → Standard anwenden
          </Link>
          .
        </p>
      </div>
    );
  }

  const canSubmit = !isPending && valueStreamId && name.trim() && timelineId;

  return (
    <div className="max-w-xl space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="sa-vs">Wertstrom</Label>
        <select
          id="sa-vs"
          className={SELECT}
          value={valueStreamId}
          onChange={(e) => setValueStreamId(e.target.value)}
        >
          {valueStreams.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sa-name">ART-Name</Label>
        <Input id="sa-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sa-timeline">Timeline</Label>
          <select
            id="sa-timeline"
            className={SELECT}
            value={timelineId}
            onChange={(e) => setTimelineId(e.target.value)}
          >
            {timelines.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.cadenceWeeks} Wo)
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sa-rte">RTE (optional)</Label>
          <select
            id="sa-rte"
            className={SELECT}
            value={rteId}
            onChange={(e) => setRteId(e.target.value)}
          >
            <option value="">— niemand —</option>
            {rteUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        PIs werden nicht hier angelegt — sie entstehen aus dem PI-Standard, der auf die gewählte
        Timeline angewendet wird.{" "}
        <Link href="/structure?tab=timeline" className="text-primary hover:underline">
          Mehr unter Struktur › Timeline
        </Link>
        .
      </p>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="button" disabled={!canSubmit} onClick={submit}>
        {isPending ? "Startet…" : "ART starten"}
      </Button>
    </div>
  );
}
