import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Supabase-Auth-Verzeichnis-Helfer für die Plattform-Fläche. Der `platform_admin`
 * arbeitet tenant-übergreifend über E-Mails/User-Ids; die Zuordnung E-Mail ↔
 * User-Id lebt in Supabase Auth (nicht in Prisma). Read-only, never throws für
 * die Map-Variante — Aufrufer fallen auf die rohe Id zurück.
 */

/** User-Id → E-Mail für eine Menge von Ids (eine große Page; System ist klein). */
export async function resolveUserEmails(
  userIds: readonly string[],
): Promise<Record<string, string>> {
  const ids = new Set(userIds);
  if (ids.size === 0) return {};
  const out: Record<string, string> = {};
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) return {};
    for (const u of data.users) {
      if (ids.has(u.id) && u.email) out[u.id] = u.email;
    }
  } catch {
    return {};
  }
  return out;
}

/** Sucht die Supabase-User-Id zu einer E-Mail (case-insensitiv). Null, wenn unbekannt. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const admin = createAdminClient();
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}
