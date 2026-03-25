import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import RiskAnalysis, { IRiskAnalysis, IQuestionAnalysis } from "@/models/RiskAnalysis";
import { getRiskLevel } from "@/lib/utils/ai";

export type AnalysisLevel = "operational" | "tactical" | "strategic";

export interface UpdateQuestionAnalysisInput {
  analysisId: string;
  level: AnalysisLevel;
  questionId: number;
  // Editable fields 
  likelihood?: number;
  impact?: number;
  gap?: string;
  threat?: string;
  mitigation?: string;
  impactLabel?: string;
  likelihoodLabel?: string;
  impactDescription?: string;
}

function hasMeaningfulGap(gap: string | undefined, mitigation: string | undefined) {
  const normalizedGap = String(gap || "").toLowerCase();
  const normalizedMitigation = String(mitigation || "").toLowerCase();
  return (
    normalizedGap !== "" &&
    normalizedGap !== "no potential gap" &&
    normalizedMitigation !== "current controls are adequate"
  );
}

function summarizeLevel(levelData: IQuestionAnalysis[]) {
  if (!levelData.length) {
    return {
      totalQuestions: 0,
      riskDistribution: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 },
      averageRiskScore: 0,
      averageInherentRiskScore: 0,
      averageResidualRiskScore: 0,
      topRisks: [],
    };
  }

  const riskDistribution = levelData.reduce<Record<string, number>>(
    (acc, item) => {
      const level = item.analysis.riskLevel || "UNKNOWN";
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 }
  );

  const averageRiskScore =
    levelData.reduce((sum, item) => sum + (item.analysis.riskScore || 0), 0) / levelData.length;
  const averageInherentRiskScore =
    levelData.reduce((sum, item) => sum + (item.analysis.inherentRiskScore || 0), 0) / levelData.length;
  const averageResidualRiskScore =
    levelData.reduce((sum, item) => sum + (item.analysis.residualRiskScore || 0), 0) / levelData.length;

  return {
    totalQuestions: levelData.length,
    riskDistribution,
    averageRiskScore: Number(averageRiskScore.toFixed(2)),
    averageInherentRiskScore: Number(averageInherentRiskScore.toFixed(2)),
    averageResidualRiskScore: Number(averageResidualRiskScore.toFixed(2)),
    topRisks: [...levelData]
      .sort((a, b) => (b.analysis.riskScore || 0) - (a.analysis.riskScore || 0))
      .slice(0, 3)
      .map((item) => ({
        questionId: item.questionId,
        riskLevel: item.analysis.riskLevel,
        riskScore: item.analysis.riskScore,
        gap: item.analysis.gap,
      })),
  };
}

function rebuildSummary(analysis: IRiskAnalysis) {
  const operational = summarizeLevel(analysis.operational as unknown as IQuestionAnalysis[]);
  const tactical = summarizeLevel(analysis.tactical as unknown as IQuestionAnalysis[]);
  const strategic = summarizeLevel(analysis.strategic as unknown as IQuestionAnalysis[]);
  const allData = [
    ...(analysis.operational as unknown as IQuestionAnalysis[]),
    ...(analysis.tactical as unknown as IQuestionAnalysis[]),
    ...(analysis.strategic as unknown as IQuestionAnalysis[]),
  ];
  const overall = {
    totalQuestionsAnalyzed: allData.length,
    riskDistribution: summarizeLevel(allData).riskDistribution,
    averageRiskScore: summarizeLevel(allData).averageRiskScore,
    averageInherentRiskScore: summarizeLevel(allData).averageInherentRiskScore,
    averageResidualRiskScore: summarizeLevel(allData).averageResidualRiskScore,
  };

  return { operational, tactical, strategic, overall };
}

export class AnalysisService {
  static async getById(analysisId: string): Promise<IRiskAnalysis | null> {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(analysisId)) {
      return null;
    }

    const doc = await RiskAnalysis.findById(analysisId);
    return doc;
  }

  static async updateQuestionAnalysis(
    input: UpdateQuestionAnalysisInput
  ): Promise<IRiskAnalysis | null> {
    const { analysisId, level, questionId } = input;

    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(analysisId)) {
      throw new Error("Invalid analysisId");
    }

    const analysis = await RiskAnalysis.findById(analysisId);
    if (!analysis) {
      return null;
    }

    const levelArray = analysis[level] as unknown as IQuestionAnalysis[];
    if (!Array.isArray(levelArray)) {
      throw new Error(`Invalid level array: ${level}`);
    }

    const item = levelArray.find((q) => q.questionId === questionId);
    if (!item) {
      return null;
    }

    // Apply partial updates
    if (typeof input.likelihood === "number") {
      item.analysis.likelihood = input.likelihood;
    }
    if (typeof input.impact === "number") {
      item.analysis.impact = input.impact;
    }
    if (typeof input.gap === "string") {
      item.analysis.gap = input.gap;
    }
    if (typeof input.threat === "string") {
      item.analysis.threat = input.threat;
    }
    if (typeof input.mitigation === "string") {
      item.analysis.mitigation = input.mitigation;
    }
    if (typeof input.impactLabel === "string") {
      item.analysis.impactLabel = input.impactLabel;
    }
    if (typeof input.likelihoodLabel === "string") {
      item.analysis.likelihoodLabel = input.likelihoodLabel;
    }
    if (typeof input.impactDescription === "string") {
      item.analysis.impactDescription = input.impactDescription;
    }

    // Recompute derived fields if likelihood/impact changed
    const { likelihood, impact } = item.analysis;
    const recalculatedRisk = getRiskLevel(likelihood, impact);
    const inherentLikelihood = hasMeaningfulGap(item.analysis.gap, item.analysis.mitigation)
      ? Math.min(5, likelihood + 1)
      : likelihood;
    const inherentImpact = hasMeaningfulGap(item.analysis.gap, item.analysis.mitigation)
      ? Math.min(5, impact + 1)
      : impact;
    const inherentRisk = getRiskLevel(inherentLikelihood, inherentImpact);
    item.analysis.riskScore = recalculatedRisk.riskScore;
    item.analysis.riskLevel = recalculatedRisk.riskLevel;
    item.analysis.riskColor = recalculatedRisk.riskColor;
    item.analysis.impactLabel = recalculatedRisk.impactLabel;
    item.analysis.likelihoodLabel = recalculatedRisk.likelihoodLabel;
    item.analysis.residualRiskScore = recalculatedRisk.riskScore;
    item.analysis.residualRiskLevel = recalculatedRisk.riskLevel;
    item.analysis.inherentRiskScore = inherentRisk.riskScore;
    item.analysis.inherentRiskLevel = inherentRisk.riskLevel;
    analysis.summary = rebuildSummary(analysis);

    await analysis.save();

    return analysis;
  }
}
