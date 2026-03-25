import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import RiskAnalysis from "@/models/RiskAnalysis";
import Report from "@/models/Report";
import { generateReport } from "@/lib/ai";
import { validate, GenerateReportSchema } from "@/lib/validation";

type SessionRole = "Director" | "Division Head" | "Risk Analyst" | "Staff";

const REPORT_ROLES: SessionRole[] = ["Director", "Division Head", "Risk Analyst", "Staff"];

function isAuthorized(role: unknown): role is SessionRole {
  return typeof role === "string" && REPORT_ROLES.includes(role as SessionRole);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const role = session?.user ? (session.user as { role?: unknown }).role : undefined;
    if (!session || !isAuthorized(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const v = validate(GenerateReportSchema, await req.json());
    if (!v.success) return v.response;
    const { analysisId, level } = v.data;

    await dbConnect();

    const analysis = await RiskAnalysis.findById(analysisId).lean();
    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    const existingReport = await Report.findOne({
      analysisId: analysis._id,
      level,
    });

    if (existingReport) {
      return NextResponse.json({
        success: true,
        report: existingReport,
        message: "Report already exists",
      });
    }

    const allFindings = [
      ...(analysis.operational || []),
      ...(analysis.tactical || []),
      ...(analysis.strategic || []),
    ]
      .map((item) => ({
        questionId: item.questionId,
        section: item.section || "",
        level: item.level || "",
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
      }))
      .sort((a, b) => b.riskScore - a.riskScore);

    const reportResult = await generateReport(level, {
      company: analysis.company,
      category: analysis.category,
      generatedAt: new Date().toISOString(),
      summary: analysis.summary,
      findings: allFindings,
    });

    const report = new Report({
      analysisId: analysis._id,
      level,
      content: reportResult.content,
      riskMatrix: reportResult.riskMatrix,
      charts: reportResult.charts,
      exportFormats: ["DOCX", "XLSX"],
      generatedAt: new Date(),
    });

    const savedReport = await report.save();

    return NextResponse.json({
      success: true,
      report: savedReport,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    const message = error instanceof Error ? error.message : "Failed to generate report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
