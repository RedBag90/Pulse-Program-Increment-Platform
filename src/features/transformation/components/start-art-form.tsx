"use client";

import { useActionState, useState } from "react";
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

interface Props {
  valueStreams: Option[];
  rteUsers: Option[];
  canManage: boolean;
}

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Guided "launch an ART" flow — one form orchestrating ART + cadence + RTE + first PI. */
export function StartArtForm({ valueStreams, rteUsers, canManage }: Props) {
  const [state, formAction, isPending] = useActionState(startArtAction, {});

  const [valueStreamId, setValueStreamId] = useState(valueStreams[0]?.id ?? "");
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState("10");
  const [rteId, setRteId] = useState("");
  const [piName, setPiName] = useState("");
  const [piStart, setPiStart] = useState("");
  const [piEnd, setPiEnd] = useState("");

  function submit() {
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        valueStreamId,
        name,
        piCadenceWeeks: cadence,
        rteId: rteId || null,
        piName,
        piStartDate: piStart,
        piEndDate: piEnd,
      }),
    );
    formAction(fd);
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

  if (state.created) {
    return (
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
    );
  }

  const canSubmit = !isPending && valueStreamId && name.trim() && piName.trim() && piStart && piEnd;

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
          <Label htmlFor="sa-cadence">PI-Kadenz (Wochen)</Label>
          <Input
            id="sa-cadence"
            type="number"
            min={8}
            max={12}
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
          />
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

      <fieldset className="space-y-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Erstes Program Increment</legend>
        <div className="space-y-1.5">
          <Label htmlFor="sa-piname">PI-Name</Label>
          <Input
            id="sa-piname"
            value={piName}
            onChange={(e) => setPiName(e.target.value)}
            placeholder="z. B. PI 25.1"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sa-pistart">Start</Label>
            <Input
              id="sa-pistart"
              type="date"
              value={piStart}
              onChange={(e) => setPiStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sa-piend">Ende</Label>
            <Input
              id="sa-piend"
              type="date"
              value={piEnd}
              onChange={(e) => setPiEnd(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

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
