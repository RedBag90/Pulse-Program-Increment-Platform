import Link from "next/link";
import type { ZieleTreeTheme } from "@/server/views/ziele-view";
import { MoneyExportButton } from "./money-export-button";

/**
 * Money-Sheet (Konzept §4.3 / V8). Strategic Investment Sheet: pro
 * Theme eine Zeile mit Budget, Planned/Realized/Run-Rate, ROI vs.
 * Budget und Business-vs-Enabler-Donut im Footer.
 *
 * Read-only — die Werte werden im Ziele-Modul (Strategie + KR-Bindungen)
 * gepflegt. CSV-Export folgt mit P4-Feinschliff.
 */
interface Props {
  themes: ZieleTreeTheme[];
}

export function MoneySheetView({ themes }: Props) {
  const sorted = [...themes].sort((a, b) => b.trio.realized - a.trio.realized);
  const totals = sorted.reduce(
    (acc, t) => {
      acc.budget += t.budgetPlanned ?? 0;
      acc.planned += t.trio.planned;
      acc.realized += t.trio.realized;
      acc.runRate += t.trio.runRate;
      return acc;
    },
    { budget: 0, planned: 0, realized: 0, runRate: 0 },
  );

  const businessRunRate = sorted
    .filter((t) => t.kind === "business")
    .reduce((s, t) => s + t.trio.runRate, 0);
  const enablerRunRate = sorted
    .filter((t) => t.kind === "enabler")
    .reduce((s, t) => s + t.trio.runRate, 0);
  const splitTotal = businessRunRate + enablerRunRate;
  const businessShare = splitTotal === 0 ? 0 : businessRunRate / splitTotal;
  const enablerShare = splitTotal === 0 ? 0 : enablerRunRate / splitTotal;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <MoneyExportButton
          rows={sorted.map((t) => ({
            title: t.title,
            kind: t.kind,
            budget: t.budgetPlanned ?? 0,
            planned: t.trio.planned,
            realized: t.trio.realized,
            runRate: t.trio.runRate,
            roi: t.budgetPlanned && t.budgetPlanned > 0 ? t.trio.runRate / t.budgetPlanned : null,
          }))}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>Theme</Th>
              <Th>Kind</Th>
              <Th align="right">Budget</Th>
              <Th align="right">Planned €</Th>
              <Th align="right">Realized €</Th>
              <Th align="right">Run-Rate €</Th>
              <Th align="right">ROI %</Th>
              <Th align="right">Drift</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Keine Themes — leg eines im Tab „Strategie" an.
                </td>
              </tr>
            )}
            {sorted.map((t) => (
              <Row key={t.id} theme={t} />
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/20 text-xs font-medium">
            <tr>
              <Td>TOTAL</Td>
              <Td />
              <Td align="right">{eur(totals.budget)}</Td>
              <Td align="right">{eur(totals.planned)}</Td>
              <Td align="right">{eur(totals.realized)}</Td>
              <Td align="right">{eur(totals.runRate)}</Td>
              <Td align="right">
                {totals.budget > 0 ? `${Math.round((totals.runRate / totals.budget) * 100)}%` : "—"}
              </Td>
              <Td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Business vs Enabler (Run-Rate)
          </h3>
          <div className="mt-3 space-y-2">
            <SplitBar
              label="Business"
              share={businessShare}
              value={businessRunRate}
              tone="bg-primary"
            />
            <SplitBar
              label="Enabler"
              share={enablerShare}
              value={enablerRunRate}
              tone="bg-muted-foreground/60"
            />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Guardrail: Enabler ≥ 25 %{" "}
            {enablerShare >= 0.25 ? (
              <span className="text-emerald-600">✓</span>
            ) : (
              <span className="text-amber-600">⚠ unter Guardrail</span>
            )}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Drift-freie Themes
          </h3>
          <ul className="mt-2 space-y-1 text-xs">
            {sorted.map((t) => {
              const drift = t.trio.planned > 0 ? t.trio.runRate / t.trio.planned : 1;
              const ok = drift >= 0.7;
              return (
                <li key={t.id} className="flex items-center gap-2">
                  <span aria-hidden className={ok ? "text-emerald-600" : "text-amber-600"}>
                    {ok ? "✓" : "⚠"}
                  </span>
                  <span className="truncate">{t.title}</span>
                  {!ok && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {Math.round(drift * 100)} % Planned
                    </span>
                  )}
                </li>
              );
            })}
            {sorted.length === 0 && <li className="text-muted-foreground">Keine Themes.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Row({ theme }: { theme: ZieleTreeTheme }) {
  const roi =
    theme.budgetPlanned && theme.budgetPlanned > 0
      ? Math.round((theme.trio.runRate / theme.budgetPlanned) * 100)
      : null;
  const drift = theme.trio.planned > 0 ? theme.trio.runRate / theme.trio.planned : 1;
  const atRisk = drift < 0.7;
  return (
    <tr className="hover:bg-muted/30">
      <Td>
        <Link
          href={`/ziele?entity=theme&id=${theme.id}` as never}
          scroll={false}
          className="inline-flex items-center gap-2 hover:underline"
        >
          <span
            aria-hidden
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: theme.color }}
          />
          <span className="truncate">{theme.title}</span>
        </Link>
      </Td>
      <Td>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {theme.kind}
        </span>
      </Td>
      <Td align="right">{eur(theme.budgetPlanned ?? 0)}</Td>
      <Td align="right">{eur(theme.trio.planned)}</Td>
      <Td align="right">{eur(theme.trio.realized)}</Td>
      <Td align="right">{eur(theme.trio.runRate)}</Td>
      <Td align="right">{roi != null ? `${roi}%` : "—"}</Td>
      <Td align="right">
        {atRisk ? (
          <span
            className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
            title="Run-Rate < 70 % vom Planned"
          >
            ⚠
          </span>
        ) : (
          <span className="text-[10px] text-emerald-600">✓</span>
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

function SplitBar({
  label,
  share,
  value,
  tone,
}: {
  label: string;
  share: number;
  value: number;
  tone: string;
}) {
  const pct = Math.round(share * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-[11px]">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {pct} % · {eur(value)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} aria-hidden />
      </div>
    </div>
  );
}

function eur(n: number): string {
  return `€${Math.round(n).toLocaleString("de-DE")}`;
}
