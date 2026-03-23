import { NextRequest, NextResponse } from "next/server";
import { ingestQuestionnaire, IngestPayload } from "@/lib/services/ingestionService";

/**
 * POST /api/ingest/webhook
 *
 * Webhook receiver for external platforms.
 * Responsibilities (only):
 *   1. Validate the shared secret (X-Webhook-Secret header)
 *   2. Validate the event type
 *   3. Forward the payload to the shared ingestion service
 *
 * No data processing, validation, or DB operations happen here.
 *
 * Supported events:
 *   - "questionnaire.submitted"
 *   - "questionnaire.updated" (re-ingests — duplicate check handled by service)
 *
 * Security: set WEBHOOK_SECRET in .env.local and share it with the external platform.
 */

const SUPPORTED_EVENTS = ["questionnaire.submitted", "questionnaire.updated"];

export async function POST(req: NextRequest) {
  try {
    // 1. Validate secret
    const secret = req.headers.get("x-webhook-secret");
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
      console.warn("[Webhook] Rejected — invalid or missing secret");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    // 2. Validate event envelope
    if (!body.event || !body.payload || !body.source) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: event, payload, source" },
        { status: 400 }
      );
    }

    if (!SUPPORTED_EVENTS.includes(body.event)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported event "${body.event}". Supported: ${SUPPORTED_EVENTS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // 3. Forward to ingestion service
    const result = await ingestQuestionnaire(body.payload as IngestPayload, `webhook:${body.source}`);

    return NextResponse.json(
      result.success
        ? { success: true, event: body.event, message: "Questionnaire received and queued for analysis", data: result.data }
        : { success: false, event: body.event, error: result.error, ...(result.existingId && { existingId: result.existingId }) },
      { status: result.status }
    );
  } catch (error: any) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
