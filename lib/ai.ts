export type GeneratedReportLevel = "strategic" | "tactical" | "operational";

export interface ReportFinding {
  questionId: number;
  section: string;
  level: string;
  question: string;
  answer: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  riskLevel: string;
  gap: string;
  threat: string;
  mitigation: string;
  impactLabel?: string;
  likelihoodLabel?: string;
  impactDescription?: string;
}

export interface GenerateReportInput {
  company: string;
  category: string;
  generatedAt?: string;
  summary?: {
    operational?: unknown;
    tactical?: unknown;
    strategic?: unknown;
    overall?: unknown;
  };
  findings: ReportFinding[];
}

function getLevelRank(riskLevel: string) {
  switch ((riskLevel || "").toUpperCase()) {
    case "CRITICAL":
      return 5;
    case "HIGH":
      return 4;
    case "MEDIUM":
      return 3;
    case "LOW":
      return 2;
    case "VERY_LOW":
      return 1;
    default:
      return 0;
  }
}

function buildRiskMatrix(findings: ReportFinding[]) {
  const matrixMap = new Map<string, { likelihood: number; impact: number; count: number }>();
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    veryLow: 0,
  };

  findings.forEach((finding) => {
    const key = `${finding.likelihood}-${finding.impact}`;
    const existing = matrixMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      matrixMap.set(key, {
        likelihood: finding.likelihood,
        impact: finding.impact,
        count: 1,
      });
    }

    const normalized = (finding.riskLevel || "").toUpperCase();
    if (normalized === "CRITICAL") counts.critical += 1;
    else if (normalized === "HIGH") counts.high += 1;
    else if (normalized === "MEDIUM") counts.medium += 1;
    else if (normalized === "LOW") counts.low += 1;
    else if (normalized === "VERY_LOW") counts.veryLow += 1;
  });

  return {
    critical: counts.critical,
    high: counts.high,
    medium: counts.medium,
    low: counts.low,
    veryLow: counts.veryLow,
    matrix: Array.from(matrixMap.values()).sort(
      (a, b) => b.impact - a.impact || b.likelihood - a.likelihood
    ),
  };
}

function formatFindings(findings: ReportFinding[]) {
  return findings
    .sort((a, b) => b.riskScore - a.riskScore || getLevelRank(b.riskLevel) - getLevelRank(a.riskLevel))
    .map((finding, index) =>
      [
        `${index + 1}. [${finding.riskLevel}] ${finding.gap || finding.question}`,
        `   Section: ${finding.section || "N/A"}`,
        `   Score: ${finding.riskScore} (${finding.likelihood}/5 x ${finding.impact}/5)`,
        `   Threat: ${finding.threat || "Not specified"}`,
        `   Mitigation: ${finding.mitigation || "Not specified"}`,
      ].join("\n")
    )
    .join("\n\n");
}

function buildStrategicContent(input: GenerateReportInput, findings: ReportFinding[]) {
  const topRisks = findings
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  return [
    `Strategic Risk Report`,
    ``,
    `Organization: ${input.company}`,
    `Assessment Category: ${input.category}`,
    `Generated: ${input.generatedAt || new Date().toISOString()}`,
    ``,
    `Executive Summary`,
    `This report summarizes the organization's overall cyber risk posture based on the analyzed assessment results.`,
    ``,
    `Key Strategic Risks`,
    formatFindings(topRisks),
    ``,
    `Recommended Executive Actions`,
    `1. Prioritize remediation funding for critical and high risks.`,
    `2. Review governance ownership for repeated control gaps.`,
    `3. Track residual risk acceptance through a formal risk register.`,
    `4. Align treatment plans with compliance and operational priorities.`,
  ].join("\n");
}

function buildTacticalContent(input: GenerateReportInput, findings: ReportFinding[]) {
  const groupedSections = Array.from(
    findings.reduce<Map<string, number>>((acc, finding) => {
      const key = finding.section || "Uncategorized";
      acc.set(key, (acc.get(key) || 0) + 1);
      return acc;
    }, new Map())
  )
    .sort((a, b) => b[1] - a[1])
    .map(([section, count]) => `- ${section}: ${count} findings`)
    .join("\n");

  return [
    `Tactical Risk Report`,
    ``,
    `Organization: ${input.company}`,
    `Assessment Category: ${input.category}`,
    `Generated: ${input.generatedAt || new Date().toISOString()}`,
    ``,
    `Management Summary`,
    `This report focuses on control effectiveness, recurring gaps, and remediation planning priorities.`,
    ``,
    `Findings by Control Area`,
    groupedSections || "- No findings available",
    ``,
    `Priority Findings`,
    formatFindings(findings.slice(0, 10)),
    ``,
    `Recommended Tactical Actions`,
    `1. Assign owners and due dates to all high and critical findings.`,
    `2. Reassess controls with repeated medium-risk exposure.`,
    `3. Link remediation tasks to compliance evidence and follow-up reviews.`,
  ].join("\n");
}

function buildOperationalContent(input: GenerateReportInput, findings: ReportFinding[]) {
  return [
    `Operational Risk Report`,
    ``,
    `Organization: ${input.company}`,
    `Assessment Category: ${input.category}`,
    `Generated: ${input.generatedAt || new Date().toISOString()}`,
    ``,
    `Technical Findings`,
    formatFindings(findings),
    ``,
    `Immediate Operational Actions`,
    `1. Address critical misconfigurations and missing controls first.`,
    `2. Apply remediation recommendations and validate effectiveness.`,
    `3. Re-run assessments after corrective changes are complete.`,
  ].join("\n");
}

export async function generateReport(level: GeneratedReportLevel, input: GenerateReportInput) {
  const sortedFindings = [...input.findings].sort(
    (a, b) => b.riskScore - a.riskScore || getLevelRank(b.riskLevel) - getLevelRank(a.riskLevel)
  );
  const riskMatrix = buildRiskMatrix(sortedFindings);

  const content =
    level === "strategic"
      ? buildStrategicContent(input, sortedFindings)
      : level === "tactical"
      ? buildTacticalContent(input, sortedFindings)
      : buildOperationalContent(input, sortedFindings);

  return {
    content,
    riskMatrix,
    charts: {
      type: "risk-distribution",
      data: {
        critical: riskMatrix.critical,
        high: riskMatrix.high,
        medium: riskMatrix.medium,
        low: riskMatrix.low,
        veryLow: riskMatrix.veryLow,
      },
    },
  };
}

const reportApi = { generateReport };

export default reportApi;
