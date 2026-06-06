"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PlugZap } from "lucide-react";
import { IntegrationList } from "@/features/admin/components/integration-list";
import { IntegrationDetailPane } from "@/features/admin/components/integration-detail-pane";
import {
  parseSelection,
  encodeSelection,
  type Selection,
} from "@/features/admin/components/integrations-selection";
import type { IntegrationsPageModel, IntegrationKind } from "@/server/views/admin-integrations";

interface Props {
  model: IntegrationsPageModel;
  canManage: boolean;
  /** Optional "verbunden!" / "Fehler:" banner from the OAuth callback. */
  banner?: { kind: "success"; message: string } | { kind: "error"; message: string } | undefined;
}

/**
 * Admin integrations page shell. With only two list items the layout still
 * benefits from master-detail (the right pane holds the mapping form +
 * webhook block, which were duplicated across two stacked sections in the
 * old page). Selection defaults to the first connected integration; the
 * first list entry otherwise.
 */
export function IntegrationsPageShell({ model, canManage, banner }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const explicit = parseSelection(searchParams.get("selected"));
  // Default-pick the first connected integration; else the first one in the list.
  const fallback: IntegrationKind =
    model.list.find((i) => i.connected)?.kind ?? model.list[0]?.kind ?? "jira";
  const selection: Selection =
    explicit.kind === "integration" ? explicit : { kind: "integration", integration: fallback };

  const pushParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
      const next = params.toString();
      router.replace(`${pathname}${next ? `?${next}` : ""}` as never, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const onSelect = useCallback(
    (kind: IntegrationKind) =>
      pushParam("selected", encodeSelection({ kind: "integration", integration: kind })),
    [pushParam],
  );

  const detail = selection.integration === "jira" ? model.jira : model.ado;

  return (
    <div className="space-y-4 p-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Integrationen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Externe Tools mit Pulse verbinden — Stories und Work Items synchronisieren.
        </p>
      </header>

      {banner && (
        <div
          role={banner.kind === "error" ? "alert" : "status"}
          className={`rounded-md border px-3 py-2 text-sm ${
            banner.kind === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {banner.message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-1">
          <IntegrationList items={model.list} selection={selection} onSelect={onSelect} />
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          {detail ? (
            <IntegrationDetailPane detail={detail} arts={model.arts} canManage={canManage} />
          ) : (
            <EmptyPane />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyPane() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <PlugZap className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">Wähle eine Integration aus der Liste.</p>
    </div>
  );
}
