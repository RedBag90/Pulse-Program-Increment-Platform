"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, startTransition } from "react";
import { Star, Link2, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { setEpicSolutionsAction } from "@/modules/work/features/portfolio/actions/epic-solutions";
import { HorizonBadge } from "@/modules/core/org/features/solution/components/horizon-badge";
import { HORIZON_KEYS } from "@/modules/work/domain/portfolio-guardrails";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";

export interface EpicSolutionOption {
  id: string;
  name: string;
  horizon: string;
}

/**
 * Solutions-Abschnitt am Epic: Mehrfach-Zuordnung (n:m) + Primär-Markierung
 * (★, liefert den Horizont). Ohne Zuordnung → Horizont „Ohne".
 *
 * **Suchfeld statt Kästchenliste, und die Vorschläge kommen vom ART.**
 *
 * Bis September 2026 stand hier jede Solution des **Wertstroms** als Zeile mit
 * Auswahlkästchen — bei einem Wertstrom mit zwanzig Produkten eine Liste, in
 * der man das gesuchte sucht statt es zu wählen. Und sie war zu weit: welcher
 * Zug eine Solution baut, steht seit 2026-09-19 als Pflichtfeld an ihr
 * (`Solution.artId`), und ein Epic gehört genau einem ART. Alles andere war
 * Rauschen.
 *
 * Die Verengung ist sicher: `assertArtInStream` garantiert, dass der ART einer
 * Solution im selben Wertstrom liegt — „Solutions des ARTs" ist also stets eine
 * Teilmenge von „Solutions des Wertstroms". Der Schreibpfad prüft mit
 * (`services/epic-solutions.ts`), nicht nur diese Fläche.
 *
 * **Kein neuer Picker.** Die gewählten Solutions stehen ohnehin als Liste
 * darunter — Ketten-Symbol, Horizont-Abzeichen, Stern. Das Suchfeld fügt hinzu,
 * die Liste zeigt und entfernt; `SearchSelect` genügt dafür, und die
 * Mehrfachauswahl steckt in der Liste, nicht im Feld.
 */
export function EpicSolutionsSection({
  epicId,
  solutions,
  linkedIds,
  primaryId,
  canEdit,
  hasArt,
}: {
  epicId: string;
  /** Die Solutions **des ARTs** dieses Epics. Leer, wenn keiner zugeordnet ist. */
  solutions: EpicSolutionOption[];
  linkedIds: string[];
  primaryId: string | null;
  canEdit: boolean;
  /** Hat das Epic überhaupt einen ART? Ohne ihn gibt es keine Vorschläge. */
  hasArt: boolean;
}) {
  const t = useTranslations();
  const [state, submit, pending] = useActionState(setEpicSolutionsAction, {});
  const [selected, setSelected] = useState<Set<string>>(new Set(linkedIds));
  const [primary, setPrimary] = useState<string | null>(primaryId);

  const byId = new Map(solutions.map((s) => [s.id, s]));
  const gewaehlt = [...selected].map((id) => byId.get(id)).filter((s) => s != null);
  const offen = solutions.filter((s) => !selected.has(s.id));

  function add(id: string) {
    if (!id) return;
    setSelected((prev) => new Set(prev).add(id));
    if (primary == null) setPrimary(id);
  }

  function remove(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (primary === id) setPrimary(null);
  }

  function save() {
    const fd = new FormData();
    fd.set("epicId", epicId);
    for (const id of selected) fd.append("solutionIds", id);
    const eff = primary && selected.has(primary) ? primary : (selected.values().next().value ?? "");
    if (eff) fd.set("primarySolutionId", eff);
    startTransition(() => submit(fd));
  }

  /**
   * **Ohne ART keine Vorschläge, und das wird gesagt.**
   *
   * Der ART ist am Epic Pflicht, kann aber fehlen (Bestandsdaten, gelöschter
   * ART). Eine leere Liste sähe dann aus wie „es gibt keine Solutions"; der
   * wahre Grund ist ein anderer, und er ist behebbar.
   */
  if (!hasArt) {
    return (
      <div className="rounded-lg border border-dashed bg-card/50 px-3 py-3 text-sm text-muted-foreground">
        {t("work.solutions.zuerstArtZuordnen")}
      </div>
    );
  }

  if (solutions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card/50 px-3 py-3 text-sm text-muted-foreground">
        {t("work.solutions.keineSolutionsImArt")}{" "}
        {canEdit && (
          <Link
            href="/structure/solutions?create=solution"
            className="text-primary hover:underline"
          >
            {t("work.solutions.solutionAnlegen")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t("work.solutions.einMarkiertDiePrimaer")}</p>

      {gewaehlt.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {t("work.solutions.nochKeineZugeordnet")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border">
          {gewaehlt.map((s) => {
            const isPrimary = primary === s.id;
            return (
              <li key={s.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <Link2 className="size-3.5 text-muted-foreground/60" />
                  <span className="min-w-0 truncate font-medium">{s.name}</span>
                  <HorizonBadge horizon={s.horizon} />
                </span>
                <button
                  type="button"
                  aria-label={t("work.solutions.alsPrimaerSetzen")}
                  disabled={!canEdit}
                  onClick={() => setPrimary(s.id)}
                  className={
                    isPrimary
                      ? "text-amber-500"
                      : "text-muted-foreground/40 hover:text-amber-500 disabled:opacity-40"
                  }
                >
                  <Star className={`size-4 ${isPrimary ? "fill-amber-400" : ""}`} />
                </button>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={t("work.solutions.zuordnungLoesenFuer", { name: s.name })}
                    onClick={() => remove(s.id)}
                    className="text-muted-foreground/60 hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && offen.length > 0 && (
        <SearchSelect
          value=""
          onChange={add}
          options={offen.map((s) => ({
            value: s.id,
            label: s.name,
            hint: t(HORIZON_KEYS[s.horizon as keyof typeof HORIZON_KEYS] ?? s.horizon),
          }))}
          placeholder={t("work.solutions.solutionHinzufuegen")}
          searchPlaceholder={t("work.solutions.solutionSuchen")}
          ariaLabel={t("work.solutions.solutionHinzufuegen")}
        />
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-success">{t("work.solutions.zuordnungGespeichert")}</p>
      )}
      {canEdit && (
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? t("common.ui.speichernLaeuft") : t("work.solutions.zuordnungSpeichern")}
        </Button>
      )}
    </div>
  );
}
