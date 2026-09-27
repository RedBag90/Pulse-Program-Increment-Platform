import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { listTenantApprovers } from "@/modules/work/server/services/tenant-approvers";
import { completedFeaturesWhere } from "@/modules/drumbeat/server/services/pi-feedback";
import {
  isOverdue,
  suggestActual,
  type BvValue,
  type FeedbackReviewerStatus,
} from "@/modules/drumbeat/domain/pi-feedback";

/**
 * **PI-Feedback lesen** — für die Kontextleiste im Cockpit („einsammeln" /
 * „einsehen"), die Seite der Feedback-Person und ihren Eintrag in My Tasks.
 */

const FEATURE_SELECT = {
  id: true,
  title: true,
  completedAt: true,
  wsjfBusinessValue: true,
  wsjfBusinessValueActual: true,
  wsjfJobSize: true,
  wsjfComputed: true,
  wsjfComputedActual: true,
} as const;

const num = (d: { toString(): string } | null) => (d == null ? null : Number(d));

export interface FeedbackAnswerView {
  userId: string;
  businessValue: number;
  comment: string | null;
}

export interface FeedbackFeatureView {
  id: string;
  title: string;
  completedAt: Date | null;
  plan: number | null;
  actual: number | null;
  jobSize: number | null;
  wsjf: number | null;
  wsjfActual: number | null;
  answers: FeedbackAnswerView[];
  /** Mittelwert der Antworten, auf die Skala gerundet — die Vorbelegung. */
  suggestion: BvValue | null;
}

export interface PiFeedbackPanel {
  canRequest: boolean;
  canApply: boolean;
  /** Personenpool für „einsammeln". */
  people: { userId: string; roles: string[] }[];
  userLabels: Record<string, string>;
  /** Der Business Owner des Wertstroms — als Vorschlag im Pop-up. */
  suggestedReviewerId: string | null;
  /** Die offene Runde, sonst die zuletzt übernommene; `null` ohne Runde. */
  request: {
    id: string;
    status: "open" | "applied";
    dueDate: Date | null;
    requestedAt: Date;
    appliedAt: Date | null;
    reviewers: { userId: string; status: FeedbackReviewerStatus }[];
    features: FeedbackFeatureView[];
  } | null;
  completedCount: number;
}

/** Die Daten der Kontextleiste für einen ART in einem PI. */
export async function loadPiFeedbackPanel(
  db: PrismaClient,
  principal: Principal,
  input: { piId: string; artId: string },
): Promise<PiFeedbackPanel> {
  const tenantId = principal.tenantId as TenantId;
  const resource = { tenantId, artId: input.artId };
  const canRequest = hasCapability(principal, "pi.feedback.request", resource);
  const canApply = hasCapability(principal, "pi.feedback.apply", resource);

  const [request, completedCount, art] = await Promise.all([
    db.piFeedbackRequest.findFirst({
      where: { tenantId, piId: input.piId, artId: input.artId },
      // Die offene zuerst ('open' > 'applied'), dann die jüngste.
      orderBy: [{ status: "desc" }, { requestedAt: "desc" }],
      select: {
        id: true,
        status: true,
        dueDate: true,
        requestedAt: true,
        appliedAt: true,
        reviewers: {
          select: {
            userId: true,
            status: true,
            answers: { select: { featureId: true, businessValue: true, comment: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    db.initiative.count({ where: completedFeaturesWhere(tenantId, input.piId, input.artId) }),
    db.art.findFirst({
      where: { id: input.artId, tenantId },
      select: { valueStream: { select: { businessOwnerId: true } } },
    }),
  ]);

  // Personenpool und Namen nur, wenn jemand sie hier braucht.
  const brauchtPersonen = canRequest || request != null;
  const [people, userLabels] = brauchtPersonen
    ? await Promise.all([
        canRequest ? listTenantApprovers(db, tenantId) : Promise.resolve([]),
        listTenantUserLabels(db, tenantId),
      ])
    : [[], {}];

  let requestView: PiFeedbackPanel["request"] = null;
  if (request) {
    const features = await db.initiative.findMany({
      where: completedFeaturesWhere(tenantId, input.piId, input.artId),
      select: FEATURE_SELECT,
      orderBy: [{ completedAt: "asc" }, { title: "asc" }],
    });
    requestView = {
      id: request.id,
      status: request.status as "open" | "applied",
      dueDate: request.dueDate,
      requestedAt: request.requestedAt,
      appliedAt: request.appliedAt,
      reviewers: request.reviewers.map((r) => ({
        userId: r.userId,
        status: r.status as FeedbackReviewerStatus,
      })),
      features: features.map((f) => {
        const answers = request.reviewers.flatMap((r) =>
          r.answers
            .filter((a) => a.featureId === f.id)
            .map((a) => ({ userId: r.userId, businessValue: a.businessValue, comment: a.comment })),
        );
        return {
          id: f.id,
          title: f.title,
          completedAt: f.completedAt,
          plan: f.wsjfBusinessValue,
          actual: f.wsjfBusinessValueActual,
          jobSize: f.wsjfJobSize,
          wsjf: num(f.wsjfComputed),
          wsjfActual: num(f.wsjfComputedActual),
          answers,
          suggestion: suggestActual(answers.map((a) => a.businessValue)),
        };
      }),
    };
  }

  return {
    canRequest,
    canApply,
    people,
    userLabels,
    suggestedReviewerId: art?.valueStream?.businessOwnerId ?? null,
    request: requestView,
    completedCount,
  };
}

export interface FeedbackFormView {
  requestId: string;
  status: "open" | "applied";
  piName: string;
  artName: string;
  dueDate: Date | null;
  requestedBy: string;
  submittedAt: Date | null;
  features: {
    id: string;
    title: string;
    completedAt: Date | null;
    plan: number | null;
    jobSize: number | null;
    wsjf: number | null;
    myValue: number | null;
    myComment: string | null;
  }[];
}

/**
 * Die Seite der Feedback-Person. `null`, wenn es die Runde nicht gibt oder
 * die Person darin nicht benannt ist — beides sieht für sie gleich aus.
 */
export async function loadFeedbackForm(
  db: PrismaClient,
  tenantId: TenantId,
  requestId: string,
  userId: string,
): Promise<FeedbackFormView | null> {
  const reviewer = await db.piFeedbackReviewer.findFirst({
    where: { tenantId, requestId, userId },
    select: {
      submittedAt: true,
      answers: { select: { featureId: true, businessValue: true, comment: true } },
      request: {
        select: {
          id: true,
          status: true,
          dueDate: true,
          requestedBy: true,
          piId: true,
          artId: true,
          pi: { select: { name: true } },
          art: { select: { name: true } },
        },
      },
    },
  });
  if (!reviewer) return null;
  const { request } = reviewer;
  const features = await db.initiative.findMany({
    where: completedFeaturesWhere(tenantId, request.piId, request.artId),
    select: FEATURE_SELECT,
    orderBy: [{ completedAt: "asc" }, { title: "asc" }],
  });
  const mine = new Map(reviewer.answers.map((a) => [a.featureId, a]));
  return {
    requestId: request.id,
    status: request.status as "open" | "applied",
    piName: request.pi.name,
    artName: request.art.name,
    dueDate: request.dueDate,
    requestedBy: request.requestedBy,
    submittedAt: reviewer.submittedAt,
    features: features.map((f) => ({
      id: f.id,
      title: f.title,
      completedAt: f.completedAt,
      plan: f.wsjfBusinessValue,
      jobSize: f.wsjfJobSize,
      wsjf: num(f.wsjfComputed),
      myValue: mine.get(f.id)?.businessValue ?? null,
      myComment: mine.get(f.id)?.comment ?? null,
    })),
  };
}

export interface MyPiFeedbackTask {
  requestId: string;
  piName: string;
  artName: string;
  requestedBy: string;
  dueDate: Date | null;
  overdue: boolean;
  status: FeedbackReviewerStatus;
  submittedAt: Date | null;
  /** Die Runde ist übernommen — die Antwort lässt sich nicht mehr ändern. */
  closed: boolean;
  href: string;
}

/** Wie lange eine erledigte Aufgabe in My Tasks stehen bleibt. */
const DONE_VISIBLE_DAYS = 30;

/**
 * Die Feedback-Aufgaben einer Person für My Tasks: alle offenen, dazu die
 * abgeschickten der letzten 30 Tage.
 */
export async function listMyPiFeedbackTasks(
  db: PrismaClient,
  tenantId: TenantId,
  userId: string,
  now: Date = new Date(),
): Promise<MyPiFeedbackTask[]> {
  const seit = new Date(now.getTime() - DONE_VISIBLE_DAYS * 86_400_000);
  const rows = await db.piFeedbackReviewer.findMany({
    where: {
      tenantId,
      userId,
      OR: [
        { status: "pending", request: { status: "open" } },
        { status: "submitted", submittedAt: { gte: seit } },
      ],
    },
    select: {
      status: true,
      submittedAt: true,
      request: {
        select: {
          id: true,
          status: true,
          dueDate: true,
          requestedBy: true,
          requestedAt: true,
          pi: { select: { name: true } },
          art: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows
    .map((r) => ({
      requestId: r.request.id,
      piName: r.request.pi.name,
      artName: r.request.art.name,
      requestedBy: r.request.requestedBy,
      dueDate: r.request.dueDate,
      overdue: r.status === "pending" && isOverdue(r.request.dueDate, now),
      status: r.status as FeedbackReviewerStatus,
      submittedAt: r.submittedAt,
      closed: r.request.status !== "open",
      href: `/umsetzung/feedback/${r.request.id}`,
    }))
    .sort((a, b) => Number(a.status === "submitted") - Number(b.status === "submitted"));
}
