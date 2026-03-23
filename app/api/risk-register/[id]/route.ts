import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
import RiskRegister from "@/models/RiskRegister";
import AuditLog from "@/models/AuditLog";
import { authOptions } from "@/lib/auth";

// GET single risk register entry
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();

        const risk = await RiskRegister.findById(params.id)
            .populate('createdBy', 'name email role')
            .populate('updatedBy', 'name email role')
            .lean();

        if (!risk) {
            return NextResponse.json(
                { error: "Risk register entry not found" },
                { status: 404 }
            );
        }

        // Log the view action
        await AuditLog.logAction(
            "VIEW",
            "RiskRegister",
            session.user.id,
            session.user.email!,
            session.user.role || "Unknown",
            request.ip || "unknown",
            `Viewed risk register entry: ${risk.title}`,
            {
                entityId: risk._id.toString(),
                metadata: { riskId: risk.riskId }
            }
        );

        return NextResponse.json({
            success: true,
            risk
        });

    } catch (error) {
        console.error("Error fetching risk register entry:", error);
        return NextResponse.json(
            { error: "Failed to fetch risk register entry" },
            { status: 500 }
        );
    }
}

// DELETE risk register entry
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user has permission to delete (only Director or Risk Analyst)
        if (!["Director", "Risk Analyst"].includes(session.user.role || "")) {
            return NextResponse.json(
                { error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        await dbConnect();

        const risk = await RiskRegister.findById(params.id);
        if (!risk) {
            return NextResponse.json(
                { error: "Risk register entry not found" },
                { status: 404 }
            );
        }

        // Store risk info for audit log before deletion
        const riskInfo = {
            riskId: risk.riskId,
            title: risk.title,
            category: risk.category,
            riskLevel: risk.riskLevel
        };

        await RiskRegister.findByIdAndDelete(params.id);

        // Log the deletion
        await AuditLog.logAction(
            "DELETE",
            "RiskRegister",
            session.user.id,
            session.user.email!,
            session.user.role || "Unknown",
            request.ip || "unknown",
            `Deleted risk register entry: ${riskInfo.title}`,
            {
                entityId: params.id,
                metadata: riskInfo
            }
        );

        return NextResponse.json({
            success: true,
            message: "Risk register entry deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting risk register entry:", error);
        return NextResponse.json(
            { error: "Failed to delete risk register entry" },
            { status: 500 }
        );
    }
}