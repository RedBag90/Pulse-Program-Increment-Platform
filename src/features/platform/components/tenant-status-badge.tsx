const STYLES: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktiv", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  suspended: { label: "Gesperrt", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  archived: { label: "Archiviert", cls: "bg-muted text-muted-foreground" },
};

/** Statuspille für den Tenant-Lifecycle (aktiv/gesperrt/archiviert). */
export function TenantStatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? STYLES.active!;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
