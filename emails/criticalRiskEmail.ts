import { baseLayout } from "./base";

export interface CriticalRiskEmailData {
    company: string;
    category: string;
    analysisId: string;
    criticalCount: number;
    topRisks?: Array<{ gap: string; riskScore: number }>;
}

export function criticalRiskEmail(data: CriticalRiskEmailData): string {
    const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    const topRisksHtml =
        data.topRisks && data.topRisks.length > 0
            ? `<p><strong>Top Critical Findings</strong></p>
         <table class="data">
           <tr><th>#</th><th>Security Gap</th><th>Risk Score</th></tr>
           ${data.topRisks
                .slice(0, 5)
                .map(
                    (r, i) =>
                        `<tr><td>${i + 1}</td><td>${r.gap}</td><td><span class="badge badge-critical">${r.riskScore}</span></td></tr>`
                )
                .join("")}
         </table>`
            : "";

    const body = `
    <p>
      <span class="badge badge-critical">⚠ CRITICAL ALERT</span>
    </p>
    <p>
      <strong>${data.criticalCount} critical risk${data.criticalCount > 1 ? "s" : ""}</strong>
      ${data.criticalCount > 1 ? "have" : "has"} been identified for
      <strong>${data.company}</strong> (${data.category}).
      Immediate attention is required.
    </p>
    ${topRisksHtml}
    <a class="btn" href="${appUrl}/risk-analysis">Review Critical Risks</a>
  `;
    return baseLayout("⚠ Critical Risks Detected — CSRARS", body);
}
