import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import RiskMatrix from "@/models/RiskMatrix";
import RiskAnalysis from "@/models/RiskAnalysis";

// SRS: POST /api/risk-analysis/matrix
// Returns a 5x5-like matrix for a given analysisId (inherent risk matrix).

export async function POST(request: Request) {
  try {
    const { analysisId } = await request.json();

    if (!analysisId) {
      return NextResponse.json(
        { success: false, error: "analysisId is required" },
        { status: 400 }
      );
    }

    await dbConnect();

  let matrix = await RiskMatrix.findOne({ analysisId, matrixType: "inherent" }).lean();

    if (!matrix) {
      // Fallback: derive from RiskAnalysis if matrix not yet stored
      const analysis = await RiskAnalysis.findById(analysisId).lean();
      if (!analysis) {
        return NextResponse.json(
          { success: false, error: "Analysis not found" },
          { status: 404 }
        );
      }

      const allAnalyses = [
        ...(analysis.operational || []),
        ...(analysis.tactical || []),
        ...(analysis.strategic || []),
        ...(analysis.humanAwareness || []),
      ];

      const counts: Record<string, number> = {};
      allAnalyses.forEach((item: any) => {
        const likelihood = item.analysis?.likelihood ?? 0;
        const impact = item.analysis?.impact ?? 0;
        if (!likelihood || !impact) return;
        const key = `${likelihood}-${impact}`;
        counts[key] = (counts[key] || 0) + 1;
      });

      const matrixArray = Object.entries(counts).map(([key, count]) => {
        const [likelihood, impact] = key.split("-").map(Number);
        return { likelihood, impact, count };
      });

      const created = await RiskMatrix.create({
        analysisId,
        matrixType: "inherent",
        matrix: matrixArray,
      });
      matrix = created.toObject() as any;
    }

    return NextResponse.json({ success: true, matrix });
  } catch (error: any) {
    console.error("Error in /api/risk-analysis/matrix:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to get matrix" },
      { status: 500 }
    );
  }
}
