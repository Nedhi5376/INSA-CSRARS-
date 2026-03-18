import { initializeAI } from './utils/ai';

// Minimal generateReport wrapper so existing routes importing from `@/lib/ai` work.
export async function generateReport(level: string, analysisData: any) {
  // Very small report generator for compatibility. For richer reports plug your real AI/reporting pipeline.
  const content = `Report (level: ${level})\n\nSummary:\n${JSON.stringify(analysisData, null, 2)}`;
  return {
    content,
    riskMatrix: analysisData.riskMatrix || { high: 0, medium: 0, low: 0 },
    charts: analysisData.charts || [],
  };
}

export async function analyzeQuestionnaire(responses: any[]) {
  // For compatibility: run a simple deterministic mapping to a minimal analysis result.
  return {
    vulnerabilities: [],
    riskScore: 0,
    category: 'N/A',
    inherentRisk: null,
    residualRisk: null,
    aiInsights: null,
  };
}

export default { generateReport, analyzeQuestionnaire };
