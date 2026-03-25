import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertInchesToTwip,
} from "docx";
import dbConnect from "@/lib/mongodb";
import RiskAnalysis from "@/models/RiskAnalysis";

type StoredAnalysisItem = {
  questionId?: number;
  level?: string;
  section?: string;
  question?: string;
  answer?: string;
  analysis?: {
    likelihood?: number;
    impact?: number;
    riskScore?: number;
    riskLevel?: string;
    gap?: string;
    threat?: string;
    mitigation?: string;
    impactLabel?: string;
    impactDescription?: string;
  };
};

type AssessmentFinding = {
  questionId: number;
  level: string;
  section: string;
  question: string;
  answer: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  riskLevel: string;
  gap: string;
  threat: string;
  mitigation: string;
  impactLabel: string;
  impactDescription: string;
  category: string;
};

type ParagraphOptions = {
  bold?: boolean;
  italics?: boolean;
  size?: number;
  color?: string;
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  spacing?: { before?: number; after?: number };
  style?: string;
};

const textParagraph = (text: string, options: ParagraphOptions = {}) =>
  new Paragraph({
    alignment: options.alignment,
    spacing: options.spacing,
    style: options.style,
    children: [
      new TextRun({
        text,
        bold: options.bold,
        italics: options.italics,
        size: options.size,
        color: options.color,
      }),
    ],
  });

const createRiskMatrixTable = (findings: AssessmentFinding[]) => {
  const headerCells = [
    "Security Gap",
    "Category",
    "Threat",
    "Likelihood",
    "Impact",
    "Risk Level",
  ].map(
    (label) =>
      new TableCell({
        children: [textParagraph(label, { bold: true })],
        shading: { fill: "1F2937" },
        verticalAlign: VerticalAlign.CENTER,
      })
  );

  const rows = [
    new TableRow({
      children: headerCells,
      height: { value: convertInchesToTwip(0.3), rule: "atLeast" },
    }),
    ...findings.map(
      (finding) =>
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph(finding.gap)],
              verticalAlign: VerticalAlign.CENTER,
            }),
            new TableCell({
              children: [new Paragraph(finding.category)],
              verticalAlign: VerticalAlign.CENTER,
            }),
            new TableCell({
              children: [new Paragraph(finding.threat)],
              verticalAlign: VerticalAlign.CENTER,
            }),
            new TableCell({
              children: [new Paragraph(`${finding.likelihood}/5`)],
              verticalAlign: VerticalAlign.CENTER,
            }),
            new TableCell({
              children: [new Paragraph(`${finding.impact}/5`)],
              verticalAlign: VerticalAlign.CENTER,
            }),
            new TableCell({
              children: [new Paragraph(finding.riskLevel)],
              verticalAlign: VerticalAlign.CENTER,
            }),
          ],
          height: { value: convertInchesToTwip(0.4), rule: "atLeast" },
        })
    ),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
    },
  });
};

export async function generateDocxReport(analysisId: string): Promise<Buffer> {
  await dbConnect();

  const analysis = await RiskAnalysis.findById(analysisId).lean();
  if (!analysis) {
    throw new Error("Analysis not found");
  }

  const storedFindings = [
    ...(analysis.operational || []),
    ...(analysis.tactical || []),
    ...(analysis.strategic || []),
  ] as StoredAnalysisItem[];

  const findings: AssessmentFinding[] = storedFindings.map((item) => ({
    questionId: item.questionId || 0,
    level: item.level || "",
    section: item.section || "",
    question: item.question || "",
    answer: item.answer || "",
    likelihood: item.analysis?.likelihood || 0,
    impact: item.analysis?.impact || 0,
    riskScore: item.analysis?.riskScore || 0,
    riskLevel: item.analysis?.riskLevel || "UNKNOWN",
    gap: item.analysis?.gap || "",
    threat: item.analysis?.threat || "",
    mitigation: item.analysis?.mitigation || "",
    impactLabel: item.analysis?.impactLabel || "",
    impactDescription: item.analysis?.impactDescription || "",
    category: analysis.category,
  }));

  const criticalCount = findings.filter((item) => item.riskLevel === "CRITICAL").length;
  const highCount = findings.filter((item) => item.riskLevel === "HIGH").length;
  const mediumCount = findings.filter((item) => item.riskLevel === "MEDIUM").length;
  const lowCount = findings.filter((item) => item.riskLevel === "LOW").length;
  const uniqueGaps = Array.from(new Set(findings.map((item) => item.gap).filter(Boolean)));

  const sections = [
    textParagraph("RISK ASSESSMENT REPORT", {
      size: 32,
      bold: true,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    textParagraph(analysis.company, {
      size: 24,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    textParagraph(`Generated: ${new Date(String(analysis.createdAt)).toLocaleDateString()}`, {
      size: 14,
      color: "6B7280",
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    textParagraph("1. Executive Summary", {
      size: 20,
      bold: true,
      spacing: { before: 100, after: 100 },
    }),
    textParagraph(
      `This report presents a cyber security risk assessment for ${analysis.company}. The assessment evaluated ${findings.length} items across operational, tactical, and strategic levels.`,
      { spacing: { after: 200 } }
    ),
    textParagraph("2. Assessment Overview", {
      size: 20,
      bold: true,
      spacing: { before: 100, after: 100 },
    }),
    textParagraph(`Company: ${analysis.company}`, { spacing: { after: 50 } }),
    textParagraph(`Category: ${analysis.category}`, { spacing: { after: 50 } }),
    textParagraph(`Assessment Date: ${new Date(String(analysis.createdAt)).toLocaleDateString()}`, {
      spacing: { after: 200 },
    }),
    textParagraph("3. Key Security Gaps", {
      size: 20,
      bold: true,
      spacing: { before: 100, after: 100 },
    }),
    ...uniqueGaps.map((gap) =>
      textParagraph(gap, {
        style: "List Bullet",
        spacing: { after: 50 },
      })
    ),
    textParagraph("", { spacing: { after: 150 } }),
    textParagraph("4. Risk Analysis Matrix", {
      size: 20,
      bold: true,
      spacing: { before: 100, after: 100 },
    }),
    createRiskMatrixTable(findings),
    textParagraph("", { spacing: { after: 150 } }),
    textParagraph("5. Risk Summary", {
      size: 20,
      bold: true,
      spacing: { before: 100, after: 100 },
    }),
    textParagraph(`Critical Risks: ${criticalCount}`, {
      bold: true,
      color: "DC2626",
      spacing: { after: 50 },
    }),
    textParagraph(`High Risks: ${highCount}`, {
      bold: true,
      color: "EA580C",
      spacing: { after: 50 },
    }),
    textParagraph(`Medium Risks: ${mediumCount}`, {
      bold: true,
      color: "EAB308",
      spacing: { after: 50 },
    }),
    textParagraph(`Low Risks: ${lowCount}`, {
      bold: true,
      color: "16A34A",
      spacing: { after: 150 },
    }),
    textParagraph("6. Priority Mitigations", {
      size: 20,
      bold: true,
      spacing: { before: 100, after: 100 },
    }),
    ...findings
      .filter((item) => item.riskLevel === "CRITICAL" || item.riskLevel === "HIGH")
      .slice(0, 10)
      .flatMap((item, index) => [
        textParagraph(`${index + 1}. ${item.gap || item.question}`, {
          bold: true,
          spacing: { after: 40 },
        }),
        textParagraph(`Mitigation: ${item.mitigation || "Not specified"}`, {
          spacing: { after: 80 },
        }),
      ]),
    textParagraph("7. Conclusion", {
      size: 20,
      bold: true,
      spacing: { before: 100, after: 100 },
    }),
    textParagraph(
      "Immediate action is recommended for critical and high-risk findings, followed by phased treatment of medium and low-risk items.",
      { spacing: { after: 120 } }
    ),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: sections,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
