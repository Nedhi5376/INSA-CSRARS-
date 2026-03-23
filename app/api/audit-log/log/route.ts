import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
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
            action,
            entity,
            entityId,
            description,
            changes,
            metadata,
            success = true,
            errorMessage,
            duration
        } = body;

        // Validate required fields
        if (!action || !entity || !description) {
            return NextResponse.json(
                { error: "Missing required fields: action, entity, description" },
                { status: 400 }
            );
        }

        // Get request information
        const userAgent = request.headers.get('user-agent') || '';
        const ipAddress = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

        // Create audit log entry
        const auditLog = await AuditLog.logAction(
            action,
            entity,
            session.user.id,
            session.user.email!,
            session.user.role || "Unknown",
            ipAddress,
            description,
            {
                entityId,
                userAgent,
                changes,
                metadata,
                success,
                errorMessage,
                duration
            }
        );

        return NextResponse.json({
            success: true,
            message: "Audit log entry created successfully",
            auditLog
        });

    } catch (error) {
        console.error("Error creating audit log entry:", error);
        return NextResponse.json(
            { error: "Failed to create audit log entry" },
            { status: 500 }
        );
    }
}