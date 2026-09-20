"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { createFeatureAction } from "@/modules/work/features/feature/actions/feature";
import { useCreateResult } from "@/features/create/use-create-result";
import { useEntityOptions, optionsEndpoint } from "@/features/create/use-entity-options";
import type { CreateContext } from "@/features/create/create-context";
import type { ActionState } from "@/server/http/server-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FEATURE_TYPES, FEATURE_TYPE_LABEL } from "@/modules/work/domain/portfolio-guardrails";

const FIBONACCI = [1, 2, 3, 5, 8, 13, 20] as const;

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

interface Art {
  id: string;
  name: string;
  /** `/api/v1/arts` liefert ihn mit — er trägt die Kaskade. */
  valueStream?: { id: string } | null;
}
interface Epic {
  id: string;
  title: string;
  /** Wertstrom des Epics; er muss zum Wertstrom des ARTs passen. */
  valueStreamId?: string | null;
}
interface Pi {
  id: string;
  name: string;
}
interface Solution {
  id: string;
  name: string;
  valueStream?: { id: string } | null;
}
interface Person {
  id: string;
  label: string;
  roles: string[];
  /** Der Aufrufer — der Dialog belegt das Owner-Feld damit vor. */
  isSelf: boolean;
}

export interface CreateFeatureDialogProps {
  /** Controlled mode (global "+" menu). Omit to render a self-triggering button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Von der Seite vorgegebenes ART; ohne es wird eine Auswahl gezeigt. */
  artId?: string;
  /**
   * Wertstrom des vorgegebenen ARTs.
   *
   * Ohne ihn kann der Dialog die Epic-Liste nicht filtern — und genau das war
   * der Fehler: das Cockpit gab nur `artId` mit, die Liste zeigte deshalb
   * **jedes** Epic des Mandanten, auch aus fremden Wertströmen, und der Griff
   * daneben fiel erst am Service auf.
   */
  artValueStreamId?: string;
  /** Von der Seite vorgegebene Epics; ohne sie werden sie nachgeladen. */
  epics?: Epic[];
  /** Routen-Kontext zur Vorbelegung von ART / Epic im globalen „+"-Menü. */
  context?: CreateContext;
}

const initialState: ActionState = {};

/**
 * **Ein Feature anlegen.**
 *
 * Die Auswahl kaskadiert vom **ART** abwärts: das ART bestimmt den Wertstrom,
 * der Wertstrom die wählbaren Epics. Vorher lief es andersherum — das Epic war
 * Pflicht und die ART-Auswahl blieb gesperrt, bis eins gewählt war. Mit einem
 * **optionalen** Epic bräche das: ohne Epic kein Wertstrom, ohne Wertstrom kein
 * ART, und das Formular liesse sich gar nicht mehr abschicken.
 *
 * Wer den Dialog **aus einem Epic heraus** öffnet (Deliverables-Reiter,
 * Netzplan), pinnt damit weiterhin den Wertstrom — dort ist das Epic der
 * bekannte Anker, und die ART-Liste filtert sich danach. Es gewinnt also
 * jeweils die Angabe, die die Seite schon kennt.
 *
 * **Ohne Epic** entsteht ein *eigenständiges Feature*: ART-eigene Arbeit unter
 * keinem Portfolio-Vorhaben.
 */
export function CreateFeatureDialog({
  open,
  onOpenChange,
  artId,
  artValueStreamId,
  epics,
  context,
}: CreateFeatureDialogProps) {
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const [state, action, isPending] = useActionState(createFeatureAction, initialState);
  useCreateResult(state, () => setDialogOpen(false));

  const needArt = artId === undefined;
  const arts = useEntityOptions<Art>(
    needArt ? optionsEndpoint("art") : null,
    needArt && dialogOpen,
  );

  const needEpics = epics === undefined;
  const fetchedEpics = useEntityOptions<Epic>(
    needEpics ? optionsEndpoint("epic") : null,
    needEpics && dialogOpen,
  );

  const [artSel, setArtSel] = useState(context?.artId ?? "");
  const effectiveArtId = artId ?? artSel;

  // Der Wertstrom kommt von der Angabe, die die Seite schon kennt: dem
  // vorgegebenen ART, sonst dem vorgegebenen Epic, sonst dem hier gewählten ART.
  const pinnedVsId =
    artValueStreamId ?? (epics?.length === 1 ? (epics[0]!.valueStreamId ?? undefined) : undefined);
  const vsId = pinnedVsId ?? arts.data.find((a) => a.id === artSel)?.valueStream?.id ?? "";

  const artOptions = vsId ? arts.data.filter((a) => a.valueStream?.id === vsId) : arts.data;

  const allEpics = epics ?? fetchedEpics.data;
  const epicOptions = vsId ? allEpics.filter((e) => e.valueStreamId === vsId) : allEpics;

  const [epicSel, setEpicSel] = useState(
    context?.epicId ?? (epics?.length === 1 ? epics[0]!.id : ""),
  );
  // Selbstheilend: wechselt das ART, verschwindet ein nicht mehr passendes Epic
  // aus der Liste — dann darf es auch nicht mehr als Wert dranstehen.
  const epicId = epicOptions.some((e) => e.id === epicSel) ? epicSel : "";

  const pis = useEntityOptions<Pi>(
    optionsEndpoint("pi", effectiveArtId ? { artId: effectiveArtId } : {}),
    Boolean(effectiveArtId) && dialogOpen,
  );

  /**
   * **Die Verantwortung steht da, statt still abgeleitet zu werden.** Bisher
   * trug der Service den Anlegenden ein, ohne zu fragen — wer klickte, erbte
   * die Verantwortung. Jetzt ist er vorbelegt und änderbar.
   *
   * Eine **Suche**, kein Aufklappmenü: die Kandidatenliste ist jede Person des
   * Mandanten mit einer Rolle, in echten Mandanten schnell dreistellig viele.
   * Dieselbe Begründung wie in `FeatureOwnerAssign`, dasselbe Bedienelement.
   */
  const solutions = useEntityOptions<Solution>(optionsEndpoint("solution"), dialogOpen);
  const solutionOptions = vsId
    ? solutions.data.filter((x) => x.valueStream?.id === vsId)
    : solutions.data;

  const people = useEntityOptions<Person>(optionsEndpoint("user"), dialogOpen);
  const [ownerSel, setOwnerSel] = useState("");
  const self = people.data.find((p) => p.isSelf);
  useEffect(() => {
    if (self && ownerSel === "") setOwnerSel(self.id);
  }, [self, ownerSel]);

  const peopleOptions = useMemo<SearchSelectOption[]>(
    () =>
      people.data.map((p) => ({
        value: p.id,
        label: p.label,
        ...(p.roles.length > 0 ? { hint: p.roles.join(", ") } : {}),
      })),
    [people.data],
  );

  return (
    <>
      {!isControlled && (
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          Feature anlegen
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Feature anlegen</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            {artId !== undefined ? (
              <input type="hidden" name="artId" value={artId} />
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="f-art">
                  ART <span className="text-destructive">*</span>
                </Label>
                <select
                  id="f-art"
                  name="artId"
                  required
                  value={artSel}
                  onChange={(e) => setArtSel(e.target.value)}
                  disabled={arts.loading}
                  className={SELECT_CLASS}
                >
                  <option value="">
                    {arts.loading
                      ? "Wird geladen …"
                      : artOptions.length === 0
                        ? "Kein ART in diesem Wertstrom"
                        : "ART wählen …"}
                  </option>
                  {artOptions.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.name}
                    </option>
                  ))}
                </select>
                {arts.error && <p className="text-xs text-destructive">{arts.error}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="f-parent">Epic</Label>
              <select
                id="f-parent"
                name="parentId"
                value={epicId}
                onChange={(e) => setEpicSel(e.target.value)}
                disabled={fetchedEpics.loading}
                className={SELECT_CLASS}
              >
                <option value="">
                  {fetchedEpics.loading ? "Wird geladen …" : "— ohne Epic —"}
                </option>
                {epicOptions.map((epic) => (
                  <option key={epic.id} value={epic.id}>
                    {epic.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Ohne Epic wird es ein eigenständiges Feature — ART-eigene Arbeit, die unter keinem
                Portfolio-Vorhaben hängt.
              </p>
              {fetchedEpics.error && (
                <p className="text-xs text-destructive">{fetchedEpics.error}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-solution">Solution</Label>
              <select
                key={`sol-${vsId}`}
                id="f-solution"
                name="primarySolutionId"
                defaultValue=""
                disabled={!vsId || solutions.loading}
                className={SELECT_CLASS}
              >
                <option value="">
                  {!vsId
                    ? "Zuerst ein ART wählen …"
                    : solutions.loading
                      ? "Wird geladen …"
                      : "— später zuordnen —"}
                </option>
                {solutionOptions.map((sol) => (
                  <option key={sol.id} value={sol.id}>
                    {sol.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Ohne eigene Zuordnung gilt die Solution des Epics.
              </p>
              {solutions.error && <p className="text-xs text-destructive">{solutions.error}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-pi">Program Increment</Label>
              <select
                id="f-pi"
                name="piId"
                defaultValue=""
                disabled={!effectiveArtId || pis.loading}
                className={SELECT_CLASS}
              >
                <option value="">
                  {!effectiveArtId
                    ? "Zuerst ein ART wählen …"
                    : pis.loading
                      ? "Wird geladen …"
                      : "— Backlog —"}
                </option>
                {pis.data.map((pi) => (
                  <option key={pi.id} value={pi.id}>
                    {pi.name}
                  </option>
                ))}
              </select>
              {pis.error && <p className="text-xs text-destructive">{pis.error}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-owner">Verantwortlich</Label>
              {/*
                `SearchSelect` ist kein natives `<select>` — der Wert erreicht
                die FormData deshalb über ein verstecktes Feld.
              */}
              <input type="hidden" name="ownerId" value={ownerSel} />
              <SearchSelect
                value={ownerSel}
                onChange={setOwnerSel}
                options={peopleOptions}
                ariaLabel="Verantwortlich"
                placeholder={people.loading ? "Wird geladen …" : "Person wählen …"}
                emptyLabel="— niemand —"
                disabled={people.loading}
              />
              {people.error && <p className="text-xs text-destructive">{people.error}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-title">
                Titel <span className="text-destructive">*</span>
              </Label>
              <Input
                id="f-title"
                name="title"
                required
                maxLength={200}
                placeholder="z. B. Passwort per E-Mail zurücksetzen"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-desc">Beschreibung</Label>
              <Textarea id="f-desc" name="description" rows={3} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-type">Typ</Label>
              <select
                id="f-type"
                name="featureType"
                defaultValue="feature"
                className={SELECT_CLASS}
              >
                <option value="">— ungesetzt</option>
                {FEATURE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FEATURE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="border border-border rounded-md p-4 space-y-3">
              <legend className="text-sm font-medium px-1">WSJF-Bewertung</legend>
              {(
                [
                  ["wsjfBusinessValue", "Geschäftswert"],
                  ["wsjfTimeCriticality", "Zeitkritikalität"],
                  ["wsjfRiskReduction", "Risikoreduktion / Chancenerschliessung"],
                  ["wsjfJobSize", "Aufwand (Job Size)"],
                ] as const
              ).map(([name, label]) => (
                <div key={name} className="space-y-1">
                  <Label htmlFor={`f-${name}`}>
                    {label} <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id={`f-${name}`}
                    name={name}
                    required
                    defaultValue=""
                    className={SELECT_CLASS}
                  >
                    <option value="" disabled>
                      Wählen …
                    </option>
                    {FIBONACCI.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="f-ac">Akzeptanzkriterien</Label>
              <Textarea
                id="f-ac"
                name="acceptanceCriteria"
                rows={4}
                placeholder={"Gegeben …\nWenn …\nDann …"}
              />
              <p className="text-xs text-muted-foreground">Ein Kriterium je Zeile</p>
            </div>

            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Wird angelegt …" : "Feature anlegen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
