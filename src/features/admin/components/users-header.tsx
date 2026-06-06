"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, type Role } from "@/domain/roles";

interface Props {
  query: string;
  roleFilter: Role | null;
  canManage: boolean;
  totalCount: number;
  roleCounts: Record<Role, number>;
  onQueryChange: (next: string) => void;
  onRoleFilterChange: (next: Role | null) => void;
  onInvite: () => void;
}

/**
 * Title + primary CTA + role filter chips (with live counts) + 200ms-debounced
 * search. Only roles that have at least one user assigned show as chips —
 * otherwise the chip row would be a wall of 13 roles, most of them empty.
 */
export function UsersHeader({
  query,
  roleFilter,
  canManage,
  totalCount,
  roleCounts,
  onQueryChange,
  onRoleFilterChange,
  onInvite,
}: Props) {
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  useEffect(() => {
    if (draft === query) return;
    const t = window.setTimeout(() => onQueryChange(draft), 200);
    return () => window.clearTimeout(t);
  }, [draft, query, onQueryChange]);

  const activeRoles = (Object.entries(roleCounts) as [Role, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Benutzer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tenant-Mitglieder, ihre Rollen und Sichtbarkeits-Scopes.
          </p>
        </div>
        {canManage && (
          <Button type="button" size="sm" onClick={onInvite}>
            <UserPlus className="size-3.5" /> Einladen
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          <Chip
            label="Alle"
            count={totalCount}
            active={roleFilter === null}
            onClick={() => onRoleFilterChange(null)}
          />
          {activeRoles.map(([role, count]) => (
            <Chip
              key={role}
              label={ROLE_LABELS[role]}
              count={count}
              active={roleFilter === role}
              onClick={() => onRoleFilterChange(roleFilter === role ? null : role)}
            />
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Suche…"
            className="h-8 pl-7"
          />
        </div>
      </div>
    </header>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card text-foreground hover:bg-muted/50"
      }`}
      aria-pressed={active}
    >
      {label}
      <span className={`tabular-nums ${active ? "opacity-80" : "text-muted-foreground"}`}>
        {count}
      </span>
    </button>
  );
}
