import { NextRequest, NextResponse } from "next/server";
import { ingestQuestionnaire, IngestPayload } from "@/lib/services/ingestionService";

/**
 * POST /api/ingest/questionnaire
 *
 * Direct ingestion endpoint for the external questionnaire platform.
 * All validation, normalization, and storage logic lives in ingestionService.
 *
 * Expected request body: see IngestPayload in lib/services/ingestionService.ts
 */
export async function POST(req: NextRequest) {
  try {
    const body: IngestPayload = await req.json();
    const result = await ingestQuestionnaire(body, "api");

    return NextResponse.json(
      result.success
        ? { success: true, message: "Questionnaire ingested successfully and queued for analysis", data: result.data }
        : { success: false, error: result.error, ...(result.existingId && { existingId: result.existingId }) },
      { status: result.status }
    );
  } catch (error: any) {
    console.error("[Ingest API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
