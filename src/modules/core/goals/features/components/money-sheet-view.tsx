import { useTranslations } from "next-intl";
import Link from "next/link";
import type { GoalNode } from "@/modules/core/goals/server/views/ziele-view";
import { goalTimeframeLabel } from "@/modules/core/goals/domain/goal-period";
import {
  goalNodeTimeframe,
  goalNodeTimeframeLabel,
} from "@/modules/core/goals/features/lib/goal-node-view";
import { MoneyExportButton } from "./money-export-button";

/**
 * Money-Sheet — Theme-Zeilen (OKRs) mit Planned/Realized/Run-Rate.
 *
 * Nach §Hierarchie-Vereinfachung sind „Themes" die OKR-Top-Ebene
 * (intern Objectives). Budget + Business/Enabler-Split sind aus dem
 * Modell raus; die Tabelle zeigt nur noch €-Rollup pro Theme + Tenant-
 * Footer. Klick auf eine Theme-Zeile deeplinkt in den Strategie-Drawer.
 */
interface Props {
  themes: GoalNode[];
  /** €-Werte entstehen aus Epic-KPIs (Portfolio-Modul) — ohne Portfolio ausgeblendet. */
  hasPortfolio?: boolean;
}

export function MoneySheetView({ themes, hasPortfolio = true }: Props) {
  const t = useTranslations();
  // Ohne Portfolio-Modul wird der Money-Tab gar nicht erst angeboten
  // (ZieleSubTabs/Shell); defensiv rendern wir hier nichts.
  if (!hasPortfolio) return null;
  const sorted = [...themes].sort((a, b) => b.trio.realized - a.trio.realized);
  const totals = sorted.reduce(
    (acc, t) => {
      acc.planned += t.trio.planned;
      acc.realized += t.trio.realized;
      acc.runRate += t.trio.runRate;
      return acc;
    },
    { planned: 0, realized: 0, runRate: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-meta text-muted-foreground">
          {t.rich("goals.money.aggregationHint", {
            link: (c) => (
              <Link href={"/portfolio/dashboard" as never} className="text-primary hover:underline">
                {c}
              </Link>
            ),
          })}
        </p>
        <MoneyExportButton
          rows={sorted.map((t) => {
            const tf = goalNodeTimeframe(t);
            return {
              title: t.title,
              period: tf ? goalTimeframeLabel(tf) : "",
              planned: t.trio.planned,
              realized: t.trio.realized,
              runRate: t.trio.runRate,
            };
          })}
        />
      </div>
      <div className="overflow-x-auto rounded-lg bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-label uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <Th>{t("goals.money.goal")}</Th>
              <Th>{t("goals.money.period")}</Th>
              <Th align="right">{t("goals.money.planned")}</Th>
              <Th align="right">{t("goals.money.realized")}</Th>
              <Th align="right">{t("goals.money.runRate")}</Th>
              <Th align="right">{t("goals.money.drift")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {t("goals.money.empty")}
                </td>
              </tr>
            )}
            {sorted.map((t) => (
              <Row key={t.id} theme={t} />
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/20 text-xs font-medium">
            <tr>
              <Td>{t("goals.money.total")}</Td>
              <Td />
              <Td align="right">{eur(totals.planned)}</Td>
              <Td align="right">{eur(totals.realized)}</Td>
              <Td align="right">{eur(totals.runRate)}</Td>
              <Td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Row({ theme }: { theme: GoalNode }) {
  const t = useTranslations();
  const drift = theme.trio.planned > 0 ? theme.trio.runRate / theme.trio.planned : 1;
  const atRisk = drift < 0.7;
  return (
    <tr className="hover:bg-muted/30">
      <Td>
        <Link
          href={`/ziele?entity=theme&id=${theme.id}` as never}
          scroll={false}
          className="truncate hover:underline"
        >
          {theme.title}
        </Link>
      </Td>
      <Td>
        <span className="text-meta uppercase tracking-[0.1em] text-muted-foreground">
          {goalNodeTimeframeLabel(theme)}
        </span>
      </Td>
      <Td align="right">{eur(theme.trio.planned)}</Td>
      <Td align="right">{eur(theme.trio.realized)}</Td>
      <Td align="right">{eur(theme.trio.runRate)}</Td>
      <Td align="right">
        {atRisk ? (
          <span
            className="rounded-full bg-warning-surface px-1.5 py-0.5 text-label font-semibold text-warning"
            title={t("goals.shared.runRateBelowPlan")}
          >
            ⚠
          </span>
        ) : (
          <span className="text-label text-success">✓</span>
        )}
      </Td>
    </tr>
  );
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" | "left" }) {
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>
  );
}

function Td({ children, align }: { children?: React.ReactNode; align?: "right" | "left" }) {
  return (
    <td
      className={`px-3 py-2 align-middle tabular-nums ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}

function eur(n: number): string {
  return `€${Math.round(n).toLocaleString("de-DE")}`;
}
