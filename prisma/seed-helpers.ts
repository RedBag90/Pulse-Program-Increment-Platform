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
 * Wischt ALLE Domain-Daten eines Tenants FK-sicher (Blätter zuerst). Auth-User,
 * der Tenant selbst und Role-Assignments bleiben. Erweitert um die Tabellen, die
 * das Demo-Seed befüllt (Ziel-Kinder, Custom-Fields, Audit, Anfragen, …).
 */
export async function wipeDomainData(tenantId: string): Promise<void> {
  console.log("\n── Wiping domain data (tenant + auth + roles bleiben)");
  const w = { where: { tenantId } };

  // Ziele + Kinder (die meisten cascaden vom Objective, explizit ist sicher)
  await prisma.goalCheckin.deleteMany(w);
  await prisma.goalComment.deleteMany(w);
  await prisma.goalCustomFieldValue.deleteMany(w);
  await prisma.goalCustomFieldDef.deleteMany(w);
  await prisma.goalRelatedWork.deleteMany(w);
  await prisma.goalValueStreamLink.deleteMany(w);
  await prisma.goalArtLink.deleteMany(w);
  await prisma.goalEpicLink.deleteMany(w);
  await prisma.themeEpicLink.deleteMany(w);
  await prisma.objective.deleteMany(w);
  await prisma.strategicTheme.deleteMany(w);

  // Transformation
  await prisma.transformationAction.deleteMany(w);
  await prisma.targetOperatingModel.deleteMany(w);

  // Budgeting
  await prisma.budgetPlanRevision.deleteMany(w);
  await prisma.artBudget.deleteMany(w);
  await prisma.budgetAllocation.deleteMany(w);

  // Initiative-Nebentabellen
  await prisma.epicApproval.deleteMany(w);
  await prisma.kpi.deleteMany(w);
  await prisma.dependency.deleteMany(w);
  await prisma.initiativeGraphPosition.deleteMany(w);

  // Initiatives leaf-first (Feature vor Epic)
  await prisma.initiative.deleteMany({ where: { tenantId, level: 1 } });
  await prisma.initiative.deleteMany({ where: { tenantId, level: 0 } });

  // PI-scoped
  await prisma.piObjective.deleteMany(w);
  await prisma.impediment.deleteMany(w);
  await prisma.systemDemoItem.deleteMany(w);
  await prisma.systemDemo.deleteMany(w);
  await prisma.programIncrement.deleteMany(w);

  // Org-Struktur
  await prisma.team.deleteMany(w);
  await prisma.art.deleteMany(w);
  await prisma.timeline.deleteMany(w);
  await prisma.valueStream.deleteMany(w);

  // Standalone (tenantId-Scalar)
  await prisma.piStandard.deleteMany(w);
  await prisma.setupProgress.deleteMany(w);
  await prisma.roleCapability.deleteMany(w);
  await prisma.auditEvent.deleteMany(w);
  await prisma.tenantInvite.deleteMany(w);
  await prisma.tenantJoinRequest.deleteMany(w);

  console.log("  ✓ Domain-Daten gelöscht");
}

/**
 * Deterministische UUID aus einem String-Schlüssel (FNV-1a über mehrere Runden).
 * Gleicher Key ⇒ gleiche UUID ⇒ idempotenter Reseed + querverweisbare Relationen.
 */
export function uid(key: string): string {
  const bytes: number[] = [];
  let h = 0x811c9dc5 >>> 0;
  for (let round = 0; round < 16; round++) {
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i) + round * 131;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    bytes.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff);
    h = (h ^ (round * 0x9e3779b1)) >>> 0;
  }
  const b = bytes.slice(0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40; // Version 4
  b[8] = (b[8]! & 0x3f) | 0x80; // Variante
  const hex = b.map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
