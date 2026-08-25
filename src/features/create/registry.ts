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
  group: "strategy" | "portfolio" | "initiative" | "more";
  indentLevel: 0 | 1 | 2 | 3;
  inPlace?: boolean;
  resolveHref: (ctx: CreateContext) => string;
}

export const CREATE_GROUPS: { key: CreateEntry["group"]; label: string }[] = [
  { key: "strategy", label: "Strategie" },
  { key: "portfolio", label: "Portfolio" },
  { key: "initiative", label: "Initiative" },
  { key: "more", label: "More" },
];

export const CREATE_REGISTRY: CreateEntry[] = [
  {
    key: "goal",
    label: "Ziel",
    group: "strategy",
    indentLevel: 0,
    inPlace: true,
    resolveHref: () => "/ziele?entity=goal&new=1",
  },
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
    key: "solution",
    label: "Solution",
    group: "portfolio",
    indentLevel: 1,
    inPlace: true,
    resolveHref: () => "/portfolio/solutions?create=solution",
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
    key: "dependency",
    label: "Dependency",
    group: "more",
    indentLevel: 0,
    inPlace: true,
    resolveHref: (c) =>
      c.featureId ? `/feature/${c.featureId}?create=dependency` : "/pi-planning",
  },
  {
    key: "risk",
    label: "Risk",
    group: "more",
    indentLevel: 0,
    inPlace: true,
    resolveHref: () => "/risks?create=risk",
  },
];
