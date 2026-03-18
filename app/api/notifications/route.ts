import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Questionnaire from "@/models/Questionnaire";
import RiskAnalysis from "@/models/RiskAnalysis";



export async function GET() {
    try {
        await dbConnect();

        // Fetch recent questionnaires 
        const questionnaires = await Questionnaire.find({})
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        // Fetch recent analyses (limit 10 for now)
        const analyses = await RiskAnalysis.find({})
            .sort({ createdAt: -1 })
            .populate("questionnaireId", "title")
            .limit(10)
            .lean();

        const notifications = [];

        // Process Questionnaires
        for (const q of questionnaires) {
            const company = q.company || "Unknown Company";
            const person = q.filledBy || "Unknown Person";
            const role = q.role || "Unknown Role";

            notifications.push({
                id: q._id.toString(),
                type: "questionnaire",
                title: "New Questionnaire Received",
                message: `From ${company} by ${person} (${role})`,
                date: q.createdAt,
                read: false, // In a real app, we'd track this
            });
        }

        // Process Analyses
        for (const a of analyses) {
            const company = a.company || "Unknown Company";
            const category = a.category || "General";

            notifications.push({
                id: a._id.toString(),
                type: "analysis",
                title: "Risk Analysis Completed",
                message: `Analysis done for: ${company} (${category})`,
                date: a.createdAt,
                read: false,
            });
        }

        // Sort combined notifications by date desc
        notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return NextResponse.json(
            { error: "Failed to fetch notifications" },
            { status: 500 }
        );
    }
}
