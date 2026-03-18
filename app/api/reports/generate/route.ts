import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import RiskAnalysis from "@/models/RiskAnalysis";
import Report from "@/models/Report";
import { generateReport } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { analysisId, level } = await req.json();

    if (!analysisId || !level) {
      return NextResponse.json(
        { error: "Analysis ID and level are required" },
        { status: 400 }
      );
    }

    if (!["strategic", "tactical", "operational"].includes(level)) {
      return NextResponse.json(
        { error: "Invalid report level" },
        { status: 400 }
      );
    }

    await dbConnect();

    const analysis = await RiskAnalysis.findById(analysisId);
    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    // Check if report already exists for this level
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

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Prepare analysis data for report generation
    const analysisData = {
      vulnerabilities: analysis.vulnerabilities,
      riskScore: analysis.riskScore,
      category: analysis.category,
      inherentRisk: analysis.inherentRisk,
      residualRisk: analysis.residualRisk,
      aiInsights: analysis.aiInsights,
    };

    // Generate report using AI
    const reportResult = await generateReport(level, analysisData);

    // Save report to MongoDB
    const report = new Report({
      analysisId: analysis._id,
      level,
      content: reportResult.content,
      riskMatrix: reportResult.riskMatrix,
      charts: reportResult.charts,
      exportFormats: ["PDF", "DOCX"],
      generatedAt: new Date(),
    });

    const savedReport = await report.save();

    return NextResponse.json({
      success: true,
      report: savedReport,
    });
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}

