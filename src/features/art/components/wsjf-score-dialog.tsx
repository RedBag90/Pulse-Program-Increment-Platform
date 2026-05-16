"use client";

import { useActionState, useRef } from "react";
import { scoreFeatureAction, type FeatureActionState } from "@/features/art/actions/feature";

const FIB = [1, 2, 3, 5, 8, 13, 20] as const;

interface Props {
  featureId: string;
  artId: string;
  current: {
    bv: number | null;
    tc: number | null;
    rr: number | null;
    js: number | null;
  };
}

const initial: FeatureActionState = {};

export function WsjfScoreDialog({ featureId, artId, current }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: FeatureActionState, formData: FormData) => {
      const result = await scoreFeatureAction(prev, formData);
      if (result.success) dialogRef.current?.close();
      return result;
    },
    initial,
  );

  const score =
    current.bv !== null && current.tc !== null && current.rr !== null && current.js !== null
      ? (((current.bv + current.tc + current.rr) / current.js) as number).toFixed(2)
      : null;

  return (
    <>
      <button
        onClick={() => dialogRef.current?.showModal()}
        className="text-xs text-blue-600 hover:underline whitespace-nowrap"
      >
        {score !== null ? score : "Score"}
      </button>

      <dialog
        ref={dialogRef}
        className="rounded-xl shadow-xl p-0 w-full max-w-sm backdrop:bg-black/40"
      >
        <div className="p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Update WSJF Score</h2>

          <form action={formAction} className="space-y-3">
            <input type="hidden" name="featureId" value={featureId} />
            <input type="hidden" name="artId" value={artId} />

            {(
              [
                { name: "wsjfBusinessValue", label: "Business Value", value: current.bv },
                { name: "wsjfTimeCriticality", label: "Time Criticality", value: current.tc },
                { name: "wsjfRiskReduction", label: "Risk Reduction", value: current.rr },
                { name: "wsjfJobSize", label: "Job Size", value: current.js },
              ] as const
            ).map(({ name, label, value }) => (
              <div key={name}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <select
                  name={name}
                  defaultValue={value ?? 1}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {FIB.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            {state.error && <p className="text-xs text-red-600">{state.error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
