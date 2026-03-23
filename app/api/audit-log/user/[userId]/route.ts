import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";
import { authOptions } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Users can only view their own audit logs unless they're Director or Risk Analyst
        const canViewAllLogs = ["Director", "Risk Analyst"].includes(session.user.role || "");
        if (!canViewAllLogs && session.user.id !== params.userId) {
            return NextResponse.json(
                { error: "Insufficient permissions" },
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
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Build filter object
        const filter: any = { userId: params.userId };

        if (action) filter.action = action;
        if (entity) filter.entity = entity;

        // Date range filter
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }

        // Calculate skip
        const skip = (page - 1) * limit;

        // Execute queries
        const [auditLogs, total] = await Promise.all([
            AuditLog.find(filter)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .populate('userId', 'name email role')
                .lean(),
            AuditLog.countDocuments(filter)
        ]);

        // Get activity statistics
        const stats = await AuditLog.aggregate([
            { $match: { userId: params.userId } },
            {
                $group: {
                    _id: null,
                    totalActions: { $sum: 1 },
                    actionBreakdown: {
                        $push: {
                            action: "$action",
                            count: 1
                        }
                    },
                    entityBreakdown: {
                        $push: {
                            entity: "$entity",
                            count: 1
                        }
                    },
                    successRate: {
                        $avg: { $cond: ["$success", 1, 0] }
                    },
                    lastActivity: { $max: "$timestamp" }
                }
            }
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        return NextResponse.json({
            success: true,
            auditLogs,
            statistics: stats[0] || {
                totalActions: 0,
                actionBreakdown: [],
                entityBreakdown: [],
                successRate: 0,
                lastActivity: null
            },
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
        console.error("Error fetching user audit logs:", error);
        return NextResponse.json(
            { error: "Failed to fetch user audit logs" },
            { status: 500 }
        );
    }
}