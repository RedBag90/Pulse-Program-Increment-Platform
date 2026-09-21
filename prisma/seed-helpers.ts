/* eslint-disable no-console */
/**
 * Gemeinsame Seed-Bausteine für `seed.ts` (Minimal) und `seed-demo.ts` (Demo).
 *
 * Seiteneffekt-frei bis auf `loadEnvLocal()` (lädt `.env.local`, falls die
 * Standalone-Verbindung `DIRECT_URL` nicht schon im Shell-Env steht) und die
 * Instanziierung von `prisma`/`supabaseAdmin`. Kein `main()` — die Entry-Skripte
 * orchestrieren selbst.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { wipeTenantData } from "@/server/services/tenant-teardown";

/** Lädt `.env.local` (Repo-Root) in `process.env`, falls `DIRECT_URL` fehlt. */
export function loadEnvLocal(): void {
  if (process.env.DIRECT_URL) return;
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      const key = m?.[1];
      let v = m?.[2]?.trim();
      if (key === undefined || v === undefined) continue;
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = v;
    }
  } catch {
    // .env.local optional — dann muss das Shell-Env DIRECT_URL etc. liefern.
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DATABASE_URL = process.env.DIRECT_URL!;

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Standalone braucht die DIREKTE Verbindung (Port 5432); der 6543-Pooler scheitert. */
export const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

export const TENANT_ID = "00000000-0000-0000-0000-000000000001";
export const TENANT_NAME = "Pulse Demo Corp";

/** Führt `fn` mit bis zu `tries` Versuchen aus (kleiner Backoff) — robust gegen
 *  transiente Netzwerkfehler (Supabase-Auth-Timeouts). */
async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

/**
 * Legt einen Supabase-Auth-User an (idempotent) und gibt seine UUID zurück.
 * Robust: `listUsers` wird bei Netzwerkfehlern wiederholt und paginiert; ein
 * `email_exists` beim Anlegen (Race / verpasste Liste) führt zum erneuten Suchen
 * statt zum Abbruch.
 */
export async function upsertAuthUser(email: string, password: string): Promise<string> {
  const find = () =>
    withRetry(async () => {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      return data?.users.find((u) => u.email === email);
    });

  const existing = await find();
  if (existing) {
    console.log(`  ↳ ${email}`);
    return existing.id;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (data?.user) {
    console.log(`  ✓ ${email}`);
    return data.user.id;
  }
  // Bereits vorhanden (z. B. Liste war beim ersten Versuch getimeoutet) → erneut suchen.
  const again = await find();
  if (again) {
    console.log(`  ↳ ${email}`);
    return again.id;
  }
  throw error ?? new Error(`Failed to create ${email}`);
}

/** Findet den Demo-Tenant per Name oder legt ihn an (Org ⇒ alle Module). */
export async function ensureTenant(): Promise<string> {
  const existing = await prisma.tenant.findFirst({ where: { name: TENANT_NAME } });
  if (existing) {
    console.log(`  ↳ ${TENANT_NAME} existiert`);
    return existing.id;
  }
  const tenant = await prisma.tenant.create({
    data: { id: TENANT_ID, name: TENANT_NAME, region: "eu", kind: "organization" },
  });
  console.log(`  ✓ ${TENANT_NAME} angelegt`);
  return tenant.id;
}

/**
 * Findet einen bestehenden Mandanten per Name — **ohne Anlegen**.
 *
 * Bewusst nicht find-or-create wie `ensureTenant`: Seeds, die auf einen schon
 * vorhandenen Mandanten zielen, wischen dessen Daten. Ein Tippfehler im Namen
 * würde bei find-or-create still einen Doppelgänger anlegen und den dann leeren
 * — der Fehler fiele erst auf, wenn die erwarteten Daten fehlen. Also lieber
 * hier abbrechen.
 */
export async function requireTenantByName(name: string): Promise<string> {
  const tenant = await prisma.tenant.findFirst({ where: { name } });
  if (!tenant) {
    const all = await prisma.tenant.findMany({ select: { name: true }, orderBy: { name: "asc" } });
    throw new Error(
      `Mandant „${name}" existiert nicht. Vorhanden: ${all.map((t) => `„${t.name}"`).join(", ") || "(keiner)"}`,
    );
  }
  console.log(`  ↳ ${name} gefunden`);
  return tenant.id;
}

/** Rollen-Zuweisung (idempotent) mit optionalen Scopes. */
export function assignRole(
  userId: string,
  tenantId: string,
  role: string,
  scopes: { valueStreamIds?: string[]; artIds?: string[]; teamIds?: string[] } = {},
) {
  const data = {
    valueStreamIds: scopes.valueStreamIds ?? [],
    artIds: scopes.artIds ?? [],
    teamIds: scopes.teamIds ?? [],
  };
  return prisma.userRoleAssignment.upsert({
    where: { userId_tenantId_role: { userId, tenantId, role } },
    create: { userId, tenantId, role, ...data },
    update: data,
  });
}

/**
 * Wischt alle Fachdaten eines Mandanten. Auth-Konten, der Mandant selbst und die
 * Rollenzuweisungen bleiben.
 *
 * **Die Reihenfolge steht nicht mehr hier.** Sie liegt in
 * `src/server/services/tenant-teardown.ts`, weil zwei Wege sie brauchen: dieser
 * Reseed und das Loeschen eines Mandanten in der Plattform-Verwaltung. Zwei
 * Listen waeren die Doppelung, an der dieses Repo schon mehrfach
 * haengengeblieben ist — und ein Test dort haelt sie gegen Prismas DMMF.
 *
 * **Seit dem Umzug raeumt der Reseed sechs Tabellen mehr**, die vorher als
 * Leichen liegenblieben: `ViewPreference`, `RoleOnboarding`, `JiraConfig`,
 * `AzureDevOpsConfig`, `OutboxEvent`, `IdempotencyKey`.
 */
export async function wipeDomainData(tenantId: string): Promise<void> {
  console.log("\n── Wiping domain data (tenant + auth + roles bleiben)");
  const { total } = await wipeTenantData(prisma, tenantId);
  console.log(`  ✓ Domain-Daten gelöscht (${total} Zeilen)`);
}

/**
 * **`uid` und `uidFor` liegen jetzt in `seed-ids.ts`** und werden hier nur
 * weitergereicht, damit die bestehenden Importe stehen bleiben. Der Grund fuer
 * die Trennung steht dort: diese Datei laedt beim Import `.env.local` und baut
 * einen Prisma-Client — die Id-Regel muss ohne beides auskommen, sonst kann die
 * App sie nicht importieren.
 */
export { uid, uidFor, type Uid } from "./seed-ids.js";
