import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
import Incident from "@/models/Incident";
import AuditLog from "@/models/AuditLog";
import { authOptions } from "@/lib/auth";

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
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
            status,
            assignedTo,
            incidentManager,
            responseTeam,
            impact,
            response,
            stakeholdersNotified,
            externalReportingRequired,
            regulatoryNotificationRequired,
            postIncidentReviewCompleted,
            postIncidentReviewDate,
            tags,
            confidentialityLevel,
            timelineEntry // For adding new timeline entries
        } = body;

        // Find existing incident
        const existingIncident = await Incident.findById(params.id);
        if (!existingIncident) {
            return NextResponse.json(
                { error: "Incident not found" },
                { status: 404 }
            );
        }

        // Check permissions - users can only update incidents they're involved with
        const userRole = session.user.role || "";
        const isHighPrivilege = ["Director", "Risk Analyst"].includes(userRole);
        const isInvolved =
            existingIncident.reportedBy.toString() === session.user.id ||
            existingIncident.assignedTo?.toString() === session.user.id ||
            existingIncident.incidentManager?.toString() === session.user.id ||
            existingIncident.responseTeam.some(member => member.toString() === session.user.id);

        if (!isHighPrivilege && !isInvolved) {
            return NextResponse.json(
                { error: "Insufficient permissions to update this incident" },
                { status: 403 }
            );
        }

        // Store original state for audit log
        const originalState = existingIncident.toObject();

        // Build update object
        const updateData: any = {};
        const changedFields: string[] = [];

        if (title !== undefined && title !== existingIncident.title) {
            updateData.title = title;
            changedFields.push('title');
        }
        if (description !== undefined && description !== existingIncident.description) {
            updateData.description = description;
            changedFields.push('description');
        }
        if (category !== undefined && category !== existingIncident.category) {
            updateData.category = category;
            changedFields.push('category');
        }
        if (severity !== undefined && severity !== existingIncident.severity) {
            updateData.severity = severity;
            changedFields.push('severity');
        }
        if (status !== undefined && status !== existingIncident.status) {
            updateData.status = status;
            changedFields.push('status');

            // Update status-specific timestamps
            const now = new Date();
            switch (status) {
                case 'Investigating':
                    if (!existingIncident.acknowledgedAt) {
                        updateData.acknowledgedAt = now;
                    }
                    break;
                case 'Contained':
                    if (!existingIncident.containedAt) {
                        updateData.containedAt = now;
                    }
                    break;
                case 'Resolved':
                    if (!existingIncident.resolvedAt) {
                        updateData.resolvedAt = now;
                    }
                    break;
                case 'Closed':
                    if (!existingIncident.closedAt) {
                        updateData.closedAt = now;
                    }
                    break;
            }
        }

        if (assignedTo !== undefined) {
            updateData.assignedTo = assignedTo;
            changedFields.push('assignedTo');
        }
        if (incidentManager !== undefined) {
            updateData.incidentManager = incidentManager;
            changedFields.push('incidentManager');
        }
        if (responseTeam !== undefined) {
            updateData.responseTeam = responseTeam;
            changedFields.push('responseTeam');
        }
        if (impact !== undefined) {
            updateData.impact = impact;
            changedFields.push('impact');
        }
        if (response !== undefined) {
            updateData.response = response;
            changedFields.push('response');
        }
        if (stakeholdersNotified !== undefined) {
            updateData.stakeholdersNotified = stakeholdersNotified;
            changedFields.push('stakeholdersNotified');
        }
        if (externalReportingRequired !== undefined) {
            updateData.externalReportingRequired = externalReportingRequired;
            changedFields.push('externalReportingRequired');
        }
        if (regulatoryNotificationRequired !== undefined) {
            updateData.regulatoryNotificationRequired = regulatoryNotificationRequired;
            changedFields.push('regulatoryNotificationRequired');
        }
        if (postIncidentReviewCompleted !== undefined) {
            updateData.postIncidentReviewCompleted = postIncidentReviewCompleted;
            changedFields.push('postIncidentReviewCompleted');
        }
        if (postIncidentReviewDate !== undefined) {
            updateData.postIncidentReviewDate = new Date(postIncidentReviewDate);
            changedFields.push('postIncidentReviewDate');
        }
        if (tags !== undefined) {
            updateData.tags = tags;
            changedFields.push('tags');
        }
        if (confidentialityLevel !== undefined && isHighPrivilege) {
            updateData.confidentialityLevel = confidentialityLevel;
            changedFields.push('confidentialityLevel');
        }

        // Handle timeline entry addition
        if (timelineEntry) {
            const newTimelineEntry = {
                timestamp: new Date(),
                event: timelineEntry.event,
                description: timelineEntry.description,
                recordedBy: session.user.id
            };
            updateData.$push = { timeline: newTimelineEntry };
            changedFields.push('timeline');
        }

        // Update the incident
        const updatedIncident = await Incident.findByIdAndUpdate(
            params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('reportedBy assignedTo incidentManager', 'name email role')
            .populate('responseTeam', 'name email role')
            .populate('timeline.recordedBy', 'name email');

        if (!updatedIncident) {
            return NextResponse.json(
                { error: "Failed to update incident" },
                { status: 500 }
            );
        }

        // Prepare changes for audit log
        const changes: any = { before: {}, after: {} };
        changedFields.forEach(field => {
            if (field !== 'timeline') { // Timeline is handled separately
                changes.before[field] = originalState[field];
                changes.after[field] = updateData[field];
            }
        });

        // Log the update action
        await AuditLog.logAction(
            "UPDATE",
            "Incident",
            session.user.id,
            session.user.email!,
            session.user.role || "Unknown",
            request.ip || "unknown",
            `Updated incident: ${updatedIncident.title}`,
            {
                entityId: updatedIncident._id.toString(),
                changes: {
                    before: changes.before,
                    after: changes.after,
                    fields: changedFields
                },
                metadata: {
                    incidentId: updatedIncident.incidentId,
                    fieldsChanged: changedFields.length,
                    timelineEntryAdded: !!timelineEntry
                }
            }
        );

        return NextResponse.json({
            success: true,
            message: "Incident updated successfully",
            incident: updatedIncident,
            changedFields
        });

    } catch (error) {
        console.error("Error updating incident:", error);
        return NextResponse.json(
            { error: "Failed to update incident" },
            { status: 500 }
        );
    }
}