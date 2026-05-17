"use client";

import { useEffect, useState } from "react";

/** Parent-entity kinds whose option lists a create dialog may need to load. */
export type ParentKind = "valueStream" | "art" | "epic" | "feature" | "pi" | "team";

/**
 * Resolves the `GET /api/v1/…` endpoint for a parent-option list. Returns
 * `null` when a cascading parameter (e.g. `artId`) is still missing — the
 * dialog then waits for the upstream select. Pure, so it is unit-testable.
 */
export function optionsEndpoint(kind: ParentKind, params?: { artId?: string }): string | null {
  switch (kind) {
    case "valueStream":
      return "/api/v1/value-streams";
    case "art":
      return "/api/v1/arts";
    case "epic":
      return "/api/v1/initiatives";
    case "feature":
      return params?.artId ? `/api/v1/features?artId=${params.artId}` : null;
    case "pi":
      return params?.artId ? `/api/v1/pis?artId=${params.artId}` : null;
    case "team":
      return params?.artId ? `/api/v1/teams?artId=${params.artId}` : null;
  }
}

export interface EntityOptionsState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

/**
 * Lazily loads a parent-option list from `endpoint` once `enabled` is true.
 * Accepts both a bare array response and a paginated `{ items }` response.
 * Used by create dialogs opened from the global "+" menu, which have no
 * page-supplied option props.
 */
export function useEntityOptions<T>(
  endpoint: string | null,
  enabled: boolean,
): EntityOptionsState<T> {
  const [state, setState] = useState<EntityOptionsState<T>>({
    data: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled || !endpoint) return;

    let cancelled = false;
    setState({ data: [], loading: true, error: null });

    fetch(endpoint, { headers: { accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((json: unknown) => {
        if (cancelled) return;
        const data: T[] = Array.isArray(json)
          ? (json as T[])
          : Array.isArray((json as { items?: unknown }).items)
            ? (json as { items: T[] }).items
            : [];
        setState({ data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({
          data: [],
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load options",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint, enabled]);

  return state;
}
