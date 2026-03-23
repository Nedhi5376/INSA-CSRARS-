import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user has permission to view audit logs (Director or Risk Analyst only)
        if (!["Director", "Risk Analyst"].includes(session.user.role || "")) {
            return NextResponse.json(
                { error: "Insufficient permissions to view audit logs" },
                { status: 403 }
            );
        }

        await dbConnect();

        const { searchParams } = new URL(request.url);

        // Query parameters
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const action = searchParams.get('action');
        const entity = searchParams.get('entity');
        const entityId = searchParams.get('entityId');
        const userId = searchParams.get('userId');
        const success = searchParams.get('success');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const sortBy = searchParams.get('sortBy') || 'timestamp';
        const sortOrder = searchParams.get('sortOrder') || 'desc';

        // Build filter object
        const filter: any = {};

        if (action) filter.action = action;
        if (entity) filter.entity = entity;
        if (entityId) filter.entityId = entityId;
        if (userId) filter.userId = userId;
        if (success !== null && success !== undefined) {
            filter.success = success === 'true';
        }

        // Date range filter
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }

        // Build sort object
        const sort: any = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate skip
        const skip = (page - 1) * limit;

        // Execute queries
        const [auditLogs, total] = await Promise.all([
            AuditLog.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .populate('userId', 'name email role')
                .lean(),
            AuditLog.countDocuments(filter)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        return NextResponse.json({
            success: true,
            auditLogs,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: total,
                itemsPerPage: limit,
                hasNextPage,
                hasPrevPage
            }
        });

    } catch (error) {
        console.error("Error fetching audit logs:", error);
        return NextResponse.json(
            { error: "Failed to fetch audit logs" },
            { status: 500 }
        );
    }
}