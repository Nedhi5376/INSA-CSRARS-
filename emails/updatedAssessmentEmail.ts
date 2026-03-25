import { baseLayout } from "./base";

export interface UpdatedAssessmentEmailData {
    company: string;
    category: string;
    analysisId: string;
    updatedField: string;
    updatedBy?: string;
}

export function updatedAssessmentEmail(data: UpdatedAssessmentEmailData): string {
    const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    const body = `
    <p>A risk analysis has been manually updated.</p>
    <table class="data">
      <tr><th>Company</th><td>${data.company}</td></tr>
      <tr><th>Category</th><td>${data.category}</td></tr>
      <tr><th>Updated Field</th><td>${data.updatedField}</td></tr>
      ${data.updatedBy ? `<tr><th>Updated By</th><td>${data.updatedBy}</td></tr>` : ""}
    </table>
    <a class="btn" href="${appUrl}/risk-analysis">View Analysis</a>
  `;
    return baseLayout("Assessment Updated — CSRARS", body);
}
