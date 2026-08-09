import type { Role } from "@/modules/core/kernel/domain/roles";
import { ALL_ROLES } from "@/modules/core/kernel/domain/roles";

/**
 * Admin users page-model — turns the loaded `UserRoleAssignment` rows + the
 * value-stream / ART catalogue + the userLabels map into a per-user view that
 * the master-detail page consumes. The old page lists assignments (one user
 * appears N times for N roles); this model groups them so each user is one
 * list row, with the role + scope detail inside the user.
 *
 * Pure: no I/O. Mirrors `transformation-goals` and `portfolio-epics-list`.
 */

/** One role row inside a user's detail pane. Mirrors the Prisma row + label join. */
export interface RoleAssignmentView {
  id: string;
  role: Role;
  /** Empty `[]` means "all in reach" — the scope picker renders "Alle". */
  valueStreamIds: string[];
  artIds: string[];
  teamIds: string[];
  /** ISO-day string for the "Seit"-Anzeige. */
  createdAt: string;
}

/** One user row in the master list — also drives the detail-pane header. */
export interface UserListItem {
  id: string;
  /** Email if known, else null (the row falls back to the user id then). */
  email: string | null;
  /** Display label resolved from `listTenantUserLabels`. */
  label: string;
  /** First-two-letters initials for the avatar circle. */
  initials: string;
  roles: Role[];
  roleCount: number;
  assignments: RoleAssignmentView[];
}

/** Per-ART summary needed by the scope picker (kept here so the page-model is the one shape the shell consumes). */
export interface ValueStreamOption {
  id: string;
  name: string;
  arts: { id: string; name: string }[];
}

export interface UsersPageModel {
  users: UserListItem[];
  /** All assigned roles in the dataset — drives the filter chips with counts. */
  roleCounts: Record<Role, number>;
  valueStreamOptions: ValueStreamOption[];
}

// ---- Input row types ----

interface AssignmentRow {
  id: string;
  userId: string;
  role: string;
  valueStreamIds: string[];
  artIds: string[];
  teamIds: string[];
  createdAt: Date;
}

interface ValueStreamRow {
  id: string;
  name: string;
  arts: { id: string; name: string }[];
}

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * "Alice Anderson" → "AA"; an email like `bob@x.com` → "BO"; bare userId →
 * the first two chars uppercased. Always returns 2 chars so the avatar
 * circle has a stable shape.
 */
function deriveInitials(label: string): string {
  const trimmed = label.trim();
  if (trimmed === "") return "··";
  const parts = trimmed.split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function buildUsersPageModel(input: {
  assignments: readonly AssignmentRow[];
  valueStreams: readonly ValueStreamRow[];
  userLabels: Readonly<Record<string, string>>;
  /**
   * Optional user-id → email lookup. When omitted (the page can't always
   * reach Supabase Auth), the row falls back to the label.
   */
  userEmails?: Readonly<Record<string, string>>;
}): UsersPageModel {
  const { assignments, valueStreams, userLabels, userEmails } = input;

  // Group by userId — one list row per user, however many roles.
  const byUser = new Map<string, AssignmentRow[]>();
  for (const a of assignments) {
    const list = byUser.get(a.userId) ?? [];
    list.push(a);
    byUser.set(a.userId, list);
  }

  const users: UserListItem[] = [...byUser.entries()]
    .map(([userId, rows]) => {
      const label = userLabels[userId] ?? userId;
      const email = userEmails?.[userId] ?? null;
      const assignmentsView: RoleAssignmentView[] = rows.map((r) => ({
        id: r.id,
        role: r.role as Role,
        valueStreamIds: r.valueStreamIds,
        artIds: r.artIds,
        teamIds: r.teamIds,
        createdAt: isoDay(r.createdAt),
      }));
      const roles = assignmentsView.map((a) => a.role);
      return {
        id: userId,
        email,
        label,
        initials: deriveInitials(email ?? label),
        roles,
        roleCount: roles.length,
        assignments: assignmentsView,
      } satisfies UserListItem;
    })
    .sort((a, b) => a.label.localeCompare(b.label, "de"));

  // Role-count map — used by the filter chips. All roles get a slot (even 0)
  // so the chip list is stable across renders.
  const roleCounts = Object.fromEntries(ALL_ROLES.map((r) => [r, 0])) as Record<Role, number>;
  for (const u of users) {
    for (const r of u.roles) {
      if (roleCounts[r] != null) roleCounts[r] += 1;
    }
  }

  const valueStreamOptions: ValueStreamOption[] = valueStreams.map((vs) => ({
    id: vs.id,
    name: vs.name,
    arts: vs.arts,
  }));

  return { users, roleCounts, valueStreamOptions };
}
