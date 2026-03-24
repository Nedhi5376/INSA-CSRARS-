import { NextRequest, NextResponse } from "next/server";
import {
  ingestThreatEntries,
  getActiveThreats,
  deactivateOldThreats,
  RawThreatEntry,
} from "@/lib/services/threatFeedService";

/**
 * POST /api/ingest/threat-feed
 * Ingest one or more threat intelligence entries.
 *
 * Expected body:
 * {
 *   entries: RawThreatEntry[]   // array of threat entries to ingest
 * }
 *
 * GET /api/ingest/threat-feed
 * Retrieve active threats. Optional query params:
 *   ?severity=critical|high|medium|low
 *   ?category=malware|phishing|ransomware|vulnerability|...
 *   ?sector=finance
 *
 * DELETE /api/ingest/threat-feed
 * Deactivate threats older than N days.
 *
 * Expected body:
 * {
 *   olderThanDays?: number   // default 90
 * }
 */

export async function POST(req: NextRequest) {
  try {
    // Validate secret for external pushes
    const secret = req.headers.get("x-webhook-secret");
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing required field: entries (non-empty array)" },
        { status: 400 }
      );
    }

    const result = await ingestThreatEntries(body.entries as RawThreatEntry[]);

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error: any) {
    console.error("[ThreatFeed API] POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const filters = {
      severity: searchParams.get("severity") as any || undefined,
      category: searchParams.get("category") as any || undefined,
      sector: searchParams.get("sector") || undefined,
    };

    const threats = await getActiveThreats(filters);

    return NextResponse.json(
      { success: true, total: threats.length, threats },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[ThreatFeed API] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const secret = req.headers.get("x-webhook-secret");
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const olderThanDays = typeof body.olderThanDays === "number" ? body.olderThanDays : 90;

    const count = await deactivateOldThreats(olderThanDays);

    return NextResponse.json(
      { success: true, message: `Deactivated ${count} threats older than ${olderThanDays} days` },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[ThreatFeed API] DELETE error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
