import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import RiskAnalysis from "@/models/RiskAnalysis";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await dbConnect();

    const { id } = params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    const analysis = await RiskAnalysis.findById(id).lean();
    if (!analysis) {
      return NextResponse.json({ success: false, error: "Analysis not found" }, { status: 404 });
    }

    const allAnalyses = [
      ...(analysis.operational || []),
      ...(analysis.tactical || []),
      ...(analysis.strategic || [])
    ];

    const formatted = {
      _id: analysis._id.toString(),
      questionnaireId: analysis.questionnaireId?.toString?.() || null,
      company: analysis.company,
      category: analysis.category,
      date: analysis.createdAt,
      metadata: analysis.metadata,
      analyses: allAnalyses.map((a: any) => ({
        questionId: a.questionId,
        section: a.section,
        level: a.level,
        question: a.question,
        answer: a.answer,
        analysis: a.analysis,
        timestamp: a.timestamp
      })),
      summary: analysis.summary
    };

    return NextResponse.json({ success: true, analysis: formatted });
  } catch (error) {
    console.error("Error fetching analysis by id:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
