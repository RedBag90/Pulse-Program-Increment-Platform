import Link from "next/link";
import type { ZieleModel } from "@/server/views/ziele-view";

/**
 * Pflege-Tab (Konzept §4.4 / V9). KPI-Bibliothek + KR-Coverage. Phase-1
 * read-only: zeigt alle Tenant-KPIs mit valuePerUnit-Status; KRs ohne
 * KPI-Bindung gehen als Coverage-Liste unten raus. Edit der
 * valuePerUnit-Werte lebt heute schon im Controlling-Modul
 * (`ValuePerUnitInput`); ein Tenant-weiter Inline-Edit hier kommt mit
 * einer naechsten Welle (Finance-Controller-Capability) hinzu.
 */
interface Props {
  model: ZieleModel;
}

export function PflegeView({ model }: Props) {
  const { kpiLibrary, themes } = model;

  // KR-Coverage: alle KRs durchlaufen, jene ohne Bindung sammeln
  const uncoveredKrs: Array<{
    krId: string;
    krTitle: string;
    objectiveTitle: string;
    themeId: string;
    themeTitle: string;
    themeColor: string;
  }> = [];
  for (const t of themes) {
    for (const o of t.objectives) {
      for (const kr of o.keyResults) {
        if (kr.kpiCount === 0 && kr.formula === "auto_from_kpi") {
          uncoveredKrs.push({
            krId: kr.id,
            krTitle: kr.title,
            objectiveTitle: o.title,
            themeId: t.id,
            themeTitle: t.title,
            themeColor: t.color,
          });
        }
      }
    }
  }

  const missingValue = kpiLibrary.filter((k) => k.valuePerUnit == null).length;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card">
        <header className="flex items-baseline justify-between border-b px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">KPI-Bibliothek</h3>
            <p className="text-[11px] text-muted-foreground">
              {kpiLibrary.length} KPI · {missingValue} ohne valuePerUnit
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Edit fuer valuePerUnit im Controlling-Modul →
          </span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>KPI</Th>
                <Th>Unit</Th>
                <Th align="right">€/Unit</Th>
                <Th>Epic</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {kpiLibrary.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Keine KPIs im Tenant — leg im Portfolio-Modul welche an.
                  </td>
                </tr>
              )}
              {kpiLibrary.map((k) => (
                <tr key={k.id} className="hover:bg-muted/30">
                  <Td>{k.name}</Td>
                  <Td>
                    <span className="text-muted-foreground">{k.unit ?? "—"}</span>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {k.valuePerUnit == null ? (
                      <span className="text-amber-600">—</span>
                    ) : (
                      `€${k.valuePerUnit.toLocaleString("de-DE")}`
                    )}
                  </Td>
                  <Td>
                    <Link
                      href={`/portfolio/epics/${k.epicId}` as never}
                      className="truncate hover:underline"
                    >
                      {k.epicTitle}
                    </Link>
                  </Td>
                  <Td align="right">
                    {k.valuePerUnit == null ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        Setup offen
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600">✓</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <header className="flex items-baseline justify-between border-b px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">KR-Coverage</h3>
            <p className="text-[11px] text-muted-foreground">
              KRs mit Formel „aus KPI aggregiert" ohne Bindung — diese KRs liefern kein € bis eine
              KPI gebunden ist.
            </p>
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {uncoveredKrs.length}
          </span>
        </header>
        <ul className="divide-y">
          {uncoveredKrs.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">
              Alle Auto-KRs sind gedeckt.
            </li>
          )}
          {uncoveredKrs.map((u) => (
            <li key={u.krId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span
                aria-hidden
                className="size-2 rounded-sm"
                style={{ backgroundColor: u.themeColor }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.krTitle}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {u.themeTitle} · {u.objectiveTitle}
                </p>
              </div>
              <Link
                href={`/ziele?entity=kr&id=${u.krId}` as never}
                scroll={false}
                className="rounded-md border bg-background px-2 py-1 text-[11px] hover:bg-muted"
              >
                KPI binden
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" | "left" }) {
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>
  );
}

function Td({
  children,
  align,
  className,
}: {
  children?: React.ReactNode;
  align?: "right" | "left";
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-2 align-middle ${
        align === "right" ? "text-right" : "text-left"
      } ${className ?? ""}`}
    >
      {children}
    </td>
  );
}
