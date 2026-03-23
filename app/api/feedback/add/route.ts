import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
import Feedback from "@/models/Feedback";
import AuditLog from "@/models/AuditLog";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();

        const body = await request.json();
        const {
            title,
            description,
            type,
            category,
            tags,
            priority,
            pageUrl,
            browserInfo,
            screenResolution,
            relatedEntity,
            attachments,
            isPublic,
            notifySubmitter
        } = body;

        // Validate required fields
        if (!title || !description || !type) {
            return NextResponse.json(
                { error: "Missing required fields: title, description, type" },
                { status: 400 }
            );
        }

        // Create new feedback entry
        const feedback = new Feedback({
            title,
            description,
            type,
            category: category || undefined,
            tags: tags || [],
            priority: priority || "Medium",
            submittedBy: session.user.id,
            pageUrl: pageUrl || undefined,
            browserInfo: browserInfo || request.headers.get('user-agent'),
            screenResolution: screenResolution || undefined,
            relatedEntity: relatedEntity || undefined,
            attachments: attachments || [],
            isPublic: isPublic !== undefined ? isPublic : false,
            notifySubmitter: notifySubmitter !== undefined ? notifySubmitter : true
        });

        const savedFeedback = await feedback.save();

        // Populate the saved feedback for response
        const populatedFeedback = await Feedback.findById(savedFeedback._id)
            .populate('submittedBy', 'name email role')
            .lean();

        // Log the action
        await AuditLog.logAction(
            "CREATE",
            "Feedback",
            session.user.id,
            session.user.email!,
            session.user.role || "Unknown",
            request.ip || "unknown",
            `Submitted new feedback: ${title}`,
            {
                entityId: savedFeedback._id.toString(),
                metadata: {
                    type,
                    category,
                    priority: savedFeedback.priority,
                    isPublic: savedFeedback.isPublic
                }
            }
        );

        return NextResponse.json({
            success: true,
            message: "Feedback submitted successfully",
            feedback: populatedFeedback
        });

    } catch (error) {
        console.error("Error creating feedback:", error);
        return NextResponse.json(
            { error: "Failed to submit feedback" },
            { status: 500 }
        );
    }
}