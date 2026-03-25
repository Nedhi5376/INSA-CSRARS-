/**
 * lib/notifications.ts
 *
 * Central hub for all notifications:
 *   1. Persist to MongoDB (AppNotification)
 *   2. Broadcast over SSE (sseHub)
 *   3. Send email (lib/email) — fire-and-forget, never throws
 */
import dbConnect from "@/lib/mongodb";
import AppNotification, { NotificationType } from "@/models/AppNotification";
import { broadcastEvent } from "@/lib/sseHub";
import { sendAdminEmail } from "@/lib/email";
import { analysisCompletedEmail } from "@/emails/analysisCompletedEmail";
import { criticalRiskEmail } from "@/emails/criticalRiskEmail";

interface CreateNotificationOptions {
    type: NotificationType;
    title: string;
    message: string;
    meta?: Record<string, unknown>;
}

/** Persist + SSE broadcast. Never throws. */
export async function createNotification(opts: CreateNotificationOptions) {
    try {
        await dbConnect();
        const doc = await AppNotification.create({
            type: opts.type,
            title: opts.title,
            message: opts.message,
            meta: opts.meta ?? {},
            read: false,
        });
        broadcastEvent(opts.type, {
            id: String(doc._id),
            type: doc.type,
            title: doc.title,
            message: doc.message,
            meta: doc.meta,
            createdAt: doc.createdAt,
        });
        return doc;
    } catch (err) {
        console.error("[notifications] Failed to create notification:", err);
        return null;
    }
}

/** Notify + email after analysis completes. */
export async function notifyAnalysisCompleted(opts: {
    analysisId: string;
    company: string;
    category: string;
    summary: {
        overall?: {
            totalQuestionsAnalyzed?: number;
            averageRiskScore?: number;
            riskDistribution?: {
                CRITICAL?: number;
                HIGH?: number;
                MEDIUM?: number;
                LOW?: number;
                VERY_LOW?: number;
            };
        };
    };
}) {
    await createNotification({
        type: "analysis",
        title: "Risk Analysis Completed",
        message: `Analysis done for: ${opts.company} (${opts.category})`,
        meta: { analysisId: opts.analysisId, company: opts.company, category: opts.category },
    });

    const overall = opts.summary?.overall ?? {};
    sendAdminEmail(
        `Analysis Completed — ${opts.company}`,
        analysisCompletedEmail({
            company: opts.company,
            category: opts.category,
            analysisId: opts.analysisId,
            totalQuestions: overall.totalQuestionsAnalyzed ?? 0,
            riskDistribution: overall.riskDistribution ?? {},
            averageRiskScore: overall.averageRiskScore ?? 0,
        })
    ).catch((e) => console.error("[email] analysisCompleted:", e));
}

/** Notify + email when CRITICAL risks are found. No-op if criticalCount === 0. */
export async function notifyIfCriticalRisks(opts: {
    analysisId: string;
    company: string;
    category: string;
    summary: {
        overall?: {
            riskDistribution?: { CRITICAL?: number };
            topRisks?: Array<{ gap: string; riskScore: number }>;
        };
    };
}) {
    const criticalCount = opts.summary?.overall?.riskDistribution?.CRITICAL ?? 0;
    if (criticalCount === 0) return;

    await createNotification({
        type: "critical_risk",
        title: "⚠ Critical Risks Detected",
        message: `${criticalCount} critical risk${criticalCount > 1 ? "s" : ""} found for ${opts.company} (${opts.category})`,
        meta: { analysisId: opts.analysisId, company: opts.company, category: opts.category, criticalCount },
    });

    sendAdminEmail(
        `⚠ Critical Risks Detected — ${opts.company}`,
        criticalRiskEmail({
            company: opts.company,
            category: opts.category,
            analysisId: opts.analysisId,
            criticalCount,
            topRisks: opts.summary?.overall?.topRisks,
        })
    ).catch((e) => console.error("[email] criticalRisk:", e));
}
