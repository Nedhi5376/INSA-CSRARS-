import { baseLayout } from "./base";

export interface AnalysisCompletedEmailData {
    company: string;
    category: string;
    analysisId: string;
    totalQuestions: number;
    riskDistribution: {
        CRITICAL?: number;
        HIGH?: number;
        MEDIUM?: number;
        LOW?: number;
        VERY_LOW?: number;
    };
    averageRiskScore: number;
}

export function analysisCompletedEmail(data: AnalysisCompletedEmailData): string {
    const dist = data.riskDistribution;
    const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    const body = `
    <p>Risk analysis has been completed for the following assessment.</p>
    <table class="data">
      <tr><th>Company</th><td>${data.company}</td></tr>
      <tr><th>Category</th><td>${data.category}</td></tr>
      <tr><th>Questions Analysed</th><td>${data.totalQuestions}</td></tr>
      <tr><th>Average Risk Score</th><td>${data.averageRiskScore}</td></tr>
    </table>
    <p><strong>Risk Distribution</strong></p>
    <table class="data">
      <tr>
        <th>Critical</th><th>High</th><th>Medium</th><th>Low</th><th>Very Low</th>
      </tr>
      <tr>
        <td><span class="badge badge-critical">${dist.CRITICAL ?? 0}</span></td>
        <td><span class="badge badge-high">${dist.HIGH ?? 0}</span></td>
        <td>${dist.MEDIUM ?? 0}</td>
        <td>${dist.LOW ?? 0}</td>
        <td>${dist.VERY_LOW ?? 0}</td>
      </tr>
    </table>
    <a class="btn" href="${appUrl}/risk-analysis">View Analysis</a>
  `;
    return baseLayout("Analysis Completed — CSRARS", body);
}
