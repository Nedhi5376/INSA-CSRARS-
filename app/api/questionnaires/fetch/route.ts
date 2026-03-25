import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Questionnaire from "@/models/Questionnaire";
import RiskAnalysis from "@/models/RiskAnalysis";
import { performRiskAnalysis } from "@/lib/services/riskAnalyzer";
import { sendAdminEmail } from "@/lib/email";
import { newAssessmentEmail } from "@/emails/newAssessmentEmail";
import { notifyAnalysisCompleted, notifyIfCriticalRisks } from "@/lib/notifications";

type IncomingQuestion = {
  id?: number;
  section?: string;
  question?: string;
  answer?: string;
  level?: "operational" | "tactical" | "strategic";
};

type IncomingQuestionnaire = {
  id?: string;
  title?: string;
  company_name?: string;
  filled_by?: string;
  role?: string;
  filled_date?: string;
  questions?: IncomingQuestion[];
};

type NormalizedQuestion = {
  id: number;
  section: string;
  question: string;
  answer: string;
  level: "operational" | "tactical" | "strategic";
};

export async function POST(req: NextRequest) {
  try {
    // Parse the incoming questionnaire data
    const q = (await req.json()) as IncomingQuestionnaire;

    // Validate required fields
    if (
      !q.id ||
      !q.questions ||
      !q.title ||
      !q.company_name ||
      !q.filled_by ||
      !q.role ||
      !q.filled_date
    ) {
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
    const rawQuestions = q.questions || [];
    const hasInvalidQuestion = rawQuestions.some(
      (question) =>
        typeof question.id !== "number" ||
        typeof question.section !== "string" ||
        typeof question.question !== "string" ||
        typeof question.answer !== "string" ||
        (question.level !== "operational" &&
          question.level !== "tactical" &&
          question.level !== "strategic")
    );
    if (hasInvalidQuestion) {
      return NextResponse.json(
        { error: "Invalid questionnaire question structure" },
        { status: 400 }
      );
    }

    const questions: NormalizedQuestion[] = rawQuestions as NormalizedQuestion[];
    const levelCounts = {
      operational: questions.filter((ques) => ques.level === "operational").length,
      tactical: questions.filter((ques) => ques.level === "tactical").length,
      strategic: questions.filter((ques) => ques.level === "strategic").length,
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

    // Email: new assessment received — fire-and-forget
    sendAdminEmail(
      `New Assessment Received — ${saved.company}`,
      newAssessmentEmail({
        company: saved.company,
        filledBy: saved.filledBy,
        role: saved.role,
        category: saved.category,
        questionCount: questions.length,
        filledDate: new Date(saved.filledDate).toLocaleDateString(),
      })
    ).catch((e) => console.error("[email] newAssessment:", e));

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

          // Notify + email: analysis completed and critical risks
          await notifyAnalysisCompleted({
            analysisId: String(riskAnalysis._id),
            company: saved.company,
            category: saved.category,
            summary: analysisResults.summary,
          });
          await notifyIfCriticalRisks({
            analysisId: String(riskAnalysis._id),
            company: saved.company,
            category: saved.category,
            summary: analysisResults.summary,
          });

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
  } catch (error) {
    console.error("Error processing questionnaire:", error);
    const message = error instanceof Error ? error.message : "Failed to process questionnaire";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
