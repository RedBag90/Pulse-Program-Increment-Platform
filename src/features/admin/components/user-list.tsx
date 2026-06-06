"use client";

import { Users } from "lucide-react";
import { UserListRow } from "@/features/admin/components/user-list-row";
import type { UserListItem } from "@/server/views/admin-users";
import type { Selection } from "@/features/admin/components/users-selection";

interface Props {
  users: UserListItem[];
  selection: Selection;
  onSelectUser: (id: string) => void;
}

/**
 * Left column of the admin users page — renders the filtered user list as a
 * scrollable column of compact rows. Empty state nudges the user toward the
 * invite flow. Mirrors `goal-list.tsx` shape.
 */
export function UserList({ users, selection, onSelectUser }: Props) {
  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Users className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Keine Benutzer gefunden — Filter anpassen oder einen einladen.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {users.map((u) => (
        <li key={u.id}>
          <UserListRow
            user={u}
            selected={selection.kind === "user" && selection.id === u.id}
            onSelect={onSelectUser}
          />
        </li>
      ))}
    </ul>
  );
}
