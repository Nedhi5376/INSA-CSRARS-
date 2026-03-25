import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import RiskAnalysis, { IRiskAnalysis, IQuestionAnalysis } from "@/models/RiskAnalysis";
import { calculateRiskScore, getRiskLevel } from "@/lib/utils/risk";

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


function computeRiskScoreAndLevel(likelihood: number, impact: number) {
  const riskInfo = getRiskLevel(likelihood, impact);

  return {
    riskScore: riskInfo.riskScore,
    riskLevel: riskInfo.riskLevel,
    riskColor: riskInfo.riskColor,
  };
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
    const { riskScore, riskLevel, riskColor } = computeRiskScoreAndLevel(
      likelihood,
      impact
    );
    item.analysis.riskScore = riskScore;
    item.analysis.riskLevel = riskLevel;
    item.analysis.riskColor = riskColor;

    await analysis.save();

    return analysis;
  }
}
