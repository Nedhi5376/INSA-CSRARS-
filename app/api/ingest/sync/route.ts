import { NextRequest, NextResponse } from "next/server";
import { syncRealTime, syncBatch, syncManual, SyncMode } from "@/lib/services/syncService";
import { IngestPayload } from "@/lib/services/ingestionService";

/**
 * POST /api/ingest/sync
 *
 * Sync mode controller endpoint.
 * Accepts a sync mode and one or more questionnaire payloads.
 *
 * Expected request body:
 * {
 *   mode: "real-time" | "batch" | "manual",
 *   payload: IngestPayload          // for real-time and manual (single)
 *   payloads: IngestPayload[]       // for batch (array)
 * }
 *
 * - real-time : single questionnaire ingested immediately
 * - batch     : multiple questionnaires ingested sequentially
 * - manual    : user-triggered ingestion of a single questionnaire
 */

const VALID_MODES: SyncMode[] = ["real-time", "batch", "manual"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.mode) {
      return NextResponse.json(
        { success: false, error: "Missing required field: mode" },
        { status: 400 }
      );
    }

    if (!VALID_MODES.includes(body.mode)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid mode "${body.mode}". Must be one of: ${VALID_MODES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // --- Real-time mode ---
    if (body.mode === "real-time") {
      if (!body.payload) {
        return NextResponse.json(
          { success: false, error: "real-time mode requires a single 'payload' object" },
          { status: 400 }
        );
      }

      const result = await syncRealTime(body.payload as IngestPayload);
      return NextResponse.json({ success: true, ...result }, { status: 201 });
    }

    // --- Batch mode ---
    if (body.mode === "batch") {
      if (!Array.isArray(body.payloads) || body.payloads.length === 0) {
        return NextResponse.json(
          { success: false, error: "batch mode requires a non-empty 'payloads' array" },
          { status: 400 }
        );
      }

      const result = await syncBatch(body.payloads as IngestPayload[]);

      // batch always returns 200 — partial failures are reported inside results[]
      return NextResponse.json({ success: true, ...result }, { status: 200 });
    }

    // --- Manual mode ---
    if (body.mode === "manual") {
      if (!body.payload) {
        return NextResponse.json(
          { success: false, error: "manual mode requires a single 'payload' object" },
          { status: 400 }
        );
      }

      const result = await syncManual(body.payload as IngestPayload);
      return NextResponse.json({ success: true, ...result }, { status: 201 });
    }
  } catch (error: any) {
    console.error("[Sync] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
