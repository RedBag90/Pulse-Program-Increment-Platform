"use client";

import { ROLE_LABELS } from "@/domain/roles";
import type { UserListItem } from "@/server/views/admin-users";

interface Props {
  user: UserListItem;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Compact user row in the master list — replaces the old assignment-flat
 * table (where one user with 2 roles showed up twice) with one row per user.
 * Initials avatar + email/label + role-count badge + scope summary +
 * selected-state ring.
 */
export function UserListRow({ user, selected, onSelect }: Props) {
  const primaryRole = user.roles[0] ?? null;
  const moreRoles = user.roles.length > 1 ? user.roles.length - 1 : 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(user.id)}
      className={`group w-full rounded-md border bg-card p-3 text-left transition-colors hover:bg-muted/50 ${
        selected ? "border-primary ring-1 ring-primary" : ""
      }`}
      aria-current={selected ? "true" : undefined}
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-muted-foreground"
          aria-hidden
        >
          {user.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.email ?? user.label}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {primaryRole ? ROLE_LABELS[primaryRole] : "—"}
            {moreRoles > 0 ? ` · +${moreRoles} weitere` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
          {user.roleCount}
        </span>
      </div>
    </button>
  );
}
