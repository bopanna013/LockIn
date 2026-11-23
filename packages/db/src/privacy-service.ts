import { NotFoundError } from "@lockin/domain/shared";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "./client";
import { withRequestContext } from "./context";
import {
  assessmentResponses,
  auditLogs,
  guardianConsents,
  organizations,
  studentProfiles,
  studentRecommendations,
  studentRoadmapItems,
  studentRoadmaps,
  users,
} from "./schema";

export interface StudentPersonalDataExport {
  exportedAt: string;
  dpdpNoticeVersion: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    dateOfBirth: string;
    isMinor: boolean;
    accountStatus: string;
    preferredLocale: string;
    createdAt: Date;
  };
  guardianConsentHistory: {
    action: string;
    guardianFullName: string;
    guardianEmail: string;
    relationship: string;
    verificationMethod: string;
    noticeVersion: string;
    recordedAt: Date;
  }[];
  academicProfile: unknown;
  assessmentResponses: unknown[];
  recommendations: unknown[];
  roadmaps: {
    roadmap: unknown;
    items: unknown[];
  }[];
}

/**
 * Assemble a complete, machine-readable JSON bundle of all personal data stored
 * for a student across `system` and RLS-scoped `student` tables (DPDP Act 2023 right of access).
 */
export async function exportStudentPersonalData(
  db: Database,
  context: { userId: string; orgId: string; ipAddress?: string },
): Promise<StudentPersonalDataExport> {
  const [user] = await db.select().from(users).where(eq(users.id, context.userId)).limit(1);

  if (!user) {
    throw new NotFoundError("User not found.");
  }

  const consents = await db
    .select()
    .from(guardianConsents)
    .where(eq(guardianConsents.studentUserId, user.id))
    .orderBy(desc(guardianConsents.recordedAt));

  const studentData = await withRequestContext(
    db,
    { userId: context.userId, orgId: context.orgId },
    async (tx) => {
      const [profile] = await tx
        .select()
        .from(studentProfiles)
        .where(
          and(eq(studentProfiles.userId, context.userId), eq(studentProfiles.orgId, context.orgId)),
        )
        .limit(1);

      const assessments = await tx
        .select()
        .from(assessmentResponses)
        .where(
          and(
            eq(assessmentResponses.userId, context.userId),
            eq(assessmentResponses.orgId, context.orgId),
          ),
        );

      const recommendations = await tx
        .select()
        .from(studentRecommendations)
        .where(
          and(
            eq(studentRecommendations.userId, context.userId),
            eq(studentRecommendations.orgId, context.orgId),
          ),
        );

      const roadmaps = await tx
        .select()
        .from(studentRoadmaps)
        .where(
          and(eq(studentRoadmaps.userId, context.userId), eq(studentRoadmaps.orgId, context.orgId)),
        );

      const roadmapsWithItems = await Promise.all(
        roadmaps.map(async (r) => {
          const items = await tx
            .select()
            .from(studentRoadmapItems)
            .where(eq(studentRoadmapItems.roadmapId, r.id));
          return { roadmap: r, items };
        }),
      );

      return {
        profile: profile ?? null,
        assessments,
        recommendations,
        roadmaps: roadmapsWithItems,
      };
    },
  );

  await db.insert(auditLogs).values({
    actorUserId: user.id,
    actorType: "user",
    action: "privacy.personal_data_exported",
    targetType: "user",
    targetId: user.id,
    orgId: context.orgId,
    ipAddress: context.ipAddress ?? null,
  });

  return {
    exportedAt: new Date().toISOString(),
    dpdpNoticeVersion: "2026-11-v1",
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      dateOfBirth: user.dateOfBirth,
      isMinor: user.isMinor,
      accountStatus: user.accountStatus,
      preferredLocale: user.preferredLocale,
      createdAt: user.createdAt,
    },
    guardianConsentHistory: consents.map((c) => ({
      action: c.action,
      guardianFullName: c.guardianFullName,
      guardianEmail: c.guardianEmail,
      relationship: c.relationship,
      verificationMethod: c.verificationMethod,
      noticeVersion: c.noticeVersion,
      recordedAt: c.recordedAt,
    })),
    academicProfile: studentData.profile,
    assessmentResponses: studentData.assessments,
    recommendations: studentData.recommendations,
    roadmaps: studentData.roadmaps,
  };
}

/**
 * Permanently erase a student's account, personal organization, and all RLS-scoped
 * `student.*` records while leaving shared `content.*` completely untouched
 * (DPDP Act 2023 right to erasure).
 */
export async function deleteStudentAccountAndData(
  db: Database,
  params: { userId: string; orgId: string; ipAddress?: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(auditLogs).values({
      actorUserId: null,
      actorType: "user",
      action: "privacy.account_deleted",
      targetType: "user",
      targetId: params.userId,
      ipAddress: params.ipAddress ?? null,
      metadata: { erasedOrgId: params.orgId },
    });

    await tx
      .delete(organizations)
      .where(and(eq(organizations.id, params.orgId), eq(organizations.ownerUserId, params.userId)));
    await tx.delete(users).where(eq(users.id, params.userId));
  });
}
