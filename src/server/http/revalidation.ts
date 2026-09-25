import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Revalidation registry
//
// Maps a mutated *domain resource* to the set of Next.js routes that display
// it. Actions declare what they changed (`revalidate: "art"`) instead of
// hardcoding paths in each `onSuccess`; "which pages show ARTs?" is answered
// here, once, rather than smeared across every ART/Team/Feature action.
//
// Paths use the App Router template form (`/structure/art/[id]`) and are
// written **without** `[locale]` und ohne Routen-Gruppe — dieselbe Schreibweise, die die
// Inhalts-Verweise in Wiki und Onboarding benutzen und die `appRoutes()` im
// Test liest. Das Segment setzt `revalidateFor` davor; die Begründung steht
// dort. Revalidiert wird mit dem `"page"`-Typ, der *alle* Instanzen der
// Vorlage trifft — keine Ids durchzureichen.
// The set per resource is a deliberate superset: over-revalidation is cheap and
// removes the per-action drift that the structure-hub consolidation suffered.
// ---------------------------------------------------------------------------

export type RevalidationResource =
  | "art"
  | "artCreated"
  | "feature"
  | "epic"
  | "valueStream"
  | "solution"
  | "budgetAllocation"
  | "budgetRound"
  | "budgetPeriod"
  | "budgetPeriodList"
  | "rtbItem"
  | "pi"
  | "piStandard"
  | "budgetPlanRevision"
  | "timeline"
  | "story"
  | "dependency"
  | "ziele"
  | "goalCustomFields"
  | "setup"
  | "risk"
  | "portfolioFilter"
  | "goalFilter"
  | "issueFilter"
  | "roleOnboarding";

/**
 * Exportiert, damit der Test die Zahl der Aufrufe **ableiten** kann statt sie
 * abzuschreiben. Vorher stand dort eine feste `3`; eine neue Route in einer
 * Gruppe ließ ihn fehlschlagen, ohne dass etwas kaputt war.
 */
export const REGISTRY: Record<RevalidationResource, readonly string[]> = {
  art: [
    "/structure",
    // Die Rollenverteilung liest die Benennungen aller drei Ebenen und schreibt
    // sie auch — sie gehört deshalb in alle drei Gruppen. `revalidatePath`
    // trifft ohne `type: "layout"` genau den angegebenen Pfad, nicht seine
    // Geschwister: `/structure` deckt `/structure/rollen` **nicht** ab.
    "/structure/rollen",
    "/structure/art/[id]",
    "/structure/value-stream/[id]",
    "/budgeting/value-streams",
    "/budgeting/value-streams/[id]",
  ],
  // Beim CREATE reicht der schmale Cut: die neue Detail-Page wird ohnehin
  // bei der Navigation frisch gerendert; nur die Aggregations-Listen
  // muessen den neuen Eintrag sehen.
  artCreated: ["/structure", "/structure/value-stream/[id]", "/budgeting/value-streams/[id]"],
  feature: [
    "/portfolio/epics/[id]",
    "/feature/[featureId]",
    "/pi/[piId]",
    "/pi-planning",
    // Die Cockpit-Vollroute und die persönliche Inbox fehlten hier: ein
    // Owner-Wechsel blieb dort sichtbar veraltet, obwohl er gespeichert war.
    "/umsetzung/feature/[id]",
    "/my-tasks",
    // Dieselbe Lücke, eine Runde später: ein Feature erscheint inzwischen auf
    // Flächen, die hier nicht standen. `/portfolio/epics/[id]` trifft zudem ein
    // **eigenständiges** Feature gar nicht — es hat keine solche Seite.
    "/umsetzung",
    "/implementation/features",
    "/portfolio",
    "/structure/solution/[id]",
  ],
  epic: [
    "/portfolio",
    "/portfolio/epics",
    "/portfolio/epics/[id]",
    "/portfolio/dashboard",
    "/portfolio/guardrails",
    "/budgeting/round",
    // „I need help" toggelt am Epic und muss den Hinweis auf /my-tasks (VMO /
    // Portfolio-Manager) auffrischen.
    "/my-tasks",
  ],
  valueStream: [
    "/structure",
    "/structure/rollen",
    "/structure/value-stream/[id]",
    "/budgeting/value-streams/[id]",
  ],
  // Solutions wirken auf die Verwaltungsseiten UND auf den abgeleiteten
  // Epic-Horizont (Kanban-Swimlanes, Guardrail, Epic-Detail).
  solution: [
    // **`/structure`, nicht `/structure/solutions`.** Die flache Liste ist seit
    // September 2026 eine Gruppierung der einen Struktur-Fläche; ihre Adresse
    // leitet nur noch weiter und lädt nichts — an ihr könnte also auch nichts
    // veralten. Die Fläche, die die Solution zeigt, ist `/structure`.
    "/structure",
    "/structure/rollen",
    "/structure/solution/[id]",
    "/portfolio",
    "/portfolio/dashboard",
    // Der Horizont haengt an der Primaer-Solution — ohne das bleibt die
    // Guardrails-Flaeche nach einem Solution-Wechsel kalt.
    "/portfolio/guardrails",
    "/portfolio/epics/[id]",
  ],
  // Eine Epic-Zuteilung (oder der Topf) aendert das ABGELEITETE Wertstrom-Budget
  // — und das zeigen weit mehr Seiten als das Board selbst. Vorher deklarierten
  // beide Aktionen `epic`, wodurch Struktur-, Timeline- und Reporting-Sichten
  // nach dem Speichern veraltete Summen zeigten.
  budgetAllocation: [
    "/budgeting",
    "/budgeting/round",
    // Die Wertstrom-Liste trägt Geldspalten und stand in **keiner** Gruppe —
    // ihre Summen veralteten nach jeder Finalisierung und jeder Verteilung
    // (REQ-12).
    "/budgeting/value-streams",
    "/portfolio",
    "/portfolio/epics/[id]",
    "/structure",
    "/structure/timelines",
    "/structure/value-stream/[id]",
    "/budgeting/value-streams/[id]",
  ],
  pi: ["/umsetzung", "/structure", "/pi/[piId]", "/pi-planning"],
  piStandard: ["/structure", "/structure/value-stream/[id]", "/budgeting/value-streams/[id]"],
  budgetPlanRevision: ["/budgeting", "/budgeting/budget-plan", "/budgeting/budget-plan/[id]"],
  // `/budgeting/rounds` (Plural) stand hier, seit die Kachel-Gallery nach
  // `/budgeting/periods` gezogen ist — eine Route, die es nie gab. Ein
  // `revalidatePath` darauf lief folgenlos durch; die Liste der Zeiträume blieb
  // nach dem Anlegen einer Runde kalt. Gefunden hat es der Wächter unten.
  budgetRound: ["/budgeting", "/budgeting/periods", "/budgeting/round", "/budgeting/periods/[id]"],
  budgetPeriod: ["/budgeting", "/budgeting/periods", "/budgeting/periods/[id]", "/my-tasks"],
  // Löschen: NUR die Listen-/Übersichts-Routen — NICHT die [id]-Detailseite, sonst
  // rendert die gerade gelöschte Kachel als notFound (404), bevor der Redirect greift.
  budgetPeriodList: ["/budgeting", "/budgeting/periods", "/my-tasks"],
  // Betriebskosten sind die Run-Zahl der Solution — die beiden
  // Solution-Flächen hängen mit dran.
  rtbItem: [
    "/structure/value-stream/[id]",
    "/budgeting/value-streams",
    "/budgeting/value-streams/[id]",
    "/budgeting/periods/[id]",
    "/budgeting/run-the-business",
    // Run steht jetzt auch an der Struktur-Fläche selbst (Kachel und Tabelle),
    // nicht mehr nur auf der eigenen Solutions-Seite.
    "/structure",
    "/structure/solution/[id]",
    // **Keine `/budgeting/arts`-Route mehr.** Beide — Liste und Detail — sind
    // seit der Zusammenlegung reine Wegweiser auf die Wertstromseite. Sie laden
    // nichts, also kann an ihnen auch nichts veralten; die Fläche, die die Zahl
    // wirklich zeigt, steht weiter oben.
  ],
  // Timeline mutations ripple anywhere PIs surface (planning, PI detail) and
  // the structure tab that hosts the management UI.
  timeline: ["/umsetzung", "/structure", "/pi-planning", "/pi/[piId]", "/feature/[featureId]"],
  story: ["/feature/[featureId]"],
  // `/portfolio/epics/[id]` gehoert dazu, seit der Netzplan im Epic Kanten
  // anlegt: die Fläche zeigt dieselben Zeilen wie das Cockpit. Sie fehlte,
  // und nur der eigene `router.refresh()` des Netzplans hat es verdeckt.
  dependency: ["/umsetzung", "/feature/[featureId]", "/portfolio/epics/[id]"],
  ziele: ["/ziele"],
  // Feld-Defs wirken auf die Admin-Seite UND auf jeden Ziel-Drawer.
  goalCustomFields: ["/admin/goal-fields", "/ziele"],
  setup: ["/setup"],
  // `risk`-Actions decken das Issue-Register, den Epic-Issues-Tab und die
  // Portfolio-Übersicht (Risiken-Kachel).
  risk: ["/issues", "/portfolio/epics/[id]", "/portfolio"],
  portfolioFilter: ["/portfolio"],
  goalFilter: ["/ziele"],
  issueFilter: ["/issues"],
  // Nur die Nachschlage-Seite. Das Willkommensfenster selbst hängt am
  // Dashboard-Layout und wird nach dem Annehmen clientseitig geschlossen —
  // ein globales Layout-Revalidate für jede Quittung wäre unverhältnismäßig.
  roleOnboarding: ["/meine-rolle"],
};

/**
 * **Das Routen-Präfix gehört in den Aufruf, nicht in die Registry.**
 *
 * Bis September 2026 fehlte es ganz — und damit lief **jeder** Aufruf im
 * Projekt folgenlos durch. `routing.ts` steht auf `localePrefix: "always"`:
 * es gibt keine Route `/portfolio/epics`, nur `/de/…` und `/en/…`. Die Tags,
 * die eine gerenderte Seite trägt, leitet Next aus der **Routen-Vorlage** ab
 * (`/[locale]/portfolio/epics/[id]/page`), die Registry emittierte
 * `/portfolio/epics/[id]/page`. Keine einzige Überschneidung, 25 Gruppen lang.
 *
 * Aufgefallen ist es nicht, weil die Epic-Detailseite trotzdem frisch aussah:
 * Next hängt eine neue Flight-Payload der *aktuellen* Seite an die
 * Action-Antwort, sobald irgendein `revalidatePath` lief. Was ausfiel, waren
 * alle **anderen** Flächen und der Data-Cache — namentlich die
 * 60-Sekunden-`unstable_cache` in `server/services/tenant-users.ts`. Daher das
 * Muster „erst nach einer Weile stimmt es".
 *
 * **Die Routen-Gruppe muss mit.** `createWorkStore` legt zwei Formen ab —
 * `page` roh (`/[locale]/(dashboard)/portfolio/epics/[id]/page`) und
 * `route: normalizeAppPath(page)` ohne Gruppen —, und `getImplicitTags` nimmt
 * die **rohe**. `revalidatePath` normalisiert seinerseits nichts. Wer die
 * Adresse einsetzt, die im Browser steht, trifft deshalb nichts; `(dashboard)`
 * gehört genauso hinein wie `[locale]`. Nachgelesen in
 * `next/dist/server/async-storage/work-store.js`,
 * `server/lib/implicit-tags.js` und `web/spec-extension/revalidate.js`.
 *
 * **Ein Aufruf trifft beide Sprachen.** Weil das Tag aus der Vorlage kommt und
 * nicht aus der konkreten URL, ist `[locale]` darin ein Platzhalter wie `[id]`
 * — je Locale einen Aufruf abzusetzen wäre verdoppelte Arbeit ohne Wirkung.
 *
 * **Dass alle Registry-Routen unter `(dashboard)` liegen, ist eine Annahme**,
 * und sie war schon einmal still gebrochen. `revalidation.test.ts` prüft sie
 * deshalb gegen den Dateibaum: eine verschachtelte Gruppe macht den Lauf rot,
 * statt die Revalidierung wieder stumm zu stellen.
 *
 * **Und `"page"` gilt jetzt für jeden Pfad.** Vorher entschied
 * `path.includes("[")` darüber; mit dem Präfix trägt jeder Pfad eine eckige
 * Klammer, und `revalidatePath` ohne `type` tut bei einer dynamischen Route
 * nichts ausser zu warnen. Die Fallunterscheidung ist damit nicht nur
 * überflüssig, sie wäre schädlich.
 */
/** Locale-Segment **und** Routen-Gruppe — beides führt Next im Tag. */
const ROUTE_PREFIX = "/[locale]/(dashboard)";

/** Revalidates every route registered for the given resource, in both locales. */
export function revalidateFor(resource: RevalidationResource): void {
  for (const path of REGISTRY[resource]) revalidateRoute(path);
}

/**
 * **Eine einzelne Route auffrischen — der einzige Weg dorthin.**
 *
 * Nicht jede Fläche gehört in die Registry: `/admin/users` nach einer
 * Rollenänderung ist keine Frage von „welche Seiten zeigen Ressource X", es
 * ist eine Seite und ihre eigene Aktion. Für die gab es bisher den direkten
 * Aufruf von `revalidatePath` — an **sechzehn** Stellen in acht Dateien, und
 * alle sechzehn ohne das Locale-Segment.
 *
 * Deshalb steht das hier und nicht dort: solange `revalidatePath` überall
 * erreichbar war, musste jede Fundstelle die Regel einzeln kennen. Ein Wächter
 * (`revalidation.test.ts`) hält den Import jetzt auf diese Datei fest.
 */
export function revalidateRoute(path: string): void {
  revalidatePath(`${ROUTE_PREFIX}${path}`, "page");
}
