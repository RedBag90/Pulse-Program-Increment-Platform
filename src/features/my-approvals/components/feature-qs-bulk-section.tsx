"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { Check, MessageCircleQuestion, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { decideFeatureReviewBatchAction } from "@/features/art/actions/feature";
import type { MyApprovalRow } from "@/server/services/my-approvals";
import { ApprovalActions } from "@/features/my-approvals/components/approval-actions";

interface Props {
  rows: MyApprovalRow[];
}

/**
 * Feature-QS lane of `/my-approvals` — adds multi-select + a sticky
 * bulk action bar on top of the existing per-row decision UI. The
 * other approval lanes stay single-row because they're 1-per-PI /
 * quarter and don't earn the affordance.
 *
 * Selection is component-local (not URL): the list is shallow (≤ 50)
 * and selection is ephemeral — the rows disappear from the inbox as
 * soon as the batch lands.
 */
export function FeatureQsBulkSection({ rows }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<null | "reject" | "clarification">(null);
  const [comment, setComment] = useState("");
  const [state, dispatch, pending] = useActionState(decideFeatureReviewBatchAction, {});

  // Drop stale ids when the row list shrinks (revalidation removes
  // decided rows) so the bulk-bar count stays honest.
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(rows.map((r) => r.target.featureId!));
      const next = new Set<string>();
      for (const id of prev) if (ids.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  // Close the comment drawer + clear selection once a batch succeeds.
  useEffect(() => {
    if (state.success) {
      setSelected(new Set());
      setOpen(null);
      setComment("");
    }
  }, [state.success]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    const ids = rows.map((r) => r.target.featureId!);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(ids));
  }

  function submit(decision: "approve" | "reject", intent?: "decision" | "clarification") {
    const fd = new FormData();
    for (const id of selected) fd.append("featureIds", id);
    fd.set("decision", decision);
    if (intent) fd.set("intent", intent);
    if (comment.trim()) fd.set("comment", comment.trim());
    startTransition(() => dispatch(fd));
  }

  const ids = rows.map((r) => r.target.featureId!);
  const allChecked = ids.length > 0 && ids.every((id) => selected.has(id));
  const someChecked = !allChecked && ids.some((id) => selected.has(id));

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Feature-QS
        </h2>
        <span className="text-xs text-muted-foreground">{rows.length} offen</span>
      </div>

      <div className="divide-y rounded-lg border">
        <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            aria-label="Alle auswählen"
            checked={allChecked}
            ref={(el) => {
              if (el) el.indeterminate = someChecked;
            }}
            onChange={toggleAll}
            className="size-4 rounded border-border"
          />
          <span>Alle auswählen</span>
        </div>

        {rows.map((row) => {
          const fid = row.target.featureId!;
          const isSelected = selected.has(fid);
          return (
            <div
              key={row.id}
              className="grid gap-4 px-4 py-3 md:grid-cols-[auto_1fr_auto] md:items-start"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(fid)}
                aria-label={`${row.title} auswählen`}
                className="mt-1 size-4 rounded border-border"
              />
              <div className="min-w-0 space-y-1">
                <Link href={row.href} className="font-medium text-primary hover:underline">
                  {row.title}
                </Link>
                <RowContext row={row} />
              </div>
              <div className="shrink-0 md:min-w-[320px]">
                <ApprovalActions row={row} />
              </div>
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="pointer-events-none sticky bottom-4 z-30 flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border bg-card px-4 py-3 shadow-lg">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium tabular-nums text-primary-foreground">
                {selected.size} ausgewählt
              </span>

              {open === null ? (
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => submit("approve")}
                    className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="size-3.5" /> Freigeben
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setOpen("clarification")}
                    className="inline-flex items-center gap-1 rounded border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                  >
                    <MessageCircleQuestion className="size-3.5" /> In Klärung
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setOpen("reject")}
                    className="inline-flex items-center gap-1 rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <X className="size-3.5" /> Ablehnen
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setSelected(new Set())}
                    aria-label="Auswahl aufheben"
                    className="rounded border border-input p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="ml-auto w-full space-y-2">
                  <p className="text-xs font-medium">
                    {open === "reject" ? "Ablehnen" : "In Klärung schicken"} — {selected.size}{" "}
                    Feature(s) · Begründung erforderlich
                  </p>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Geteilte Begründung für alle ausgewählten Features"
                    className="w-full rounded border border-input px-2 py-1 text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                      onClick={() => {
                        setOpen(null);
                        setComment("");
                      }}
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      disabled={pending || comment.trim() === ""}
                      onClick={() =>
                        submit(
                          open === "reject" ? "reject" : "approve",
                          open === "clarification" ? "clarification" : "decision",
                        )
                      }
                      className={
                        open === "reject"
                          ? "rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          : "rounded border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                      }
                    >
                      {pending ? "…" : open === "reject" ? "Ablehnen" : "In Klärung schicken"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {state.error && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {state.error}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Kept in sync with the page-level `ContextCell` — same bits, same order. */
function RowContext({ row }: { row: MyApprovalRow }) {
  const bits: string[] = [];
  if (row.context.valueStreamName) bits.push(row.context.valueStreamName);
  if (row.context.artName) bits.push(row.context.artName);
  if (row.context.parentTitle) bits.push(row.context.parentTitle);
  return (
    <p className="text-xs text-muted-foreground">{bits.length > 0 ? bits.join(" · ") : "—"}</p>
  );
}
