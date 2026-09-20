import type { PrismaClient } from "@/generated/prisma";
import type { RequestContext } from "@/server/http/mutation-handler";
import { toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, type Result } from "@/modules/core/kernel/domain/errors";

/**
 * **Was eine Flaeche sich merkt, wenn ein Nutzer sie einmal eingestellt hat.**
 *
 * Ein Schluessel-Wert-Speicher je Mandant und Nutzer: `key` benennt die Flaeche
 * (`portfolio.goalContribution`), `value` traegt deren Zustand als JSON.
 *
 * Rein persoenlich, wie das Rollen-Onboarting: beide Funktionen arbeiten hart
 * auf `principal.id`, und die RLS-Politik
 * `tenant_user_isolation_view_preferences` isoliert die Zeilen zusaetzlich auf
 * Mandant **und** Nutzer. Es gibt bewusst keinen Weg, fremde Vorlieben zu lesen
 * oder zu setzen — auch nicht fuer den Tenant-Admin.
 *
 * **Der Speicher prueft den Inhalt nicht.** `value` ist beliebiges JSON; was
 * darin gueltig ist, weiss nur die Flaeche, die es geschrieben hat. Jeder Leser
 * parst deshalb selbst und faellt auf seine Vorgabe zurueck (Beispiel:
 * `parseContributionView`). Anders ginge es auch nicht: ein zentrales Schema
 * muesste jede Kachel kennen.
 */

/**
 * Die gespeicherten Werte zu mehreren Schluesseln — **ein** Lesezugriff. Die
 * Seite laedt ihre Vorlieben in derselben Welle wie ihre uebrigen Daten; ein
 * Aufruf je Kachel waere eine Abfrage je Kachel.
 *
 * Fehlt ein Schluessel, fehlt er auch in der Map. Eine leere Vorliebe von einer
 * nie gesetzten zu unterscheiden waere eine Aussage, die niemand braucht: beide
 * heissen „nimm die Vorgabe".
 */
export async function loadViewPreferences(
  db: PrismaClient,
  principal: { id: string; tenantId: string },
  keys: readonly string[],
): Promise<Map<string, unknown>> {
  if (keys.length === 0) return new Map();
  const rows = await db.viewPreference.findMany({
    where: { tenantId: principal.tenantId, userId: principal.id, key: { in: [...keys] } },
    select: { key: true, value: true },
  });
  return new Map(rows.map((r) => [r.key, r.value as unknown]));
}

/**
 * Eine Vorliebe setzen — anlegen oder ersetzen.
 *
 * **`update` ersetzt, es mischt nicht.** Der Wert einer Flaeche ist ein Ganzes;
 * zwei Schalter, von denen einer aus einer alten Fassung stammt, waeren
 * schlimmer als zwei aktuelle.
 *
 * **Kein Audit-Eintrag**, aus demselben Grund, den `markStepsSeen` nennt: das
 * feuert bei jedem Klick und hat keinen Compliance-Wert. Deshalb auch
 * `toMutationContext` ohne `withAuditedTransaction` — es gibt nichts zu
 * protokollieren und nichts, das zusammen gelingen muesste.
 */
export async function saveViewPreference(
  ctx: RequestContext,
  input: { key: string; value: unknown },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  await ctx.db.viewPreference.upsert({
    where: {
      tenantId_userId_key: {
        tenantId: mctx.tenantId,
        userId: mctx.actorId,
        key: input.key,
      },
    },
    create: {
      tenantId: mctx.tenantId,
      userId: mctx.actorId,
      key: input.key,
      value: input.value as never,
    },
    update: { value: input.value as never },
  });
  return ok(undefined);
}
