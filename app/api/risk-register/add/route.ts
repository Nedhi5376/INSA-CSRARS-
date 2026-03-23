import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
import RiskRegister from "@/models/RiskRegister";
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
            likelihood,
            impact,
            rootCause,
            consequences,
            existingControls,
            treatment,
            riskOwner,
            reviewer,
            identifiedDate,
            nextReviewDate,
            sourceType,
            sourceId,
            tags,
            notes
        } = body;

        // Validate required fields
        if (!title || !description || !category || !likelihood || !impact || !rootCause || !treatment || !riskOwner || !reviewer) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Generate unique risk ID
        const count = await RiskRegister.countDocuments();
        const riskId = `RISK-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

        // Create new risk register entry
        const riskRegister = new RiskRegister({
            riskId,
            title,
            description,
            category,
            likelihood: Number(likelihood),
            impact: Number(impact),
            rootCause,
            consequences: consequences || [],
            existingControls: existingControls || [],
            treatment: {
                strategy: treatment.strategy,
                description: treatment.description,
                owner: treatment.owner,
                targetDate: new Date(treatment.targetDate),
                cost: treatment.cost || undefined,
                status: treatment.status || "Not Started"
            },
            riskOwner,
            reviewer,
            identifiedDate: identifiedDate ? new Date(identifiedDate) : new Date(),
            nextReviewDate: new Date(nextReviewDate),
            sourceType: sourceType || "Manual",
            sourceId: sourceId || undefined,
            tags: tags || [],
            notes: notes || [],
            createdBy: session.user.id,
            updatedBy: session.user.id
        });

        const savedRisk = await riskRegister.save();

        // Log the action
        await AuditLog.logAction(
            "CREATE",
            "RiskRegister",
            session.user.id,
            session.user.email!,
            session.user.role || "Unknown",
            request.ip || "unknown",
            `Created new risk register entry: ${title}`,
            {
                entityId: savedRisk._id.toString(),
                metadata: { riskId, category, riskLevel: savedRisk.riskLevel }
            }
        );

        return NextResponse.json({
            success: true,
            message: "Risk register entry created successfully",
            risk: savedRisk
        });

    } catch (error) {
        console.error("Error creating risk register entry:", error);
        return NextResponse.json(
            { error: "Failed to create risk register entry" },
            { status: 500 }
        );
    }
}