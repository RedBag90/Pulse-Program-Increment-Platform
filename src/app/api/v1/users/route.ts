import { createQueryHandler } from "@/server/http/query-handler";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { listTenantApprovers } from "@/modules/work/server/services/tenant-approvers";
import { userLabel } from "@/components/detail/initiative-labels";

/**
 * **Options-Liste der Personen eines Mandanten** — für Personen-Auswahlen in
 * Anlege-Dialogen.
 *
 * Es gab sie bisher nicht: Personen-Picker bekamen ihre Kandidaten stets als
 * Requisiten von der Seite, die sie ohnehin geladen hatte. Ein Dialog, der aus
 * fünf verschiedenen Stellen geöffnet wird — auch aus dem globalen „+"-Menü —
 * kann sich darauf nicht stützen.
 *
 * `isSelf` markiert den Aufrufer. Ohne diese Angabe könnte die Fläche das
 * Owner-Feld nicht mit dem Anlegenden vorbelegen; der angemeldete Nutzer ist im
 * Client sonst nirgends greifbar.
 *
 * Kandidaten sind die Personen **mit einer Rolle** im Mandanten — dieselbe
 * Menge, die auch `FeatureOwnerAssign` anbietet. Wer gar keine Rolle trägt,
 * kann auch nichts verantworten.
 */
export const GET = createQueryHandler({
  query: async (ctx) => {
    const [approvers, labels] = await Promise.all([
      listTenantApprovers(ctx.db, ctx.principal.tenantId),
      listTenantUserLabels(ctx.db, ctx.principal.tenantId),
    ]);
    return approvers
      .map((u) => ({
        id: u.userId,
        label: userLabel(u.userId, labels),
        roles: u.roles,
        isSelf: u.userId === ctx.principal.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  },
});
