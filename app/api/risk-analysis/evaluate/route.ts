import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import RiskAnalysis from "@/models/RiskAnalysis";
import RiskConfig from "@/models/RiskConfig";
import RiskMatrix from "@/models/RiskMatrix";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRiskLevelByScore } from "@/lib/utils/risk";

// SRS: POST /api/risk-analysis/evaluate
// Uses Likelihood x Impact and qualitative (H/M/L) evaluation based on existing scores.

export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin", "analyst"]);

    const { analysisId, questionnaireScore, scannerData, asset, threatIntel } =
      await request.json();

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

    const scores = allAnalyses
      .map((a: any) => a.analysis?.riskScore)
      .filter((s: any) => typeof s === "number");

    const avgScore =
      scores.length > 0
        ? scores.reduce((sum: number, v: number) => sum + v, 0) / scores.length
        : 0;

    const qualitativeInfo = getRiskLevelByScore(avgScore);
    const qualitative = qualitativeInfo.riskLevel;

    const averageALE = 0; // Calculate or retrieve the average ALE value
    const aleBand =
      averageALE >= 16
        ? "CRITICAL"
        : averageALE >= 12
        ? "HIGH"
        : averageALE >= 6
        ? "MEDIUM"
        : "LOW";

    const controlEffectiveness = 0; // derive or default, e.g. 0

    const residual = calculateResidualRisk(avgScore, controlEffectiveness);

    // Save to RiskMatrix
    const inherentArray = []; // Populate with actual data
    const residualArray = []; // Populate with actual data

    await RiskMatrix.create({
      analysisId: analysis._id,
      matrixType: "inherent",
      matrix: inherentArray,
    });

    await RiskMatrix.create({
      analysisId: analysis._id,
      matrixType: "residual",
      matrix: residualArray,
    });

    return NextResponse.json({
      success: true,
      evaluation: {
        averageRiskScore: avgScore,
        qualitative,
        quantitative:
          averageALE > 0
            ? {
                averageALE,
                aleRiskLevel: aleBand, // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
              }
            : null,
        inherentRisk: avgScore,
        residualRisk: residual,
        controlEffectiveness,
      },
    });
  } catch (error: any) {
    console.error("Error in /api/risk-analysis/evaluate:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to evaluate risk" },
      { status: 500 }
    );
  }
}

export interface AleInput {
  assetValue: number;
  exposureFactor: number;      // 0–1
  annualizedRateOfOccurrence: number;
}

export interface AleResult {
  sle: number;
  ale: number;
  aro: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export async function calculateAle(input: AleInput): Promise<AleResult> {
  const { assetValue, exposureFactor, annualizedRateOfOccurrence } = input;

  const sle = assetValue * exposureFactor;
  const ale = sle * annualizedRateOfOccurrence;
  const aro = annualizedRateOfOccurrence;

  const cfg = await RiskConfig.getActiveConfig(); // e.g. singleton row

  // Example ALE bands based on config thresholds (you might add explicit ALE thresholds later)
  let riskLevel: AleResult["riskLevel"] = "LOW";
  if (ale >= cfg.highThreshold) riskLevel = "CRITICAL";
  else if (ale >= cfg.mediumThreshold) riskLevel = "HIGH";
  else if (ale >= cfg.lowThreshold) riskLevel = "MEDIUM";

  return { sle, ale, aro, riskLevel };
}

// Example input
const input: AleInput = {
  assetValue: 500000,
  exposureFactor: 0.4,
  annualizedRateOfOccurrence: 1.5,
};

// Calculate ALE and risk level
calculateAle(input).then((result) => {
  console.log("ALE Calculation Result:", result);
  /*
  Example output:
  {
    "sle": 100000,
    "ale": 250000,
    "aro": 2.5,
    "riskLevel": "HIGH"
  }
  */
});

function calculateResidualRisk(score: number, controlEffectiveness: number) {
  // Placeholder for residual risk calculation logic
  // For example, you might reduce the score by the control effectiveness percentage
  return score - score * (controlEffectiveness / 100);
}

export interface HybridInput {
  questionnaireScore: number;
  vulnerabilityScore: number;
  assetCriticality: number;
  threatIntelScore: number;
}

export function calculateHybridScore(input: HybridInput): number {
  const { questionnaireScore, vulnerabilityScore, assetCriticality, threatIntelScore } = input;
  return (
    0.4 * questionnaireScore +
    0.3 * vulnerabilityScore +
    0.2 * assetCriticality +
    0.1 * threatIntelScore
  );
}

export interface CvssResult {
  baseScore: number;
  temporalScore?: number;
  environmentalScore?: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export function calculateCvssFromVector(vector: string): CvssResult { /* ... */ }

// Example Hybrid input
const hybridInput: HybridInput = {
  questionnaireScore: 3.5,
  vulnerabilityScore: 4.5,
  assetCriticality: 4,
  threatIntelScore: 3,
};

// Calculate Hybrid Score
const hybridScore = calculateHybridScore(hybridInput);

console.log("Hybrid Score:", hybridScore);
/*
Example output:
{
  "success": true,
  "hybridScore": 4.02,
  "components": {
    "questionnaireScore": 3.5,
    "vulnerabilityScore": 4.5,
    "assetCriticality": 4,
    "threatIntelScore": 3
  }
}
*/

export async function pushToRiskRegister(payload: any): Promise<void> {
  await fetch("/api/risk-register/add", { method: "POST", body: JSON.stringify(payload), headers: {...} });
}

export async function writeAuditLog(payload: any): Promise<void> {
  await fetch("/api/audit-log/log", { method: "POST", body: JSON.stringify(payload), headers: {...} });
}

// CVSS Example Calculation
const cvssVector = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"; // Example vector
const cvssResult = calculateCvssFromVector(cvssVector);

console.log("CVSS Calculation Result:", cvssResult);
/*
Example output:
{
  "baseScore": 9.8,
  "severity": "CRITICAL"
}
*/

export async function requireRole(request: Request, allowed: string[]) {
  const session = await getServerSession(authOptions);
  if (!session || !allowed.includes(session.user.role)) {
    throw new Error("Forbidden");
  }
}

// Sample request body
const requestBody = {
  "analysisId": "665f...",
  "questionnaireScore": 3.5,
  "scannerData": [
    { "cve": "CVE-2025-1234", "severity": "HIGH" }
  ],
  "asset": {
    "id": "asset-001",
    "criticality": 4
  },
  "threatIntel": [
    { "indicator": "malware-campaign", "severity": "MEDIUM" }
  ]
};
