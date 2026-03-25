import { NextResponse } from "next/server";
import { AnalysisService } from "@/lib/services/updateanalysisService";

type ProcessedAnalysisItem = {
  questionId: number;
  level: string;
  question: string;
  answer: string;
  analysis?: {
    likelihood?: number;
    impact?: number;
    riskScore?: number;
    riskLevel?: string;
    gap?: string;
    threat?: string;
    mitigation?: string;
    impactLabel?: string;
    impactDescription?: string;
  };
};

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const {
      analysisId,
      level,
      questionId,
      likelihood,
      impact,
      gap,
      threat,
      mitigation,
      impactLabel,
      likelihoodLabel,
      impactDescription,
    } = body;

    if (!analysisId || !level || typeof questionId !== "number") {
      return NextResponse.json(
        { error: "analysisId, level and questionId are required" },
        { status: 400 }
      );
    }

    const updated = await AnalysisService.updateQuestionAnalysis({
      analysisId,
      level,
      questionId,
      likelihood,
      impact,
      gap,
      threat,
      mitigation,
      impactLabel,
      likelihoodLabel,
      impactDescription,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Analysis or question not found" },
        { status: 404 }
      );
    }

    // Option A: return the full updated analysis document
    // Option B: re-use your processed shape – here is Option B:

    const allAnalyses = [
      ...(updated.operational || []),
      ...(updated.tactical || []),
      ...(updated.strategic || []),
    ];

    const riskMatrix: { [key: string]: number } = {};
    (allAnalyses as ProcessedAnalysisItem[]).forEach((item) => {
      const likelihood = item.analysis?.likelihood || 0;
      const impact = item.analysis?.impact || 0;
      const key = `${likelihood}-${impact}`;
      riskMatrix[key] = (riskMatrix[key] || 0) + 1;
    });

    const riskMatrixArray = Object.entries(riskMatrix).map(
      ([key, count]) => {
        const [likelihood, impact] = key.split("-").map(Number);
        return { likelihood, impact, count };
      }
    );

    const formattedAnalysis = {
      _id: String(updated._id),
      company: updated.company,
      category: updated.category,
      date: updated.createdAt,
      analyses: (allAnalyses as ProcessedAnalysisItem[]).map((a) => ({
        questionId: a.questionId,
        level: a.level,
        question: a.question,
        answer: a.answer,
        likelihood: a.analysis?.likelihood || 0,
        impact: a.analysis?.impact || 0,
        riskScore: a.analysis?.riskScore || 0,
        riskLevel: a.analysis?.riskLevel || "UNKNOWN",
        gap: a.analysis?.gap || "",
        threat: a.analysis?.threat || "",
        mitigation: a.analysis?.mitigation || "",
        impactLabel: a.analysis?.impactLabel || "",
        impactDescription: a.analysis?.impactDescription || "",
      })),
      riskMatrix: riskMatrixArray,
      summary: updated.summary,
    };

    return NextResponse.json({
      success: true,
      assessment: formattedAnalysis,
    });
  } catch (error) {
    console.error("Error updating processed analysis:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message || "Failed to update analysis" },
      { status: 500 }
    );
  }
}
