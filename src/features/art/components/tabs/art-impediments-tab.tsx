import { Suspense } from "react";
import { ImpedimentsListShell } from "@/features/impediment/components/impediments-list-shell";

interface Props {
  artId: string;
  model: Parameters<typeof ImpedimentsListShell>[0]["model"];
  canCreate: boolean;
  canEscalate: boolean;
  canResolve: boolean;
}

export function ArtImpedimentsTab({ artId, model, canCreate, canEscalate, canResolve }: Props) {
  return (
    <Suspense fallback={null}>
      <ImpedimentsListShell
        model={model}
        artId={artId}
        canCreate={canCreate}
        canEscalate={canEscalate}
        canResolve={canResolve}
      />
    </Suspense>
  );
}
