import type { ReactNode } from "react";
import type { FigureKind } from "@/modules/wiki/domain/blocks";
import { HorizonLadder } from "./horizon-ladder";
import { GuardrailAxes } from "./guardrail-axes";
import { SolutionLifecycle } from "./solution-lifecycle";
import { ModuleMap } from "./module-map";
import { RoleList } from "./role-list";
import { KanbanColumns } from "./kanban-columns";
import { GateLadder } from "./gate-ladder";
import { GateCriteria } from "./gate-criteria";
import { LifecycleSteps } from "./lifecycle-steps";
import { DeliveryChain } from "./delivery-chain";
import { BenefitKinds } from "./benefit-kinds";
import { AllocationRule } from "./allocation-rule";
import { PeriodPhases } from "./period-phases";
import { ExposureMatrix } from "./exposure-matrix";
import { RoamAxes } from "./roam-axes";

/**
 * **Der Kompositionsroot der Figuren.** Hier — und nur hier — treffen sich das
 * Wiki (ein Blatt ueber Core) und die Module, deren Konstanten es zeichnet.
 * `src/app` ist die einzige Schicht, die mehrere Module verdrahten darf
 * (ADR-0013); die Ansicht bekommt fertige Elemente und bleibt ein Blatt.
 *
 * Unaufgeloeste Arten fehlen hier absichtlich, solange die Anleitung, die sie
 * braucht, noch nicht geschrieben ist — der Renderer laesst sie lautlos aus,
 * und der Test in `wiki/domain/__tests__` faengt jede Figur, die im Datensatz
 * benutzt, aber hier nicht angeboten wird.
 */
export function resolveFigures(): Partial<Record<FigureKind, ReactNode>> {
  return {
    horizonLadder: <HorizonLadder />,
    guardrailAxes: <GuardrailAxes />,
    solutionLifecycle: <SolutionLifecycle />,
    moduleMap: <ModuleMap />,
    roleList: <RoleList />,
    kanbanColumns: <KanbanColumns />,
    gateLadder: <GateLadder />,
    gateCriteria: <GateCriteria />,
    lifecycleSteps: <LifecycleSteps />,
    deliveryChain: <DeliveryChain />,
    benefitKinds: <BenefitKinds />,
    allocationRule: <AllocationRule />,
    periodPhases: <PeriodPhases />,
    exposureMatrix: <ExposureMatrix />,
    roamAxes: <RoamAxes />,
  };
}
