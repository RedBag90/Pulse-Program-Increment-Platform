import { ALL_ROLES, ROLE_LABELS } from "@/modules/core/kernel/domain/roles";

/**
 * **Die Rollen**, gezaehlt aus `ALL_ROLES` statt aus dem Gedaechtnis.
 *
 * Der Text daneben sagt „acht Rollen" nicht — er sagt „diese Rollen", und die
 * Figur nennt sie. Aeltere Bezeichnungen sind darin aufgegangen; wer sie in
 * einem alten Dokument findet, findet sie hier nicht mehr, und genau das ist
 * die Auskunft.
 */
export function RoleList() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_ROLES.map((r) => (
        <span
          key={r}
          className="rounded-md border bg-background px-2.5 py-1.5 text-xs text-foreground"
        >
          {ROLE_LABELS[r]} <code className="font-mono text-meta text-muted-foreground">{r}</code>
        </span>
      ))}
    </div>
  );
}
