import ExcelJS from "exceljs";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import RiskAnalysis from "@/models/RiskAnalysis";

type StoredAnalysisItem = {
  questionId?: number;
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
    likelihoodLabel?: string;
    impactDescription?: string;
  };
};

type StoredRiskAnalysis = {
  company?: string;
  category?: string;
  createdAt?: Date | string;
  operational?: StoredAnalysisItem[];
  tactical?: StoredAnalysisItem[];
  strategic?: StoredAnalysisItem[];
};

type FlatAnalysisRow = {
  company: string;
  category: string;
  sourceLevel: string;
  questionId: number;
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
  likelihoodLabel: string;
  impactDescription: string;
  analyzedAt: Date | string;
};

export class ExcelReportService {
  static async generateBatchReport(batchId: string): Promise<Buffer> {
    await dbConnect();

    const analyses = await this.findAnalyses(batchId);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Risk Analysis");

    worksheet.columns = [
      { header: "Company", key: "company", width: 24 },
      { header: "Category", key: "category", width: 18 },
      { header: "Assessment Level", key: "sourceLevel", width: 18 },
      { header: "Question ID", key: "questionId", width: 12 },
      { header: "Section", key: "section", width: 24 },
      { header: "Question", key: "question", width: 48 },
      { header: "Answer", key: "answer", width: 24 },
      { header: "Likelihood", key: "likelihood", width: 12 },
      { header: "Impact", key: "impact", width: 12 },
      { header: "Risk Score", key: "riskScore", width: 12 },
      { header: "Risk Level", key: "riskLevel", width: 14 },
      { header: "Gap", key: "gap", width: 28 },
      { header: "Threat", key: "threat", width: 28 },
      { header: "Mitigation", key: "mitigation", width: 32 },
      { header: "Impact Label", key: "impactLabel", width: 16 },
      { header: "Likelihood Label", key: "likelihoodLabel", width: 16 },
      { header: "Impact Description", key: "impactDescription", width: 36 },
      { header: "Analyzed At", key: "analyzedAt", width: 20 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E78" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    const rows = analyses.flatMap((analysis) => this.flattenAnalysis(analysis));
    rows.forEach((row) => worksheet.addRow(row));

    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = {
      from: "A1",
      to: "R1",
    };

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD9E2F3" } },
          left: { style: "thin", color: { argb: "FFD9E2F3" } },
          bottom: { style: "thin", color: { argb: "FFD9E2F3" } },
          right: { style: "thin", color: { argb: "FFD9E2F3" } },
        };
        if (rowNumber > 1) {
          cell.alignment = { vertical: "top", wrapText: true };
        }
      });
    });

    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 24 },
      { header: "Value", key: "value", width: 18 },
    ];
    summarySheet.getRow(1).font = { bold: true };

    const riskCounts = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.riskLevel] = (acc[row.riskLevel] || 0) + 1;
      return acc;
    }, {});

    summarySheet.addRows([
      { metric: "Batch ID", value: batchId },
      { metric: "Matched Analyses", value: analyses.length },
      { metric: "Flattened Findings", value: rows.length },
      { metric: "Critical", value: riskCounts.CRITICAL || 0 },
      { metric: "High", value: riskCounts.HIGH || 0 },
      { metric: "Medium", value: riskCounts.MEDIUM || 0 },
      { metric: "Low", value: riskCounts.LOW || 0 },
      { metric: "Very Low", value: riskCounts.VERY_LOW || 0 },
    ]);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private static async findAnalyses(batchId: string): Promise<StoredRiskAnalysis[]> {
    if (mongoose.Types.ObjectId.isValid(batchId)) {
      const byAnalysisId = await RiskAnalysis.find({ _id: batchId }).lean();
      if (byAnalysisId.length > 0) {
        return byAnalysisId;
      }

      const byQuestionnaireId = await RiskAnalysis.find({ questionnaireId: batchId }).lean();
      if (byQuestionnaireId.length > 0) {
        return byQuestionnaireId;
      }
    }

    throw new Error("No analysis records found for the provided batchId");
  }

  private static flattenAnalysis(analysis: StoredRiskAnalysis): FlatAnalysisRow[] {
    const groups = [
      ...(analysis.operational || []).map((item) => ({ sourceLevel: "operational", item })),
      ...(analysis.tactical || []).map((item) => ({ sourceLevel: "tactical", item })),
      ...(analysis.strategic || []).map((item) => ({ sourceLevel: "strategic", item })),
    ];

    return groups.map(({ sourceLevel, item }) => ({
      company: analysis.company || "",
      category: analysis.category || "",
      sourceLevel,
      questionId: item.questionId || 0,
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
      likelihoodLabel: item.analysis?.likelihoodLabel || "",
      impactDescription: item.analysis?.impactDescription || "",
      analyzedAt: analysis.createdAt || new Date().toISOString(),
    }));
  }
}
