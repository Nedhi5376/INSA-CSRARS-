import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Questionnaire from "@/models/Questionnaire";
import RiskAnalysis from "@/models/RiskAnalysis";
import { performRiskAnalysis } from "@/lib/services/riskAnalyzer";

export async function POST(request: Request) {
    try {
        const { analysisId } = await request.json();

        if (!analysisId) {
            return NextResponse.json({
                success: false,
                error: "Analysis ID is required"
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

        // Find existing analysis
        const existingAnalysis = await RiskAnalysis.findById(analysisId);
        if (!existingAnalysis) {
            return NextResponse.json({
                success: false,
                error: "Analysis not found"
            }, { status: 404 });
        }

        // Get the questionnaire
        const questionnaire = await Questionnaire.findById(existingAnalysis.questionnaireId);
        if (!questionnaire) {
            return NextResponse.json({
                success: false,
                error: "Associated questionnaire not found"
            }, { status: 404 });
        }

        if (!questionnaire.questions || questionnaire.questions.length === 0) {
            return NextResponse.json({
                success: false,
                error: "No questions found in questionnaire"
            }, { status: 400 });
        }

        console.log(` Re-analyzing questionnaire: ${existingAnalysis.questionnaireId}`);
        console.log(` Total questions: ${questionnaire.questions.length}`);

        // Delete old analysis
        await RiskAnalysis.findByIdAndDelete(analysisId);

        // Perform fresh analysis
        const analysisResults = await performRiskAnalysis(
            questionnaire.questions,
            apiKey
        );

        // Determine category
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

        // Create new analysis
        const newRiskAnalysis = new RiskAnalysis({
            questionnaireId: questionnaire._id,
            company: questionnaire.company,
            category: categoryToUse,
            metadata: analysisResults.metadata,
            operational: analysisResults.operational,
            tactical: analysisResults.tactical,
            strategic: analysisResults.strategic,
            summary: analysisResults.summary
        });

        await newRiskAnalysis.save();

        console.log(` Re-analysis completed for questionnaire: ${existingAnalysis.questionnaireId}`);

        return NextResponse.json({
            success: true,
            message: "Re-analysis completed successfully",
            analysisId: String(newRiskAnalysis._id),
            summary: analysisResults.summary.overall
        });

    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(" Error during re-analysis:", errMsg);
        return NextResponse.json({
            success: false,
            error: errMsg || "Failed to re-analyze"
        }, { status: 500 });
    }
}
