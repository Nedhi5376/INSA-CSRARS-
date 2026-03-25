import { baseLayout } from "./base";

export interface NewAssessmentEmailData {
    company: string;
    filledBy: string;
    role: string;
    category: string;
    questionCount: number;
    filledDate: string;
}

export function newAssessmentEmail(data: NewAssessmentEmailData): string {
    const body = `
    <p>A new security assessment has been submitted and is ready for analysis.</p>
    <table class="data">
      <tr><th>Company</th><td>${data.company}</td></tr>
      <tr><th>Submitted By</th><td>${data.filledBy} (${data.role})</td></tr>
      <tr><th>Category</th><td>${data.category}</td></tr>
      <tr><th>Questions</th><td>${data.questionCount}</td></tr>
      <tr><th>Date</th><td>${data.filledDate}</td></tr>
    </table>
    <p>Log in to the CSRARS dashboard to review and process this assessment.</p>
    <a class="btn" href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/questionnaires">
      View Assessments
    </a>
  `;
    return baseLayout("New Assessment Received — CSRARS", body);
}
