/* eslint-disable no-console */
/**
 * Einmal-Skript: **ART-Epics über dem Portfolio-Limit umstellen.**
 *
 * Seit diesem Stand stellt der Gate-Dienst die Erwartung (`intendedClass`)
 * beim L2-Antrag und bei der L2-Abnahme von „art" auf „portfolio" um, sobald
 * der Business Case über dem Limit liegt (`reclassifyAboveLimit` in
 * `src/modules/work/server/services/epic-class.ts`). Vorher blieb sie stehen:
 * nach der Abnahme zeigte die Karte „Portfolio-Epic" und darunter eine
 * „Abweichung von der Erwartung", die niemand mehr auflösen konnte.
 *
 * Dieses Skript zieht zwei Gruppen nach:
 *
 *  1. **abgenommen** — `businessCaseApprovedAt` gesetzt, Erwartung „art", keine
 *     Ausnahme, abgeleitete Klasse „portfolio" (`classifyEpic`);
 *  2. **beantragt** — offener L2-Antrag, Erwartung „art", der Entwurf liegt
 *     über dem Limit (`provisionalEpicClass`).
 *
 * Nach unten ändert es nichts: ein Portfolio-Epic unter dem Limit darf
 * Portfolio bleiben.
 *
 * Jede Umstellung bekommt einen Audit-Eintrag `initiative.updated` mit
 * `changes.intendedClass`, damit sie in der Epic-Historie erscheint. Dafür
 * braucht der Schreiblauf eine Person: `--actor=<uuid>`.
 *
 * Idempotent: ein zweiter Lauf findet nichts mehr.
 *
 * Aufruf: `npx tsx --env-file=.env.local prisma/scripts/2026-09-26-art-epics-ueber-dem-limit.ts`
 *         `--apply --actor=<uuid>` schreibt; ohne `--apply` ist es ein Trockenlauf.
 *         `--tenant=<Name>` beschränkt auf einen Mandanten (exakter Name).
 */
import { PrismaClient, type Prisma } from "../../src/generated/prisma";
import { classifyEpic, provisionalEpicClass } from "../../src/modules/work/domain/pb-submission";
import { resolveGuardrailTargets } from "../../src/modules/work/domain/portfolio-guardrails";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(`--${name}=`.length);
const NUR_MANDANT = arg("tenant");
const ACTOR = arg("actor");
const EPIC = 0;

async function main(): Promise<void> {
  console.log(APPLY ? "== SCHREIBLAUF ==" : "== TROCKENLAUF (kein --apply) ==");
  if (APPLY && !/^[0-9a-f-]{36}$/i.test(ACTOR ?? "")) {
    console.log("Der Schreiblauf braucht --actor=<uuid> für den Audit-Eintrag.");
    process.exitCode = 1;
    return;
  }

  const tenants = await prisma.tenant.findMany({
    where: NUR_MANDANT == null ? {} : { name: NUR_MANDANT },
    select: { id: true, name: true, guardrailTargets: true },
  });
  if (tenants.length === 0) {
    console.log(`Kein Mandant mit dem Namen „${NUR_MANDANT}".`);
    return;
  }

  let gesamt = 0;
  for (const tenant of tenants) {
    const [limits, epics] = await Promise.all([
      prisma.valueStreamGuardrailTargets.findMany({
        where: { tenantId: tenant.id },
        select: { valueStreamId: true, targets: true },
      }),
      prisma.initiative.findMany({
        where: { tenantId: tenant.id, level: EPIC, deletedAt: null, intendedClass: "art" },
        select: {
          id: true,
          title: true,
          valueStreamId: true,
          businessCase: true,
          businessCaseApprovedAt: true,
          hypothesisApprovedAt: true,
          portfolioOverrideAt: true,
          gateTransitions: {
            where: { status: "pending", toGate: "L2" },
            select: { id: true },
          },
        },
      }),
    ]);
    const limitFor = (vs: string | null) =>
      resolveGuardrailTargets(limits, tenant.guardrailTargets ?? null, vs ?? "").targets.approval
        .portfolioThreshold;

    const treffer = epics.flatMap((e) => {
      const limit = limitFor(e.valueStreamId);
      if (e.businessCaseApprovedAt != null) {
        const c = classifyEpic(e, limit);
        return !c.overridden && c.epicClass === "portfolio"
          ? [{ e, gruppe: "abgenommen", cost: c.cost ?? 0, limit }]
          : [];
      }
      if (e.gateTransitions.length > 0 && provisionalEpicClass(e, limit) === "portfolio") {
        return [{ e, gruppe: "beantragt", cost: NaN, limit }];
      }
      return [];
    });
    if (treffer.length === 0) continue;

    console.log(`\n── ${tenant.name}`);
    for (const { e, gruppe, cost, limit } of treffer) {
      const betrag = Number.isNaN(cost) ? "Entwurf" : `${cost.toLocaleString("de-DE")} €`;
      console.log(
        `   ${gruppe.padEnd(10)} ${betrag.padStart(14)} > ${limit.toLocaleString("de-DE")} €  ${e.title}  (${e.id})`,
      );
    }
    gesamt += treffer.length;

    if (!APPLY) continue;
    await prisma.$transaction(async (tx) => {
      for (const { e } of treffer) {
        await tx.initiative.update({
          where: { id: e.id },
          data: { intendedClass: "portfolio", updatedBy: ACTOR! },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: tenant.id,
            actorId: ACTOR!,
            action: "initiative.updated",
            resourceType: "initiative",
            resourceId: e.id,
            changes: {
              intendedClass: { before: "art", after: "portfolio" },
            } as Prisma.InputJsonValue,
          },
        });
      }
    });
    console.log("   → umgestellt");
  }

  if (gesamt === 0) console.log("Nichts umzustellen.");
  else if (!APPLY) console.log(`\n${gesamt} Epics — mit --apply --actor=<uuid> umstellen.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
