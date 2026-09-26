import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getStructureTree } from "@/modules/core/org/server/services/structure";
import {
  buildStructureOverview,
  filterStructureOverview,
  rollUpStructureMoney,
  type StructureMoney,
} from "@/modules/core/org/server/views/structure-overview";
import { loadSolutionCycleInvest } from "@/modules/work/server/views/solution-grow";
import { classifyEpics } from "@/modules/work/server/services/epic-class";
import {
  artEpicCycleAllocations,
  cycleRunCosts,
} from "@/modules/budgeting/server/services/rtb-item-service";
import { getEpicCycleAllocations } from "@/modules/budgeting/server/services/epic-allocation";
import { cycleLabel } from "@/modules/budgeting/domain/cycle";
import { StructureMap } from "@/modules/core/org/features/structure/components/structure-map";
import {
  StructureTable,
  type TableGrouping,
} from "@/modules/core/org/features/structure/components/structure-table";
import { StructureToolbar } from "@/modules/core/org/features/structure/components/structure-toolbar";
import { ConceptCallout } from "@/modules/core/org/features/solution/components/concept-callout";
import { SolutionsCreateControl } from "@/modules/core/org/features/solution/components/solutions-create-control";
import { CreateArtDialog } from "@/modules/core/org/features/art/components/create-art-dialog";
import { CreateValueStreamDialog } from "@/modules/core/org/features/value-stream/components/create-value-stream-dialog";
import { Page, PageHeader } from "@/components/layout";

/**
 * **Der Struktur-Bereich — eine Fläche, zwei Darstellungen.**
 *
 * Bis September 2026 waren es zwei Seiten und ein halber Rahmen: links ein
 * 288 px breiter Baum, rechts der Satz „Wähle einen Knoten aus dem Baum" — und
 * daneben, **ausserhalb** dieses Rahmens, eine flache Tabelle über dieselben
 * Solutions. Wer im Baum stand und im Menü auf „Solutions" ging, verlor den
 * Baum, den Pfad und die Auswahl. Der Landeplatz war dabei die häufigste
 * Ansicht des Bereichs und zeigte nichts.
 *
 * Der Befund, der das entschieden hat: **die Struktur ist winzig** — im
 * Bestand drei Wertströme, sechs ARTs, sechs Solutions. Fünfzehn Knoten passen
 * als Bild auf einen Bildschirm. Und in den Baum passten sie nicht: sechs von
 * sieben Zeilenarten überschritten die 272 px, die netto zur Verfügung standen.
 *
 * Geblieben sind beide Fragen, die die zwei Seiten beantworteten — jetzt als
 * zwei Darstellungen derselben Fläche:
 *
 * | `?view=` | beantwortet |
 * | --- | --- |
 * | `karte` (Standard) | wie sieht die Organisation aus, und wo fehlt etwas |
 * | `tabelle` | was kostet sie — `?nach=struktur` mit Summen je Ebene, `?nach=horizont` flach |
 *
 * **Kompositions-Wurzel über drei Module** (ADR-0013/ADR-0022): der Knoten
 * selbst aus Core, Grow aus Work, Run aus Budgeting. Ohne das jeweilige
 * Entitlement entfällt die Angabe ganz — eine 0 € stünde sonst da, als wäre
 * nichts investiert.
 */
interface Props {
  searchParams: Promise<{ view?: string; nach?: string; q?: string }>;
}

export default async function StructurePage({ searchParams }: Props) {
  const t = await getTranslations();
  const { view, nach, q } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const workEnabled = principal.enabledModules.includes("work");
  const budgetingEnabled = principal.enabledModules.includes("budgeting");

  const tree = await getStructureTree(db, principal.tenantId);
  const base = buildStructureOverview(tree);
  const solutionIds = tree.flatMap((vs) => vs.solutions.map((s) => s.id));

  /**
   * **Beide Beträge stehen auf derselben Periode: dem angewandten Zyklus.**
   *
   * Nicht `currentCycle(now)`, sondern der Zyklus, dessen Kachel heute gilt —
   * `getEpicCycleAllocations` leitet ihn aus den finalisierten Runden ab und
   * gibt ihn zurück. Dieselbe Quelle liest der Horizont-Trichter der
   * Portfolio-Übersicht; zwei Flächen über dasselbe Geld dürfen nicht zwei
   * Halbjahre meinen.
   */
  const cycle = budgetingEnabled
    ? await getEpicCycleAllocations(db, principal.tenantId, new Date())
    : null;

  const [epicClasses, artAllocations, runCosts] = await Promise.all([
    workEnabled && cycle ? classifyEpics(db, principal.tenantId) : Promise.resolve(null),
    cycle
      ? artEpicCycleAllocations(db, principal.tenantId, cycle.cycleKey)
      : Promise.resolve({} as Record<string, number>),
    budgetingEnabled ? cycleRunCosts(db, principal.tenantId) : Promise.resolve(null),
  ]);

  const invest =
    cycle && epicClasses
      ? await loadSolutionCycleInvest(db, principal.tenantId, solutionIds, {
          cycleAllocations: cycle.byEpic,
          artAllocations,
          epicClasses,
        })
      : null;

  /**
   * **Jede Solution bekommt eine Zeile, auch die leere.** Würde die Zuordnung
   * nur die Solutions enthalten, die Epics oder Positionen tragen, hiesse
   * „nicht gemessen" dasselbe wie „hat nichts" — und die Fläche verschwiege den
   * Unterschied zwischen „kein Epic" und „Modul nicht gebucht".
   */
  const bySolution: Record<string, StructureMoney> = {};
  if (workEnabled || budgetingEnabled) {
    for (const id of solutionIds) {
      const g = invest?.get(id);
      bySolution[id] = {
        grow: g?.grow ?? 0,
        epicCount: g?.epicCount ?? 0,
        run: runCosts?.bySolution[id] ?? 0,
      };
    }
  }

  const withMoney = workEnabled || budgetingEnabled ? rollUpStructureMoney(base, bySolution) : base;
  const overview = filterStructureOverview(withMoney, q ?? "");

  const activeView = view === "tabelle" ? "tabelle" : "karte";
  const grouping: TableGrouping = nach === "horizont" ? "horizont" : "struktur";

  const canCreateVs = hasCapability(principal, "value_stream.create", {
    tenantId: principal.tenantId,
  });
  const canCreateSolution = hasCapability(principal, "solution.create", {
    tenantId: principal.tenantId,
  });
  const canCreateArt = hasCapability(principal, "art.create", {
    tenantId: principal.tenantId,
  });

  /**
   * **Drei Schalter, weil es drei Herkünfte sind.** Die Epic-Zahl ist Work, der
   * Betrieb ist Budgeting — und Grow ist seit der Umstellung auf das Halbjahr
   * **beides**: Work kennt die Epics, aber die Zuteilung liegt in Budgeting.
   * Ein Mandant mit Work ohne Budgeting sieht deshalb seine Epics, aber keinen
   * Betrag. Lieber nichts als eine Zahl, die eine andere Periode meint.
   */
  const showEpics = workEnabled;
  const showInvest = workEnabled && budgetingEnabled;
  const showRun = budgetingEnabled;

  const leer = base.counts.valueStreams === 0;
  const ohneTreffer = !leer && overview.valueStreams.length === 0;

  return (
    <Page>
      <PageHeader
        eyebrow={t("org.page.struktur")}
        title={t("org.page.organisation")}
        subtitle={
          cycle?.cycleKey
            ? `Wertströme, ihre ARTs und die Solutions, die sie bauen und betreiben. Beträge: ${cycleLabel(cycle.cycleKey)}.`
            : "Wertströme, ihre ARTs und die Solutions, die sie bauen und betreiben."
        }
        actions={
          <>
            {canCreateSolution && (
              <Suspense fallback={null}>
                <SolutionsCreateControl />
              </Suspense>
            )}
            {/* Solution · ART · Wertstrom — die Hierarchie von innen nach aussen.
                `CreateArtDialog` bringt unkontrolliert seinen eigenen Ausloeser
                mit, wie der Wertstrom daneben; den `Suspense`-Wrapper braucht
                nur die Solution, weil sie `?create=solution` bedient und dafuer
                `useSearchParams()` liest. */}
            {canCreateArt && <CreateArtDialog />}
            {canCreateVs && <CreateValueStreamDialog />}
          </>
        }
      />

      {!leer && (
        <div className="mt-4 mb-4">
          <Suspense fallback={null}>
            <StructureToolbar view={activeView} grouping={grouping} />
          </Suspense>
        </div>
      )}

      {activeView === "tabelle" && grouping === "horizont" && (
        <div className="mb-4">
          <ConceptCallout storageKey="solution-vs-epic" />
        </div>
      )}

      {leer ? (
        <div className="rounded-lg border-2 border-dashed bg-muted/30 px-6 py-10 text-center">
          <p className="text-sm font-medium">{t("org.page.nochKeineStruktur")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {canCreateVs
              ? t("org.page.strukturLeerErstenWertstromAnlegen")
              : t("org.page.strukturLeerAdminLegtAn")}
          </p>
        </div>
      ) : ohneTreffer ? (
        <p className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          {t("org.page.strukturKeinTrefferFuer", { query: q ?? "" })}
        </p>
      ) : (
        // `structure-tree` ist der Anker, auf den vier Rollen-Playbook-Stationen
        // und eine Wiki-Station zeigen („hier steht deine Struktur"). Er hing am
        // Baum; ohne ihn liefen die Touren ins Leere.
        <div data-tour="structure-tree">
          {activeView === "karte" ? (
            <StructureMap
              overview={overview}
              showEpics={showEpics}
              showInvest={showInvest}
              showRun={showRun}
            />
          ) : (
            <StructureTable
              overview={overview}
              grouping={grouping}
              showEpics={showEpics}
              showInvest={showInvest}
              showRun={showRun}
            />
          )}
        </div>
      )}
    </Page>
  );
}
