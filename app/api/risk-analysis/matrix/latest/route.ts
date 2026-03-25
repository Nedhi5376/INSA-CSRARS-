import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import RiskMatrix from "@/models/RiskMatrix";

// SRS: GET /api/risk-analysis/matrix/latest
// Returns the most recently generated inherent risk matrix.

export async function GET() {
  try {
    await dbConnect();

    const latest = await RiskMatrix.findOne({ matrixType: "inherent" })
      .sort({ generatedAt: -1 })
      .lean();

    if (!latest) {
      return NextResponse.json(
        { success: false, error: "No matrices found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, matrix: latest });
  } catch (error: any) {
    console.error("Error in /api/risk-analysis/matrix/latest:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to get latest matrix" },
      { status: 500 }
    );
  }
}
