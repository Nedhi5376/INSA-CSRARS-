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

    // Role-based level validation
    const ROLE_PERMISSIONS: Record<string, string[]> = {
      "Risk Analyst": ["strategic", "tactical", "operational", "human_awareness"],
      "Director": ["strategic"],
      "Division Head": ["tactical"],
      "Staff": ["operational"],
    };

    const userRole = session.user?.role || "Staff";
    const allowedLevels = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] || ["operational"];

    if (!allowedLevels.includes(level)) {
      return NextResponse.json(
        { error: `Forbidden: Your role (${userRole}) is not authorized to generate ${level} reports.` },
        { status: 403 }
      );
    }

    if (!["strategic", "tactical", "operational", "human_awareness"].includes(level)) {
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
    const resultsKey = level === 'human_awareness' ? 'humanAwareness' : level;
    const currentSummary = (analysis.summary as any)?.[resultsKey] || {};
    
    const analysisData = {
      level,
      company: analysis.company,
      category: (analysis as any).category,
      summary: currentSummary,
      data: (analysis as any)[resultsKey] || [],
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

