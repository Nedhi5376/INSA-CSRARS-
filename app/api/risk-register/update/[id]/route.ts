import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
import RiskRegister from "@/models/RiskRegister";
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
            likelihood,
            impact,
            rootCause,
            consequences,
            existingControls,
            treatment,
            riskOwner,
            reviewer,
            status,
            nextReviewDate,
            tags,
            notes
        } = body;

        // Find existing risk
        const existingRisk = await RiskRegister.findById(params.id);
        if (!existingRisk) {
            return NextResponse.json(
                { error: "Risk register entry not found" },
                { status: 404 }
            );
        }

        // Store original state for audit log
        const originalState = existingRisk.toObject();

        // Build update object
        const updateData: any = {
            updatedBy: session.user.id,
            lastReviewDate: new Date()
        };

        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (category !== undefined) updateData.category = category;
        if (likelihood !== undefined) updateData.likelihood = Number(likelihood);
        if (impact !== undefined) updateData.impact = Number(impact);
        if (rootCause !== undefined) updateData.rootCause = rootCause;
        if (consequences !== undefined) updateData.consequences = consequences;
        if (existingControls !== undefined) updateData.existingControls = existingControls;
        if (riskOwner !== undefined) updateData.riskOwner = riskOwner;
        if (reviewer !== undefined) updateData.reviewer = reviewer;
        if (status !== undefined) updateData.status = status;
        if (nextReviewDate !== undefined) updateData.nextReviewDate = new Date(nextReviewDate);
        if (tags !== undefined) updateData.tags = tags;
        if (notes !== undefined) updateData.notes = notes;

        // Handle treatment update
        if (treatment !== undefined) {
            updateData.treatment = {
                strategy: treatment.strategy || existingRisk.treatment.strategy,
                description: treatment.description || existingRisk.treatment.description,
                owner: treatment.owner || existingRisk.treatment.owner,
                targetDate: treatment.targetDate ? new Date(treatment.targetDate) : existingRisk.treatment.targetDate,
                actualDate: treatment.actualDate ? new Date(treatment.actualDate) : existingRisk.treatment.actualDate,
                cost: treatment.cost !== undefined ? treatment.cost : existingRisk.treatment.cost,
                status: treatment.status || existingRisk.treatment.status
            };
        }

        // Update the risk register entry
        const updatedRisk = await RiskRegister.findByIdAndUpdate(
            params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('createdBy updatedBy', 'name email');

        if (!updatedRisk) {
            return NextResponse.json(
                { error: "Failed to update risk register entry" },
                { status: 500 }
            );
        }

        // Determine what changed for audit log
        const changedFields: string[] = [];
        const changes: any = { before: {}, after: {} };

        Object.keys(updateData).forEach(key => {
            if (key !== 'updatedBy' && key !== 'lastReviewDate') {
                const originalValue = originalState[key];
                const newValue = updateData[key];

                if (JSON.stringify(originalValue) !== JSON.stringify(newValue)) {
                    changedFields.push(key);
                    changes.before[key] = originalValue;
                    changes.after[key] = newValue;
                }
            }
        });

        // Log the update action
        await AuditLog.logAction(
            "UPDATE",
            "RiskRegister",
            session.user.id,
            session.user.email!,
            session.user.role || "Unknown",
            request.ip || "unknown",
            `Updated risk register entry: ${updatedRisk.title}`,
            {
                entityId: updatedRisk._id.toString(),
                changes: {
                    before: changes.before,
                    after: changes.after,
                    fields: changedFields
                },
                metadata: {
                    riskId: updatedRisk.riskId,
                    fieldsChanged: changedFields.length
                }
            }
        );

        return NextResponse.json({
            success: true,
            message: "Risk register entry updated successfully",
            risk: updatedRisk,
            changedFields
        });

    } catch (error) {
        console.error("Error updating risk register entry:", error);
        return NextResponse.json(
            { error: "Failed to update risk register entry" },
            { status: 500 }
        );
    }
}