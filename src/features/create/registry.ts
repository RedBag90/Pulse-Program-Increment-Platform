import type { CreateContext } from "./create-context";

/**
 * One creatable entity in the global "+" menu. `indentLevel` reproduces the
 * screenshot's hierarchy (a Feature is created "under" an Epic).
 *
 * - `inPlace: true` → the menu opens the entity's create dialog directly in the
 *   topbar (no navigation). `CreateMenu` maps the key to the dialog component.
 * - otherwise → the menu navigates via `resolveHref` (entities not yet wired
 *   for in-place creation).
 */
export interface CreateEntry {
  key: string;
  label: string;
  group: "portfolio" | "initiative" | "more";
  indentLevel: 0 | 1 | 2 | 3;
  inPlace?: boolean;
  resolveHref: (ctx: CreateContext) => string;
}

export const CREATE_GROUPS: { key: CreateEntry["group"]; label: string }[] = [
  { key: "portfolio", label: "Portfolio" },
  { key: "initiative", label: "Initiative" },
  { key: "more", label: "More" },
];

export const CREATE_REGISTRY: CreateEntry[] = [
  {
    key: "value-stream",
    label: "Value Stream",
    group: "portfolio",
    indentLevel: 0,
    inPlace: true,
    resolveHref: () => "/capacity?create=value-stream",
  },
  {
    key: "art",
    label: "ART",
    group: "portfolio",
    indentLevel: 1,
    inPlace: true,
    resolveHref: () => "/capacity?create=art",
  },
  {
    key: "pi",
    label: "Program Increment",
    group: "portfolio",
    indentLevel: 2,
    inPlace: true,
    resolveHref: (c) => (c.artId ? `/art/${c.artId}/pi?create=pi` : "/art"),
  },
  {
    key: "team",
    label: "Team",
    group: "portfolio",
    indentLevel: 2,
    inPlace: true,
    resolveHref: (c) => (c.artId ? `/art/${c.artId}/teams` : "/structure"),
  },
  {
    key: "epic",
    label: "Epic",
    group: "initiative",
    indentLevel: 0,
    inPlace: true,
    resolveHref: () => "/portfolio/epics?create=epic",
  },
  {
    key: "feature",
    label: "Feature",
    group: "initiative",
    indentLevel: 1,
    inPlace: true,
    resolveHref: (c) => (c.artId ? `/art/${c.artId}/features?create=feature` : "/art"),
  },
  {
    key: "story",
    label: "Story",
    group: "initiative",
    indentLevel: 2,
    inPlace: true,
    resolveHref: (c) => (c.featureId ? `/feature/${c.featureId}?create=story` : "/pi-planning"),
  },
  {
    key: "task",
    label: "Task",
    group: "initiative",
    indentLevel: 3,
    inPlace: true,
    resolveHref: () => "/pi-planning",
  },
  {
    key: "kpi",
    label: "KPI",
    group: "initiative",
    indentLevel: 1,
    inPlace: true,
    resolveHref: (c) => (c.epicId ? `/portfolio/epics/${c.epicId}?tab=kpis` : "/portfolio/epics"),
  },
  {
    key: "pi-objective",
    label: "PI Objective",
    group: "more",
    indentLevel: 0,
    inPlace: true,
    resolveHref: (c) => (c.piId ? `/pi/${c.piId}/objectives?create=pi-objective` : "/pi-planning"),
  },
  {
    key: "impediment",
    label: "Impediment",
    group: "more",
    indentLevel: 0,
    inPlace: true,
    resolveHref: (c) => (c.artId ? `/art/${c.artId}/impediments?create=impediment` : "/art"),
  },
  {
    key: "dependency",
    label: "Dependency",
    group: "more",
    indentLevel: 0,
    inPlace: true,
    resolveHref: (c) =>
      c.featureId ? `/feature/${c.featureId}?create=dependency` : "/pi-planning",
  },
];
