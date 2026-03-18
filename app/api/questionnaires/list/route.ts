import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Questionnaire from "@/models/Questionnaire";

export async function GET() {
  try {
    await dbConnect();

    const questionnaires = await Questionnaire.find()
      .sort({ createdAt: -1 })
      .select('title company filledBy role filledDate status questions')
      .lean();

    const formattedQuestionnaires = questionnaires.map(q => ({
      _id: q._id.toString(),
      title: q.title,
      company: q.company,
      filledBy: q.filledBy,
      role: q.role,
      date: q.filledDate,
      status: q.status || 'pending',
      responseCount: q.questions?.length || 0,
      questions: q.questions || []
    }));

    return NextResponse.json({
      success: true,
      questionnaires: formattedQuestionnaires
    });
  } catch (error) {
    console.error("Error listing questionnaires:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      error: message || "Failed to list questionnaires"
    }, { status: 500 });
  }
}
