"use client";

interface MoneyRow {
  title: string;
  kind: string;
  budget: number;
  planned: number;
  realized: number;
  runRate: number;
  roi: number | null;
}

interface Props {
  rows: MoneyRow[];
}

/**
 * CSV-Export fuer das Money-Sheet (Konzept §4.3). Client-Only: kein
 * Server-Roundtrip, kein Blob in der Pulse-DB — Stefan/Andrea koennen
 * direkt fuer Board-Praesentationen ziehen. Trennzeichen `;`, Komma als
 * Dezimal — Excel-Default in DE-Locale.
 */
export function MoneyExportButton({ rows }: Props) {
  function download() {
    const header = [
      "Theme",
      "Kind",
      "Budget EUR",
      "Planned EUR",
      "Realized EUR",
      "Run-Rate EUR",
      "ROI %",
    ];
    const body = rows.map((r) => [
      r.title,
      r.kind,
      fmt(r.budget),
      fmt(r.planned),
      fmt(r.realized),
      fmt(r.runRate),
      r.roi == null ? "" : `${Math.round(r.roi * 100)}`,
    ]);
    const csv = [header, ...body].map((cols) => cols.map(escape).join(";")).join("\r\n");
    // Excel braucht BOM, sonst zerlegt es Umlaute
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `pulse-money-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
    >
      CSV exportieren
    </button>
  );
}

function fmt(n: number): string {
  // German-decimal — Komma statt Punkt, kein Tausender-Trennzeichen
  return Math.round(n).toString().replace(".", ",");
}

function escape(v: string): string {
  if (/[";\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
