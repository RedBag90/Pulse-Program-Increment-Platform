/* eslint-disable no-console */
/**
 * Einmal-Skript: die Mehrparteien-Freigabe-Achse abräumen.
 *
 * Hypothese und Business Case haben keine eigene Freigabe mehr — die Abnahme
 * der Reifegrad-Schritte L0 → L1 bzw. L2 → L3.1 *ist* sie. Damit entfallen
 * `epic_approvals`, `initiatives.approval_phase` und
 * `initiatives.approval_revision`.
 *
 * Dieses Skript überführt die **laufenden** Vorgänge, bevor die Spalten fallen:
 *
 * | Ausgangslage                         | Ergebnis                                              |
 * | ------------------------------------ | ----------------------------------------------------- |
 * | `approval_phase = stakeholder_review` | offener L2 → L3.1-Antrag mit einer Abnahme-Zeile je Partei |
 * | `approval_phase = hypothesis_review`  | nichts — das Epic steht wieder vor dem L0 → L1-Antrag  |
 * | `approval_phase = business_case`      | nichts — es war noch nicht eingereicht                 |
 * | `business_case_approved_at` auf L2    | nur gemeldet — erfüllt das neue Kriterium und wandert beim nächsten Antrag |
 *
 * Läuft über **rohes SQL**: der generierte Prisma-Client kennt die alten
 * Strukturen nicht mehr. Reihenfolge ist deshalb: erst dieses Skript, dann
 * `prisma db push` mit dem neuen Schema.
 *
 * Idempotent: ein Epic, das bereits einen offenen Antrag trägt, wird
 * übersprungen (der partielle Unique-Index lässt nur einen zu).
 *
 * Aufruf: pnpm tsx prisma/scripts/2026-08-30-retire-epic-approval-axis.ts
 */
import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();

/** Partei-Wert der alten Zeile → Rollen-Platzhalter der Gate-Achse. */
const ROLE_BY_PARTY: Record<string, string> = {
  mgmt: "epic.party.mgmt",
  business_owner: "epic.party.business_owner",
  finance: "epic.party.finance",
  irt_owner: "epic.party.irt_owner",
  lace_vmo: "epic.party.lace_vmo",
};

interface PendingEpic {
  id: string;
  tenant_id: string;
  title: string;
  stage_gate: string;
  approval_revision: number;
  owner_id: string | null;
}

interface PartyRow {
  initiative_id: string;
  party: string | null;
  approver_user_id: string | null;
  status: string;
  requested_at: Date;
  decided_at: Date | null;
  comment: string | null;
  created_by: string;
}

async function main(): Promise<void> {
  const tableExists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT to_regclass('public.epic_approvals') IS NOT NULL AS exists`,
  );
  if (!tableExists[0]?.exists) {
    console.log("epic_approvals existiert nicht mehr — nichts zu tun.");
    return;
  }

  const epics = await prisma.$queryRawUnsafe<PendingEpic[]>(
    `SELECT id, tenant_id, title, stage_gate, approval_revision, owner_id
       FROM initiatives
      WHERE level = 0 AND deleted_at IS NULL AND approval_phase = 'stakeholder_review'`,
  );
  console.log(`Epics in laufender Stakeholder-Freigabe: ${epics.length}`);

  let migrated = 0;
  let skipped = 0;
  for (const e of epics) {
    const open = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM stage_gate_transitions
        WHERE initiative_id = $1::uuid AND status = 'pending' LIMIT 1`,
      e.id,
    );
    if (open.length > 0) {
      skipped += 1;
      continue;
    }

    const rows = await prisma.$queryRawUnsafe<PartyRow[]>(
      `SELECT initiative_id, party, approver_user_id, status, requested_at, decided_at,
              comment, created_by
         FROM epic_approvals
        WHERE initiative_id = $1::uuid AND kind = 'party' AND revision = $2
          AND approver_user_id IS NOT NULL`,
      e.id,
      e.approval_revision,
    );
    if (rows.length === 0) {
      console.warn(`  ! ${e.title}: keine besetzte Partei-Zeile — übersprungen.`);
      skipped += 1;
      continue;
    }

    // Die früheste Anfrage ist der Antragszeitpunkt: der Lauf begann, als die
    // erste Partei angefragt wurde.
    const requestedAt = rows.reduce(
      (min, r) => (r.requested_at < min ? r.requested_at : min),
      rows[0]!.requested_at,
    );
    const requestedBy = e.owner_id ?? rows[0]!.created_by;

    await prisma.$transaction(async (tx) => {
      const created = await tx.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO stage_gate_transitions
           (id, tenant_id, initiative_id, from_gate, to_gate, kind, status, quorum,
            requested_by, requested_at, reason)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'L2', 'L3.1', 'forward', 'pending',
                 'all', $3::uuid, $4, $5)
         RETURNING id`,
        e.tenant_id,
        e.id,
        requestedBy,
        requestedAt,
        "Übernommen aus der früheren Business-Case-Freigabe.",
      );
      const transitionId = created[0]!.id;

      // Dieselbe Person kann für zwei Parteien eingetragen gewesen sein; auf der
      // Gate-Achse nimmt sie einmal ab (`@@unique(transitionId, approverUserId)`).
      const seen = new Set<string>();
      for (const r of rows) {
        if (r.approver_user_id == null || seen.has(r.approver_user_id)) continue;
        seen.add(r.approver_user_id);
        await tx.$executeRawUnsafe(
          `INSERT INTO stage_gate_approvals
             (id, tenant_id, transition_id, approver_user_id, source, role, status,
              decided_at, comment, requested_at, created_by)
           VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'manual', $4, $5,
                   $6, $7, $8, $9::uuid)`,
          e.tenant_id,
          transitionId,
          r.approver_user_id,
          r.party ? (ROLE_BY_PARTY[r.party] ?? null) : null,
          r.status,
          r.decided_at,
          r.comment,
          r.requested_at,
          r.created_by,
        );
      }
    });
    migrated += 1;
  }
  console.log(`  → ${migrated} Antrag/Anträge angelegt, ${skipped} übersprungen.`);

  const hypo = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*) FROM initiatives
      WHERE level = 0 AND deleted_at IS NULL AND approval_phase = 'hypothesis_review'`,
  );
  console.log(
    `Epics in Hypothesen-Freigabe: ${hypo[0]?.count ?? 0} — sie stehen wieder vor dem L0→L1-Antrag.`,
  );

  const stray = await prisma.$queryRawUnsafe<{ id: string; title: string }[]>(
    `SELECT id, title FROM initiatives
      WHERE level = 0 AND deleted_at IS NULL AND stage_gate = 'L2'
        AND business_case_approved_at IS NOT NULL`,
  );
  if (stray.length > 0) {
    console.warn(
      `Hinweis: ${stray.length} Epic(s) tragen eine alte BC-Freigabe, stehen aber noch auf L2. ` +
        `Sie erfüllen das neue L3.1-Kriterium und wandern beim nächsten Antrag:\n` +
        stray.map((e) => `  - ${e.id} ${e.title}`).join("\n"),
    );
  }

  console.log(
    "\nFertig. Jetzt `prisma db push` mit dem neuen Schema fahren — es entfernt " +
      "epic_approvals sowie approval_phase und approval_revision.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
