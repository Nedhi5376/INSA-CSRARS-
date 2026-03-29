import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Questionnaire from "@/models/Questionnaire";
import ThreatFeed from "@/models/ThreatFeed";
import Asset from "@/models/Asset";
import { buildNormalizedBundle } from "@/lib/services/normalizationService";

/**
 * GET /api/ingest/normalize
 *
 * Returns a fully normalized data bundle combining all ingested sources:
 * questionnaires, threat intelligence, and asset inventory.
 *
 * This is the output endpoint of Module 1 — Module 2 calls this to get
 * clean, consistent data ready for risk analysis and correlation.
 *
 * Optional query params:
 *   ?company=CompanyName     filter questionnaires by company
 *   ?status=pending          filter questionnaires by status (default: all)
 *   ?activeOnly=true         only include active threats and assets (default: true)
 */
export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || undefined;
    const status = searchParams.get("status") || undefined;
    const activeOnly = searchParams.get("activeOnly") !== "false";

    // Build questionnaire query
    const questionnaireQuery: Record<string, any> = {};
    if (company) questionnaireQuery.company = company;
    if (status) questionnaireQuery.status = status;

    // Fetch all three sources in parallel
    const [questionnaires, threats, assets] = await Promise.all([
      Questionnaire.find(questionnaireQuery).lean(),
      ThreatFeed.find(activeOnly ? { isActive: true } : {}).lean(),
      Asset.find(activeOnly ? { isActive: true } : {}).lean(),
    ]);

    const bundle = buildNormalizedBundle(
      questionnaires as any,
      threats as any,
      assets as any
    );

    return NextResponse.json({ success: true, ...bundle }, { status: 200 });
  } catch (error: any) {
    console.error("[Normalize API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
