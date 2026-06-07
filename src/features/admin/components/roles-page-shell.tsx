"use client";

import { useCallback, useState, startTransition, useActionState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  setRoleCapabilityAction,
  removeRoleCapabilityAction,
  resetRoleToDefaultAction,
} from "@/features/admin/actions/role-capability";
import {
  CAPABILITY_DOMAINS,
  type AdminRolesPageModel,
  type RoleView,
} from "@/server/views/admin-roles";
import type { Action, ScopeCheck } from "@/server/auth/policies";

interface Props {
  model: AdminRolesPageModel;
  canManage: boolean;
}

const SCOPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Global" },
  { value: "value_stream", label: "Wertstrom" },
  { value: "art", label: "ART" },
  { value: "team", label: "Team" },
  { value: "own", label: "Eigene Items" },
];
const SCOPE_LABELS: Record<string, string> = Object.fromEntries(
  SCOPE_OPTIONS.map((o) => [o.value || "global", o.label]),
);

/**
 * Admin-Roles Shell — Master-Detail: links die 13 Rollen mit Diff-Anzeige,
 * rechts die Capability-Liste der gewählten Rolle gruppiert nach Domäne.
 */
export function RolesPageShell({ model, canManage }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedRoleParam = searchParams.get("role");
  const selectedRole = model.roles.find((r) => r.role === selectedRoleParam) ?? model.roles[0]!;

  const pushSelection = useCallback(
    (role: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("role", role);
      router.replace(`${pathname}?${params.toString()}` as never, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <main className="space-y-6 p-6 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Rollen &amp; Capabilities</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pro Rolle einzelne Capabilities zuweisen oder entziehen. Das Default- Bundle stammt aus
          dem Code; Tenant-Anpassungen leben in der Datenbank.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <nav aria-label="Rollen" className="space-y-1">
          {model.roles.map((r) => {
            const isActive = r.role === selectedRole.role;
            const hasDiff =
              r.diffFromDefault.added + r.diffFromDefault.removed + r.diffFromDefault.scopeChanged >
              0;
            return (
              <button
                key={r.role}
                type="button"
                onClick={() => pushSelection(r.role)}
                className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? "border-primary bg-primary/10"
                    : "border-input bg-card hover:bg-muted/40"
                }`}
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-muted-foreground" />
                  <span className="font-medium">{r.label}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  {hasDiff && (
                    <span
                      className="size-1.5 rounded-full bg-amber-500"
                      title="Tenant-Anpassung gegenüber Default"
                    />
                  )}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {r.grantedCount}/{r.defaultCount}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <RoleDetailPane role={selectedRole} canManage={canManage} />
      </div>
    </main>
  );
}

function RoleDetailPane({ role, canManage }: { role: RoleView; canManage: boolean }) {
  const [resetState, resetDispatch, resetPending] = useActionState(resetRoleToDefaultAction, {});

  function reset() {
    if (!window.confirm(`Rolle „${role.label}" auf das Standard-Bundle zurücksetzen?`)) return;
    const fd = new FormData();
    fd.set("role", role.role);
    startTransition(() => resetDispatch(fd));
  }

  const hasDiff =
    role.diffFromDefault.added + role.diffFromDefault.removed + role.diffFromDefault.scopeChanged >
    0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
        <div>
          <h2 className="text-lg font-semibold">{role.label}</h2>
          <p className="text-xs text-muted-foreground">
            {role.grantedCount} Capabilities aktiv · Default-Bundle: {role.defaultCount}
          </p>
          {hasDiff && (
            <p className="mt-1 text-xs text-amber-700">
              Δ vs. Default: +{role.diffFromDefault.added} hinzugefügt · −
              {role.diffFromDefault.removed} entzogen · {role.diffFromDefault.scopeChanged} Scope
              geändert
            </p>
          )}
        </div>
        {canManage && hasDiff && (
          <Button type="button" size="sm" variant="outline" disabled={resetPending} onClick={reset}>
            <RotateCcw className="size-3.5" /> Auf Default zurücksetzen
          </Button>
        )}
      </div>

      {resetState.error && (
        <p role="alert" className="text-sm text-destructive">
          {resetState.error}
        </p>
      )}

      <div className="space-y-4">
        {CAPABILITY_DOMAINS.map((domain) => {
          const rows = role.capabilities.filter((c) => domain.actions.includes(c.action));
          if (rows.length === 0) return null;
          return (
            <div key={domain.key} className="overflow-hidden rounded-lg border bg-card">
              <div className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {domain.label}
              </div>
              <ul className="divide-y">
                {rows.map((row) => (
                  <CapabilityRow
                    key={row.action}
                    role={role.role}
                    row={row}
                    canManage={canManage}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface CapabilityRowProps {
  role: string;
  row: {
    action: Action;
    scope: ScopeCheck | null;
    granted: boolean;
    isDefault: boolean;
    defaultScope: ScopeCheck | null;
  };
  canManage: boolean;
}

function CapabilityRow({ role, row, canManage }: CapabilityRowProps) {
  const [scopeDraft, setScopeDraft] = useState<string>(row.scope ?? "");
  const [setState, setDispatch, setPending] = useActionState(setRoleCapabilityAction, {});
  const [removeState, removeDispatch, removePending] = useActionState(
    removeRoleCapabilityAction,
    {},
  );
  const pending = setPending || removePending;
  const error = setState.error ?? removeState.error;

  function grant(scope: string) {
    const fd = new FormData();
    fd.set("role", role);
    fd.set("action", row.action);
    if (scope) fd.set("scope", scope);
    startTransition(() => setDispatch(fd));
  }
  function revoke() {
    const fd = new FormData();
    fd.set("role", role);
    fd.set("action", row.action);
    startTransition(() => removeDispatch(fd));
  }

  const isDirty = row.granted && row.isDefault && row.scope !== row.defaultScope;
  const isAdded = row.granted && !row.isDefault;
  const isRemoved = !row.granted && row.isDefault;

  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
      <label className="flex flex-1 items-center gap-2">
        <input
          type="checkbox"
          checked={row.granted}
          disabled={!canManage || pending}
          onChange={(e) => (e.target.checked ? grant(scopeDraft) : revoke())}
          className="size-4 rounded border-border"
        />
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{row.action}</code>
        {isAdded && (
          <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] text-emerald-700">+</span>
        )}
        {isRemoved && (
          <span className="rounded-full bg-red-100 px-1.5 text-[10px] text-red-700">−</span>
        )}
        {isDirty && (
          <span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-700">
            Δ scope
          </span>
        )}
      </label>

      {row.isDefault && (
        <span className="text-[11px] text-muted-foreground">
          Default: {SCOPE_LABELS[row.defaultScope ?? "global"]}
        </span>
      )}

      <div className="flex items-center gap-1.5">
        <select
          value={row.granted ? (row.scope ?? "") : scopeDraft}
          onChange={(e) => {
            const v = e.target.value;
            setScopeDraft(v);
            if (row.granted) grant(v);
          }}
          disabled={!canManage || pending}
          className="rounded-md border border-input bg-card px-2 py-1 text-xs"
        >
          {SCOPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {setState.success && (
          <CheckCircle2 className="size-3.5 text-emerald-600" aria-label="Gespeichert" />
        )}
      </div>

      {error && (
        <p role="alert" className="w-full text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
