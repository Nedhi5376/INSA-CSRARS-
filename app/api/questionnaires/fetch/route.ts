import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Questionnaire from "@/models/Questionnaire";
import RiskAnalysis from "@/models/RiskAnalysis";
import { performRiskAnalysis } from "@/lib/services/riskAnalyzer";

export async function POST(req: NextRequest) {
  try {
    // Parse the incoming questionnaire data
    const q = await req.json();

    // Validate required fields
    if (!q.id || !q.questions) {
      return NextResponse.json(
        { error: "Invalid questionnaire data" },
        { status: 400 }
      );
    }

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    await dbConnect();

    // Check if questionnaire already exists
    const existing = await Questionnaire.findOne({ externalId: q.id });
    if (existing) {
      console.log(`⏭ Questionnaire already exists: ${q.company_name}`);
      return NextResponse.json({
        message: "Questionnaire already exists",
        questionnaire: existing,
      });
    }

    // Determine category based on question levels
    const questions = q.questions || [];
    const levelCounts = {
      operational: questions.filter((ques: any) => ques.level === "operational").length,
      tactical: questions.filter((ques: any) => ques.level === "tactical").length,
      strategic: questions.filter((ques: any) => ques.level === "strategic").length,
    };
    const category = Object.entries(levelCounts).reduce((a, b) => (a[1] > b[1] ? a : b))[0];

    // Create and save new questionnaire
    const newQuestionnaire = new Questionnaire({
      externalId: q.id,
      title: q.title,
      company: q.company_name,
      filledBy: q.filled_by,
      role: q.role,
      filledDate: new Date(q.filled_date),
      category,
      status: "pending",
      questions,
    });

    const saved = await newQuestionnaire.save();
    console.log(`Questionnaire accepted: ${saved.company} (${saved._id})`);

    // Automatically analyze
    if (openRouterApiKey && questions.length > 0) {
      try {
        const existingAnalysis = await RiskAnalysis.findOne({ questionnaireId: saved._id });
        if (!existingAnalysis) {
          const analysisResults = await performRiskAnalysis(questions, openRouterApiKey);

          const riskAnalysis = new RiskAnalysis({
            questionnaireId: saved._id,
            company: saved.company,
            category: category as "operational" | "tactical" | "strategic",
            metadata: analysisResults.metadata,
            operational: analysisResults.operational,
            tactical: analysisResults.tactical,
            strategic: analysisResults.strategic,
            summary: analysisResults.summary,
          });

          await riskAnalysis.save();

          saved.status = "analyzed";
          await saved.save();

          console.log(`Auto-analysis completed for: ${saved.company}`);
        }
      } catch (analysisError) {
        console.error(`Auto-analysis failed for ${saved.company}:`, analysisError);
      }
    }

    return NextResponse.json({
      success: true,
      questionnaire: saved,
      analysisStatus: saved.status,
    });
  } catch (error: any) {
    console.error("Error processing questionnaire:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process questionnaire" },
      { status: 500 }
    );
  }
}
