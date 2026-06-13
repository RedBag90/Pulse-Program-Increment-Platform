import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { InitiativeLevel } from "@/domain/types";

/**
 * Delivery-Cockpit view-model (Umsetzungs-Modul-Redesign Phase 1).
 *
 * Eine einzige Page (/umsetzung) tritt an die Stelle von Hub +
 * PI-Workspace + ART-Hub. Daten teilen sich Board / Tabelle / Roadmap;
 * dieser Loader liefert sie konsolidiert. Slide-Over fuer Feature-Detail
 * faehrt eine separate Lookup-Route (P5).
 *
 * Scope-Default per Entscheidung #2: Single-ART direkt rein, Multi-ART
 * Picker mit Last-used. „Last used" wird im MVP via URL-Param ausgedrueckt
 * (`?art=<id>`); Persistenz per Cookie ist ein Folgeschritt.
 */

export type CockpitView = "board" | "table" | "roadmap";
export type FeatureStatus = "approved" | "in_progress" | "blocked" | "completed" | "cancelled";

export interface CockpitArtRef {
  id: string;
  name: string;
  valueStreamName: string | null;
  /** Anzahl Features im aktiven PI dieser ART — fuer den Multi-ART-Picker. */
  activeFeatureCount: number;
}

export interface CockpitPiSlot {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  /** Anzahl Features im aktuell ausgewaehlten Scope, die in diesem PI sitzen. */
  featureCount: number;
  /** True wenn dieser PI das aktuelle „jetzt"-PI ist (laut Datum). */
  isCurrent: boolean;
}

export interface CockpitFeature {
  id: string;
  title: string;
  status: FeatureStatus;
  piId: string | null;
  artId: string;
  artName: string;
  ownerId: string | null;
  /** UI loest Owner-Namen separat auf (Auth-Provider) — fuer Avatare /
   *  Inline-Anzeige. Null wenn unbekannt. */
  ownerName: string | null;
  wsjfComputed: number | null;
  /** True wenn das Feature mind. eine eingehende `blocks`-Dependency hat,
   *  die noch nicht abgeschlossen ist — gibt Board-Card das ⚠-Signal. */
  hasBlocker: boolean;
  /** Erste blockierende Quelle, fuer den Karten-Hinweis „blockt durch X". */
  blockerHint: string | null;
}

export interface CockpitPermissions {
  /** ART-scoped `feature.update` — PI-Wechsel + Inline-Edits. */
  canUpdate: boolean;
  /** Tenant-scoped `feature.delivery.set` — Status-Wechsel. */
  canSetDelivery: boolean;
  /** ART-scoped `feature.create`. */
  canCreate: boolean;
}

export interface CockpitFilters {
  status: FeatureStatus[];
  ownerIds: string[];
  epicIds: string[];
  hasBlocker: boolean;
}

export interface CockpitPiWindow {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface CockpitModel {
  /** Welche ARTs der User sehen darf, ggf. mit aktivem-PI-Feature-Count. */
  availableArts: CockpitArtRef[];
  /** Aktuell ausgewaehlte ART. `null` wenn der User keinen Scope hat. */
  selectedArt: CockpitArtRef | null;
  /** 5 PIs: aktueller + 1 vor + 3 nach (Entscheidung #10). Leer wenn ART
   *  keine Timeline hat oder die Timeline keine PIs. */
  piStrip: CockpitPiSlot[];
  /** Alle PIs der Timeline (oder Direct-ART) — Datumsfenster fuer die
   *  Roadmap-Sicht. Board + Tabelle nutzen nur den piStrip. */
  allPiWindows: CockpitPiWindow[];
  /** Default-Sicht ist „board" (Entscheidung #1); URL-Param ueberschreibt. */
  view: CockpitView;
  /** Features im aktuell ausgewaehlten Scope, ggf. weitergefiltert. */
  features: CockpitFeature[];
  /** Aktive Filter, gespiegelt aus dem URL-State fuer Rendering der Chips. */
  filters: CockpitFilters;
  permissions: CockpitPermissions;
}

export interface LoadCockpitInput {
  /** Aktuell ausgewaehlter ART-Scope. Bei `null` waehlt der Loader die
   *  erste verfuegbare ART (oder bleibt scope-los). */
  artId?: string | undefined;
  view?: CockpitView | undefined;
  filters?: Partial<CockpitFilters> | undefined;
}

const DEFAULT_FILTERS: CockpitFilters = {
  status: [],
  ownerIds: [],
  epicIds: [],
  hasBlocker: false,
};

/**
 * Waehlt den „aktuellen" PI aus einer chronologisch sortierten Liste —
 * das erste PI dessen Datum heute enthaelt, sonst das naechstgelegene in
 * der Zukunft, sonst das letzte vergangene.
 */
function pickCurrentPiIndex(pis: ReadonlyArray<{ startDate: Date; endDate: Date }>): number {
  if (pis.length === 0) return -1;
  const now = Date.now();
  for (let i = 0; i < pis.length; i++) {
    const p = pis[i]!;
    if (p.startDate.getTime() <= now && now <= p.endDate.getTime()) return i;
  }
  for (let i = 0; i < pis.length; i++) {
    if (pis[i]!.startDate.getTime() > now) return i;
  }
  return pis.length - 1;
}

/** Schneidet ein Fenster aus 5 PIs aus: aktueller + 1 vor + 3 nach. */
function takePiWindow<T>(pis: readonly T[], currentIdx: number): T[] {
  if (currentIdx < 0) return [];
  const start = Math.max(0, currentIdx - 1);
  const end = Math.min(pis.length, currentIdx + 4);
  return pis.slice(start, end);
}

export async function loadCockpitModel(
  db: PrismaClient,
  principal: Principal,
  input: LoadCockpitInput = {},
): Promise<CockpitModel> {
  const { tenantId, scopes } = principal;
  const scopedArtIds = scopes.artIds;

  // 1) Welche ARTs darf der User sehen?
  const arts = await db.art.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(scopedArtIds.length > 0 ? { id: { in: scopedArtIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      timelineId: true,
      valueStream: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  // 2) Aktuellen PI je ART vorermitteln — fuer den Multi-ART-Picker-Counter.
  // Vereinfacht: ein Round-Trip pro ART-Timeline reicht hier nicht, also
  // greifen wir die aktiven PIs des Tenants und reichen sie weiter.
  const activePis = await db.programIncrement.findMany({
    where: { tenantId, status: "active" },
    select: { id: true, artId: true, timelineId: true },
  });
  const activePiIdByArt = new Map<string, string>();
  for (const a of arts) {
    const direct = activePis.find((p) => p.artId === a.id);
    if (direct) {
      activePiIdByArt.set(a.id, direct.id);
      continue;
    }
    if (a.timelineId) {
      const viaTimeline = activePis.find((p) => p.timelineId === a.timelineId);
      if (viaTimeline) activePiIdByArt.set(a.id, viaTimeline.id);
    }
  }

  // Feature-Count pro ART im aktiven PI — fuer den Picker.
  const activeFeatureCountByArt = new Map<string, number>();
  if (activePiIdByArt.size > 0) {
    const rows = await db.initiative.groupBy({
      by: ["artId"],
      where: {
        tenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
        artId: { in: [...activePiIdByArt.keys()] },
        piId: { in: [...new Set(activePiIdByArt.values())] },
      },
      _count: { _all: true },
    });
    for (const r of rows) {
      if (r.artId) activeFeatureCountByArt.set(r.artId, r._count._all);
    }
  }

  const availableArts: CockpitArtRef[] = arts.map((a) => ({
    id: a.id,
    name: a.name,
    valueStreamName: a.valueStream?.name ?? null,
    activeFeatureCount: activeFeatureCountByArt.get(a.id) ?? 0,
  }));

  // 3) Welche ART ist aktuell aktiv?
  const selectedArtId =
    input.artId && availableArts.some((a) => a.id === input.artId)
      ? input.artId
      : (availableArts[0]?.id ?? null);
  const selectedArtRow = arts.find((a) => a.id === selectedArtId) ?? null;
  const selectedArt = selectedArtRow
    ? (availableArts.find((a) => a.id === selectedArtRow.id) ?? null)
    : null;

  // 4) PI-Strip — alle PIs der Timeline (oder direkt der ART), sortiert,
  //    Fenster um den aktuellen PI ausschneiden. `allPiWindows` braucht
  //    die Roadmap-Sicht zum Mappen Feature → Datum.
  let piStrip: CockpitPiSlot[] = [];
  const allPiWindows: CockpitPiWindow[] = [];
  if (selectedArtRow) {
    const allPis = await db.programIncrement.findMany({
      where: {
        tenantId,
        ...(selectedArtRow.timelineId
          ? { timelineId: selectedArtRow.timelineId }
          : { artId: selectedArtRow.id }),
      },
      select: { id: true, name: true, startDate: true, endDate: true, status: true },
      orderBy: { startDate: "asc" },
    });
    for (const p of allPis) {
      allPiWindows.push({
        id: p.id,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
      });
    }
    const currentIdx = pickCurrentPiIndex(allPis);
    const windowPis = takePiWindow(allPis, currentIdx);

    // Feature-Count pro Fenster-PI im aktuellen ART-Scope.
    const counts = await db.initiative.groupBy({
      by: ["piId"],
      where: {
        tenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
        artId: selectedArtRow.id,
        piId: { in: windowPis.map((p) => p.id) },
      },
      _count: { _all: true },
    });
    const countByPi = new Map(counts.map((c) => [c.piId!, c._count._all]));

    piStrip = windowPis.map((p) => ({
      id: p.id,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      featureCount: countByPi.get(p.id) ?? 0,
      // `currentIdx` ist der Index in `allPis`; deshalb erst dort suchen.
      isCurrent: allPis.indexOf(p) === currentIdx,
    }));
  }

  // 5) Features im Scope.
  const filters: CockpitFilters = { ...DEFAULT_FILTERS, ...(input.filters ?? {}) };
  let features: CockpitFeature[] = [];
  if (selectedArtRow) {
    const rows = await db.initiative.findMany({
      where: {
        tenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
        artId: selectedArtRow.id,
        ...(filters.status.length > 0 ? { status: { in: filters.status } } : {}),
        ...(filters.ownerIds.length > 0 ? { ownerId: { in: filters.ownerIds } } : {}),
        ...(filters.epicIds.length > 0 ? { parentId: { in: filters.epicIds } } : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
        piId: true,
        artId: true,
        ownerId: true,
        wsjfComputed: true,
        art: { select: { id: true, name: true } },
        dependenciesIn: {
          where: { type: "blocks" },
          select: {
            id: true,
            from: { select: { id: true, title: true, status: true } },
          },
        },
      },
      orderBy: [{ wsjfComputed: "desc" }, { title: "asc" }],
    });

    features = rows
      .map((r) => {
        const openBlocker = r.dependenciesIn.find(
          (d) => d.from && d.from.status !== "completed" && d.from.status !== "cancelled",
        );
        const f: CockpitFeature = {
          id: r.id,
          title: r.title,
          status: r.status as FeatureStatus,
          piId: r.piId,
          artId: r.artId!,
          artName: r.art?.name ?? "",
          ownerId: r.ownerId,
          // Owner-Namen-Aufloesung kommt mit Phase 5 (Slide-Over) ueber
          // den Auth-Provider; fuer das Skelett ist die ID ausreichend.
          ownerName: null,
          wsjfComputed: r.wsjfComputed ? Number(r.wsjfComputed) : null,
          hasBlocker: !!openBlocker,
          blockerHint: openBlocker?.from?.title ?? null,
        };
        return f;
      })
      .filter((f) => (filters.hasBlocker ? f.hasBlocker : true));
  }

  // 6) Permissions — aus dem zentralen Policies-Registry (ADR-0002).
  //    UI nutzt die Flags nur fuer Affordances; der echte Gate sitzt
  //    serverseitig in den Actions, einmal mehr scoped auf die ART.
  const resource = selectedArtRow ? { tenantId, artId: selectedArtRow.id } : { tenantId };
  const canUpdate = hasCapability(principal, "feature.update", resource);
  const canSetDelivery = hasCapability(principal, "feature.delivery.set", resource);
  const canCreate = hasCapability(principal, "feature.create", resource);

  return {
    availableArts,
    selectedArt,
    piStrip,
    allPiWindows,
    view: input.view ?? "board",
    features,
    filters,
    permissions: { canUpdate, canSetDelivery, canCreate },
  };
}
