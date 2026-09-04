/**
 * Das **Portfolio-Limit** je Wertstrom, plus den Wert ohne Wertstrom.
 *
 * Eigener Endpunkt statt eines Feldes an `/api/v1/value-streams`, aus zwei
 * Gründen: `listValueStreams` liegt in **core** und darf die Guardrails aus
 * **work** nicht importieren (ADR-0013), und eine Liste kann den Default nicht
 * mittragen, der gilt, solange kein Wertstrom gewählt ist.
 *
 * Nur lesend — dieselbe Reichweite wie die Options-Listen, die derselbe Dialog
 * ohnehin abfragt.
 */

import { loadPortfolioThresholds } from "@/modules/work/server/services/guardrail-targets";
import { createQueryHandler } from "@/server/http/query-handler";

export const GET = createQueryHandler({
  query: (ctx) => loadPortfolioThresholds(ctx.db, ctx.principal.tenantId),
});
