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
import { loadSolutionGrow } from "@/modules/work/server/views/solution-grow";
import { listRtbItems } from "@/modules/budgeting/server/services/rtb-item-service";
import { rtbAnnualAmount } from "@/modules/budgeting/domain/rtb-interval";
import { StructureMap } from "@/modules/core/org/features/structure/components/structure-map";
import {
  StructureTable,
  type TableGrouping,
} from "@/modules/core/org/features/structure/components/structure-table";
import { StructureToolbar } from "@/modules/core/org/features/structure/components/structure-toolbar";
import { ConceptCallout } from "@/modules/core/org/features/solution/components/concept-callout";
import { SolutionsCreateControl } from "@/modules/core/org/features/solution/components/solutions-create-control";
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
  const { view, nach, q } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const workEnabled = principal.enabledModules.includes("work");
  const budgetingEnabled = principal.enabledModules.includes("budgeting");

  const tree = await getStructureTree(db, principal.tenantId);
  const base = buildStructureOverview(tree);
  const solutionIds = tree.flatMap((vs) => vs.solutions.map((s) => s.id));

  const [grow, rtbItems] = await Promise.all([
    workEnabled ? loadSolutionGrow(db, principal.tenantId, solutionIds) : Promise.resolve(null),
    budgetingEnabled ? listRtbItems(db, principal.tenantId) : Promise.resolve(null),
  ]);

  // Run je Solution: Σ Jahres-Äquivalent der **aktiven** Positionen, die ihr
  // zugerechnet sind. Wertstrom- und ART-übergreifende Positionen
  // (`solutionId === null`) zählen bewusst in keine Zeile — die Tabelle sagt das
  // in ihrer Fussnote.
  const runBySolution = new Map<string, number>();
  for (const it of rtbItems ?? []) {
    if (!it.active || it.solutionId == null) continue;
    const annual = rtbAnnualAmount(it.plannedAmount, it.interval);
    runBySolution.set(it.solutionId, (runBySolution.get(it.solutionId) ?? 0) + annual);
  }

  /**
   * **Jede Solution bekommt eine Zeile, auch die leere.** Würde die Zuordnung
   * nur die Solutions enthalten, die Epics oder Positionen tragen, hiesse
   * „nicht gemessen" dasselbe wie „hat nichts" — und die Fläche verschwiege den
   * Unterschied zwischen „kein Epic" und „Modul nicht gebucht".
   */
  const bySolution: Record<string, StructureMoney> = {};
  if (workEnabled || budgetingEnabled) {
    for (const id of solutionIds) {
      const g = grow?.get(id);
      bySolution[id] = {
        grow: g?.grow ?? 0,
        epicCount: g?.epicCount ?? 0,
        run: runBySolution.get(id) ?? 0,
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

  const leer = base.counts.valueStreams === 0;
  const ohneTreffer = !leer && overview.valueStreams.length === 0;

  return (
    <Page>
      <PageHeader
        eyebrow="Struktur"
        title="Organisation"
        subtitle="Wertströme, ihre ARTs und die Solutions, die sie bauen und betreiben."
        actions={
          <>
            {canCreateSolution && (
              <Suspense fallback={null}>
                <SolutionsCreateControl />
              </Suspense>
            )}
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
          <p className="text-sm font-medium">Noch keine Struktur.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {canCreateVs
              ? "Mit „Wertstrom anlegen“ den ersten anlegen — darunter kommen ARTs, darunter die Solutions, die sie bauen und betreiben."
              : "Ein Admin oder Portfolio-Manager legt den ersten Wertstrom an."}
          </p>
        </div>
      ) : ohneTreffer ? (
        <p className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Kein Treffer für „{q}“.
        </p>
      ) : (
        // `structure-tree` ist der Anker, auf den vier Rollen-Playbook-Stationen
        // und eine Wiki-Station zeigen („hier steht deine Struktur"). Er hing am
        // Baum; ohne ihn liefen die Touren ins Leere.
        <div data-tour="structure-tree">
          {activeView === "karte" ? (
            <StructureMap overview={overview} showGrow={workEnabled} showRun={budgetingEnabled} />
          ) : (
            <StructureTable
              overview={overview}
              grouping={grouping}
              showGrow={workEnabled}
              showRun={budgetingEnabled}
            />
          )}
        </div>
      )}
    </Page>
  );
}
