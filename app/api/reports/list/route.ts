import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Report from "@/models/Report";

type ReportLevel = "strategic" | "tactical" | "operational";
type SessionRole = "Director" | "Division Head" | "Risk Analyst" | "Staff";

const REPORT_ROLES: SessionRole[] = ["Director", "Division Head", "Risk Analyst", "Staff"];

function isAuthorized(role: unknown): role is SessionRole {
  return typeof role === "string" && REPORT_ROLES.includes(role as SessionRole);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const role = session?.user ? (session.user as { role?: unknown }).role : undefined;
    if (!session || !isAuthorized(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const levelParam = req.nextUrl.searchParams.get("level");
    const query: { level?: ReportLevel } = {};
    if (
      levelParam === "strategic" ||
      levelParam === "tactical" ||
      levelParam === "operational"
    ) {
      query.level = levelParam;
    }

    const reports = await Report.find(query)
      .populate("analysisId")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({
      success: true,
      reports,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch reports";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
