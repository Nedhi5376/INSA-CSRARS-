import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Questionnaire from "@/models/Questionnaire";
import RiskAnalysis from "@/models/RiskAnalysis";
import { performRiskAnalysis } from "@/lib/services/riskAnalyzer";

export async function POST(request: Request) {
  try {

    const { questionnaireId } = await request.json();

    if (!questionnaireId) {
      return NextResponse.json({
        success: false,
        error: "Questionnaire ID is required"
      }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "OPENROUTER_API_KEY not configured"
      }, { status: 500 });
    }

    await dbConnect();

    const questionnaire = await Questionnaire.findById(questionnaireId);
    if (!questionnaire) {
      return NextResponse.json({
        success: false,
        error: "Questionnaire not found"
      }, { status: 404 });
    }

    const existingAnalysis = await RiskAnalysis.findOne({ questionnaireId });
    if (existingAnalysis) {
      return NextResponse.json({
        success: false,
        error: "This questionnaire has already been analyzed. View results in the Processed Assessments section."
      }, { status: 400 });
    }

    console.log(` Starting analysis for questionnaire: ${questionnaireId}`);
    console.log(` Total questions: ${questionnaire.questions?.length || 0}`);

    // check if questionnaire has a category 
    const inferCategoryFromQuestions = (questions: { level?: string }[] | undefined): 'operational' | 'tactical' | 'strategic' => {
      if (!questions || questions.length === 0) return 'operational';
      const counts: Record<'operational' | 'tactical' | 'strategic', number> = { operational: 0, tactical: 0, strategic: 0 };
      for (const q of questions) {
        const lvl = q?.level ? String(q.level).toLowerCase() : '';
        if (lvl === 'operational' || lvl === 'tactical' || lvl === 'strategic') {
          counts[lvl as 'operational' | 'tactical' | 'strategic']++;
        }
      }
      const sorted = (Object.entries(counts) as [string, number][]).sort((a, b) => b[1] - a[1]);
      return (sorted[0] && (sorted[0][0] as 'operational' | 'tactical' | 'strategic')) || 'operational';
    };

    const categoryToUse = questionnaire.category || inferCategoryFromQuestions(questionnaire.questions);
    if (!questionnaire.category) {
      questionnaire.category = categoryToUse;
    }

    if (!questionnaire.questions || questionnaire.questions.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No questions found in this questionnaire"
      }, { status: 400 });
    }

    const { acquireAnalysisLock, releaseAnalysisLock } = await import('@/lib/services/analysisLock');
    const lock = await acquireAnalysisLock(String(questionnaire._id));
    if (!lock || !lock.acquired) {
      return NextResponse.json({ success: false, error: 'Analysis already in progress for this questionnaire' }, { status: 409 });
    }

    let analysisResults: any;
    try {
      analysisResults = await performRiskAnalysis(
        questionnaire.questions,
        apiKey
      );
    } finally {
      try { await import('@/lib/services/analysisLock').then(m => m.releaseAnalysisLock(String(questionnaire._id))); } catch (e) { }
    }

    const riskAnalysis = new RiskAnalysis({
      questionnaireId: questionnaire._id,
      company: questionnaire.company,
      category: categoryToUse,
      metadata: analysisResults.metadata,
      operational: analysisResults.operational,
      tactical: analysisResults.tactical,
      strategic: analysisResults.strategic,
      summary: analysisResults.summary
    });

    await riskAnalysis.save();

    questionnaire.status = 'analyzed';
    await questionnaire.save();

    console.log(` Analysis completed for questionnaire: ${questionnaireId}`);

    return NextResponse.json({
      success: true,
      message: "Analysis completed successfully",
      analysisId: String(riskAnalysis._id),
      summary: analysisResults.summary.overall
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(" Error processing analysis:", errMsg);
    return NextResponse.json({
      success: false,
      error: errMsg || "Failed to process analysis"
    }, { status: 500 });
  }
}
