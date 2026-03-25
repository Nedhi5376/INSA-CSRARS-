import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import RiskAnalysis from "@/models/RiskAnalysis";

// SRS: POST /api/risk-analysis/identify
// Basic implementation: list high/critical items from an existing analysis

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

    const identifiedRisks = allAnalyses
      .filter((a: any) => {
        const level = a.analysis?.riskLevel;
        return level === "CRITICAL" || level === "HIGH";
      })
      .map((a: any) => ({
        questionId: a.questionId,
        question: a.question,
        level: a.level,
        likelihood: a.analysis?.likelihood,
        impact: a.analysis?.impact,
        riskScore: a.analysis?.riskScore,
        riskLevel: a.analysis?.riskLevel,
        gap: a.analysis?.gap,
        threat: a.analysis?.threat,
        mitigation: a.analysis?.mitigation,
      }));

    return NextResponse.json({
      success: true,
      risks: identifiedRisks,
    });
  } catch (error: any) {
    console.error("Error in /api/risk-analysis/identify:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to identify risks" },
      { status: 500 }
    );
  }
}
