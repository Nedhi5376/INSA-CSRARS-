import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
import Incident from "@/models/Incident";
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
            category,
            severity,
            detectedAt,
            impact,
            assignedTo,
            incidentManager,
            responseTeam,
            relatedRisks,
            relatedQuestionnaires,
            stakeholdersNotified,
            externalReportingRequired,
            regulatoryNotificationRequired,
            tags,
            confidentialityLevel
        } = body;

        // Validate required fields
        if (!title || !description || !category || !severity || !impact) {
            return NextResponse.json(
                { error: "Missing required fields: title, description, category, severity, impact" },
                { status: 400 }
            );
        }

        // Generate unique incident ID
        const count = await Incident.countDocuments();
        const incidentId = `INC-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

        // Create initial timeline entry
        const initialTimeline = [{
            timestamp: new Date(),
            event: "Incident Reported",
            description: "Incident was reported and logged in the system",
            recordedBy: session.user.id
        }];

        // Create new incident
        const incident = new Incident({
            incidentId,
            title,
            description,
            category,
            severity,
            detectedAt: detectedAt ? new Date(detectedAt) : new Date(),
            reportedAt: new Date(),
            reportedBy: session.user.id,
            assignedTo: assignedTo || undefined,
            incidentManager: incidentManager || undefined,
            responseTeam: responseTeam || [],
            impact: {
                businessImpact: impact.businessImpact,
                financialImpact: impact.financialImpact || undefined,
                affectedSystems: impact.affectedSystems || [],
                affectedUsers: impact.affectedUsers || undefined,
                dataCompromised: impact.dataCompromised || false,
                regulatoryImplications: impact.regulatoryImplications || undefined
            },
            response: {
                immediateActions: [],
                containmentActions: [],
                investigationFindings: [],
                lessonsLearned: [],
                preventiveActions: []
            },
            timeline: initialTimeline,
            relatedRisks: relatedRisks || [],
            relatedQuestionnaires: relatedQuestionnaires || [],
            stakeholdersNotified: stakeholdersNotified || false,
            externalReportingRequired: externalReportingRequired || false,
            regulatoryNotificationRequired: regulatoryNotificationRequired || false,
            attachments: [],
            postIncidentReviewCompleted: false,
            tags: tags || [],
            confidentialityLevel: confidentialityLevel || "Internal"
        });

        const savedIncident = await incident.save();

        // Populate the saved incident for response
        const populatedIncident = await Incident.findById(savedIncident._id)
            .populate('reportedBy assignedTo incidentManager', 'name email role')
            .populate('responseTeam', 'name email role')
            .lean();

        // Log the action
        await AuditLog.logAction(
            "CREATE",
            "Incident",
            session.user.id,
            session.user.email!,
            session.user.role || "Unknown",
            request.ip || "unknown",
            `Created new incident: ${title}`,
            {
                entityId: savedIncident._id.toString(),
                metadata: {
                    incidentId,
                    category,
                    severity,
                    confidentialityLevel: savedIncident.confidentialityLevel
                }
            }
        );

        return NextResponse.json({
            success: true,
            message: "Incident created successfully",
            incident: populatedIncident
        });

    } catch (error) {
        console.error("Error creating incident:", error);
        return NextResponse.json(
            { error: "Failed to create incident" },
            { status: 500 }
        );
    }
}