/**
 * Pure route → parent-context logic. Kept free of client/router imports so it
 * is unit-testable without pulling in the next-intl navigation module.
 */

/** Parent IDs that can be derived from the current route, used to pre-fill creates. */
export interface CreateContext {
  artId?: string;
  piId?: string;
  featureId?: string;
  epicId?: string;
}

/** Derives the known parent IDs from a (locale-stripped) pathname. */
export function parseCreateContext(pathname: string): CreateContext {
  const ctx: CreateContext = {};

  const art = pathname.match(/^\/art\/([^/]+)/);
  if (art?.[1]) ctx.artId = art[1];

  const pi = pathname.match(/^\/pi\/([^/]+)/);
  if (pi?.[1]) ctx.piId = pi[1];

  const feature = pathname.match(/^\/feature\/([^/]+)/);
  if (feature?.[1]) ctx.featureId = feature[1];

  const epic = pathname.match(/^\/portfolio\/epics\/([^/]+)/);
  if (epic?.[1]) ctx.epicId = epic[1];

  return ctx;
}
