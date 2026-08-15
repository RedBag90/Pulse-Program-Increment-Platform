"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Users } from "lucide-react";
import { UsersHeader } from "@/features/admin/components/users-header";
import { UserList } from "@/features/admin/components/user-list";
import { UserDetailPane } from "@/features/admin/components/user-detail-pane";
import { InviteUserForm } from "@/features/admin/components/invite-user-form";
import {
  parseSelection,
  encodeSelection,
  type Selection,
} from "@/features/admin/components/users-selection";
import { ALL_ROLES, ROLE_LABELS, type Role } from "@/modules/core/kernel/domain/roles";
import type { UsersPageModel } from "@/server/views/admin-users";

interface Props {
  model: UsersPageModel;
  canManage: boolean;
}

const ROLE_SET = new Set<string>(ALL_ROLES);

function parseRole(raw: string | null): Role | null {
  if (raw && ROLE_SET.has(raw)) return raw as Role;
  return null;
}

/**
 * Admin users page shell — owns URL state (`?role`, `?q`, `?selected`) and
 * the two-column master-detail layout. Mirrors `goals-page-shell.tsx`.
 */
export function UsersPageShell({ model, canManage }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const roleFilter = parseRole(searchParams.get("role"));
  const query = searchParams.get("q") ?? "";
  const selection = parseSelection(searchParams.get("selected"));

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

  const onQueryChange = useCallback((next: string) => pushParam("q", next || null), [pushParam]);
  const onRoleFilterChange = useCallback(
    (next: Role | null) => pushParam("role", next),
    [pushParam],
  );
  const setSelection = useCallback(
    (sel: Selection) => pushParam("selected", encodeSelection(sel)),
    [pushParam],
  );
  const onSelectUser = useCallback(
    (id: string) => setSelection({ kind: "user", id }),
    [setSelection],
  );
  const onInvite = useCallback(() => setSelection({ kind: "invite" }), [setSelection]);
  const clearSelection = useCallback(() => setSelection({ kind: "none" }), [setSelection]);

  // Filtered users list — case-insensitive search across email + label + role label.
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return model.users.filter((u) => {
      if (roleFilter != null && !u.roles.includes(roleFilter)) return false;
      if (q === "") return true;
      if (u.email?.toLowerCase().includes(q)) return true;
      if (u.label.toLowerCase().includes(q)) return true;
      return u.roles.some((r) => ROLE_LABELS[r].toLowerCase().includes(q));
    });
  }, [model.users, roleFilter, query]);

  const selectedUser =
    selection.kind === "user" ? (model.users.find((u) => u.id === selection.id) ?? null) : null;

  // Surface a small notice if the selected user is filtered out of view.
  const selectedOutOfView =
    selectedUser != null && !filteredUsers.some((u) => u.id === selectedUser.id);

  return (
    <div className="space-y-4 p-6">
      <UsersHeader
        query={query}
        roleFilter={roleFilter}
        canManage={canManage}
        totalCount={model.users.length}
        roleCounts={model.roleCounts}
        onQueryChange={onQueryChange}
        onRoleFilterChange={onRoleFilterChange}
        onInvite={onInvite}
      />

      {selectedOutOfView && (
        <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>Ausgewählte:r Benutzer:in ist im aktuellen Filter nicht sichtbar.</span>
          <button
            type="button"
            onClick={() => onRoleFilterChange(null)}
            className="font-medium underline hover:no-underline"
          >
            Filter zurücksetzen
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div
          data-tour="admin-user-list"
          className="lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-1"
        >
          <UserList users={filteredUsers} selection={selection} onSelectUser={onSelectUser} />
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          {selection.kind === "invite" ? (
            <InvitePane onDone={clearSelection} />
          ) : selection.kind === "user" && selectedUser ? (
            <UserDetailPane
              user={selectedUser}
              valueStreams={model.valueStreamOptions}
              canManage={canManage}
              canErase={canManage}
            />
          ) : (
            <EmptyPane />
          )}
        </div>
      </div>
    </div>
  );
}

function InvitePane({ onDone }: { onDone: () => void }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-medium">Neue:n Benutzer:in einladen</h2>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-muted-foreground hover:underline"
        >
          Abbrechen
        </button>
      </div>
      <InviteUserForm />
    </section>
  );
}

function EmptyPane() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <Users className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">
        Wähle eine:n Benutzer:in aus der Liste — oder lade jemanden neu ein.
      </p>
    </div>
  );
}
