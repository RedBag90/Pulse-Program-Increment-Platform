import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { CockpitFeature, CockpitPiSlot } from "@/modules/drumbeat/domain/cockpit-types";
import {
  COCKPIT_FEATURE_SELECT,
  PLANNABLE_GATE_WHERE,
  buildPiStrip,
  buildScopeDependencies,
  buildScopeFeatures,
  loadArtPiRows,
  loadPlannedJobSizeByPi,
  type CockpitAllPiRow,
  type CockpitDependency,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";

/**
 * **Der Netzplan eines Epics — im Format der Umsetzung.**
 *
 * Bis September 2026 hatte der Reiter „Dependencies" eine eigene Lesesicht
 * (`breakdown-network-view.ts`) mit eigener Kartengestalt: ohne Owner, ohne
 * Solution, ohne Blocker. Jetzt entstehen die Karten mit derselben Ableitung
 * wie im Umsetzungs-Cockpit (`buildScopeFeatures`), und derselbe
 * `DependencyNetwork` zeichnet sie.
 *
 * **Umfang:** alle Features des Epics — über alle ARTs, samt Backlog, ohne
 * das L3-Tor (es ist der Reiter des Epics, keine Planungsübersicht).
 *
 * **Spalten:** die Taktung des **Epic-ARTs** — Backlog und das Fenster aus
 * fünf PIs um das aktive, mit Job Size und Ziel im Titel. Features in PIs
 * einer anderen Taktung stehen in „Außerhalb des Fensters". Hat das Epic
 * kein ART, gilt das, in dem die meisten seiner Features liegen.
 */
export interface EpicNetworkModel {
  features: CockpitFeature[];
  dependencies: CockpitDependency[];
  pis: CockpitPiSlot[];
  selectedPiId: string | null;
  /** Das ART der Spalten — und das für Mutationen, deren Quelle nicht im Bild ist. */
  artId: string | null;
  permissions: { canUpdate: boolean; canLink: boolean; canCreate: boolean; canScore: boolean };
}

export async function loadEpicNetworkModel(
  db: PrismaClient,
  principal: Principal,
  input: {
    epicId: string;
    /** `Initiative.artId` des Epics — `null` bei Portfolio-Epics. */
    epicArtId: string | null;
    /** Ohne Drumbeat gibt es keine PIs; dann bleibt nur die Backlog-Spalte. */
    drumbeat: boolean;
  },
): Promise<EpicNetworkModel> {
  const { tenantId } = principal;
  const [featureRows, userLabels] = await Promise.all([
    db.initiative.findMany({
      where: {
        tenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
        parentId: input.epicId,
      },
      select: COCKPIT_FEATURE_SELECT,
      orderBy: [{ wsjfComputed: "desc" }, { title: "asc" }],
    }),
    listTenantUserLabels(db, tenantId),
  ]);

  const artId = input.epicArtId ?? meistesArt(featureRows.map((f) => f.artId));
  const art = artId
    ? await db.art.findFirst({
        where: { id: artId, tenantId, deletedAt: null },
        select: { id: true, timelineId: true },
      })
    : null;

  const scopeIds = featureRows.map((f) => f.id);
  const [allPis, jobSizeByPi, depRows] = await Promise.all([
    art && input.drumbeat
      ? loadArtPiRows(db, tenantId, art)
      : Promise.resolve<CockpitAllPiRow[]>([]),
    art && input.drumbeat
      ? loadPlannedJobSizeByPi(db, tenantId, art.id, PLANNABLE_GATE_WHERE)
      : Promise.resolve<Record<string, number>>({}),
    scopeIds.length === 0
      ? Promise.resolve([])
      : db.dependency.findMany({
          where: { tenantId, OR: [{ fromId: { in: scopeIds } }, { toId: { in: scopeIds } }] },
          select: {
            id: true,
            fromId: true,
            toId: true,
            type: true,
            from: { select: { id: true, title: true, parent: { select: { title: true } } } },
            to: { select: { id: true, title: true, parent: { select: { title: true } } } },
          },
        }),
  ]);

  const features = buildScopeFeatures(featureRows, false, userLabels);
  const countByPi = new Map<string, number>();
  for (const f of features) {
    if (f.piId) countByPi.set(f.piId, (countByPi.get(f.piId) ?? 0) + 1);
  }
  const { piStrip, selectedPiId } = buildPiStrip(allPis, {
    now: Date.now(),
    windowOffset: 0,
    rawSelectedPiId: null,
    countByPi,
    jobSizeByPi: new Map(Object.entries(jobSizeByPi)),
  });

  // Der Geist sagt, zu welchem Epic sein Feature gehört.
  const epicOf = new Map<string, string | null>();
  for (const d of depRows) {
    epicOf.set(d.fromId, d.from?.parent?.title ?? null);
    epicOf.set(d.toId, d.to?.parent?.title ?? null);
  }
  const dependencies = buildScopeDependencies(depRows, features).map((d) =>
    d.offScopeRole == null
      ? d
      : {
          ...d,
          offScopeEpicTitle: epicOf.get(d.offScopeRole === "from" ? d.fromId : d.toId) ?? null,
        },
  );

  const resource = art ? { tenantId, artId: art.id } : { tenantId };
  return {
    features,
    dependencies,
    pis: piStrip,
    selectedPiId,
    artId: art?.id ?? null,
    permissions: {
      canUpdate: hasCapability(principal, "feature.update", resource),
      canLink: hasCapability(principal, "dependency.link", resource),
      canCreate: hasCapability(principal, "feature.create", resource),
      canScore: hasCapability(principal, "feature.wsjf.set", resource),
    },
  };
}

/** Das häufigste ART — der Rückfall, wenn das Epic selbst keines trägt. */
function meistesArt(artIds: ReadonlyArray<string | null>): string | null {
  const zahl = new Map<string, number>();
  for (const id of artIds) if (id) zahl.set(id, (zahl.get(id) ?? 0) + 1);
  let best: string | null = null;
  for (const [id, n] of zahl) if (best == null || n > zahl.get(best)!) best = id;
  return best;
}
