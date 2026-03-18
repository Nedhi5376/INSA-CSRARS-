import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Report from "@/models/Report";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const searchParams = req.nextUrl.searchParams;
    const level = searchParams.get("level");

    const query: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (level && ["strategic", "tactical", "operational"].includes(level)) {
      query.level = level;
    }

    const reports = await Report.find(query)
      .populate("analysisId")
      .sort({ createdAt: -1 })
      .limit(50);

    return NextResponse.json({
      success: true,
      reports,
    });
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

