import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Questionnaire from "@/models/Questionnaire";
import RiskAnalysis from "@/models/RiskAnalysis";
import { performRiskAnalysis } from "@/lib/services/riskAnalyzer";
import RiskItem from "@/models/RiskItem";
import RiskMatrix from "@/models/RiskMatrix";

export async function POST(request: Request) {
  try {
    const { questionnaireId } = await request.json();

    if (!questionnaireId) {
      return NextResponse.json(
        { success: false, error: "Questionnaire ID is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "OPENROUTER_API_KEY not configured" },
        { status: 500 }
      );
    }

    await dbConnect();

    const questionnaire = await Questionnaire.findById(questionnaireId);
    if (!questionnaire) {
      return NextResponse.json(
        { success: false, error: "Questionnaire not found" },
        { status: 404 }
      );
    }

    if (!questionnaire.questions || questionnaire.questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "No questions found in this questionnaire" },
        { status: 400 }
      );
    }

    const existingAnalysis = await RiskAnalysis.findOne({ questionnaireId });
    if (existingAnalysis) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This questionnaire has already been analyzed. View results in the Processed Assessments section.",
        },
        { status: 400 }
      );
    }

    const { acquireAnalysisLock } = await import("@/lib/services/analysisLock");
    const lock = await acquireAnalysisLock(String(questionnaire._id));
    if (!lock || !lock.acquired) {
      return NextResponse.json(
        { success: false, error: "Analysis already in progress for this questionnaire" },
        { status: 409 }
      );
    }

    let analysisResults: any;
    try {
      analysisResults = await performRiskAnalysis(questionnaire.questions, apiKey);
    } finally {
      try {
        const { releaseAnalysisLock } = await import("@/lib/services/analysisLock");
        await releaseAnalysisLock(String(questionnaire._id));
      } catch {
        // ignore
      }
    }

    const categoryToUse = questionnaire.category || "operational";

    const riskAnalysis = new RiskAnalysis({
      questionnaireId: questionnaire._id,
      company: questionnaire.company,
      category: categoryToUse,
      metadata: analysisResults.metadata,
      operational: analysisResults.operational,
      tactical: analysisResults.tactical,
      strategic: analysisResults.strategic,
      summary: analysisResults.summary,
    });

    await riskAnalysis.save();

    // Create RiskItem documents (basic mapping from per-question analysis)
    const allAnalyses = [
      ...(analysisResults.operational || []),
      ...(analysisResults.tactical || []),
      ...(analysisResults.strategic || []),
      ...(analysisResults.humanAwareness || []),
    ];

    const riskItems = allAnalyses.map((item: any) => {
      const score = item.analysis?.riskScore ?? 0;
      const qualitative = (item.analysis?.riskLevel ?? "LOW") as any;
      return {
        analysisId: riskAnalysis._id,
        questionnaireId: questionnaire._id,
        inherentRisk: score,
        residualRisk: score, // TODO: adjust when control effectiveness is modeled
        qualitativeRating: qualitative,
        questionId: item.questionId,
        question: item.question,
        level: item.level,
        gap: item.analysis?.gap ?? "",
        mitigation: item.analysis?.mitigation ?? "",
        threatSummary: item.analysis?.threat ?? "",
      };
    });

    if (riskItems.length > 0) {
      await RiskItem.insertMany(riskItems);
    }

    // Create a basic inherent risk matrix
    const matrixCounts: Record<string, number> = {};
    allAnalyses.forEach((item: any) => {
      const likelihood = item.analysis?.likelihood ?? 0;
      const impact = item.analysis?.impact ?? 0;
      if (!likelihood || !impact) return;
      const key = `${likelihood}-${impact}`;
      matrixCounts[key] = (matrixCounts[key] || 0) + 1;
    });

    const matrixArray = Object.entries(matrixCounts).map(([key, count]) => {
      const [likelihood, impact] = key.split("-").map(Number);
      return { likelihood, impact, count };
    });

    if (matrixArray.length > 0) {
      await RiskMatrix.create({
        analysisId: riskAnalysis._id,
        matrixType: "inherent",
        matrix: matrixArray,
      });
    }

    questionnaire.status = "analyzed";
    await questionnaire.save();

    return NextResponse.json({
      success: true,
      message: "Analysis completed successfully",
      analysisId: String(riskAnalysis._id),
      summary: analysisResults.summary.overall,
    });
  } catch (error: any) {
    console.error("Error in /api/risk-analysis/analyze:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to analyze risk" },
      { status: 500 }
    );
  }
}
