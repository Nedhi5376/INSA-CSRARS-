import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
import Incident from "@/models/Incident";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();

        const { searchParams } = new URL(request.url);

        // Query parameters
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const category = searchParams.get('category');
        const severity = searchParams.get('severity');
        const status = searchParams.get('status');
        const assignedTo = searchParams.get('assignedTo');
        const reportedBy = searchParams.get('reportedBy');
        const confidentialityLevel = searchParams.get('confidentialityLevel');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const search = searchParams.get('search');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Build filter object
        const filter: any = {};

        // Role-based filtering for confidentiality
        const userRole = session.user.role || "";
        const isHighPrivilege = ["Director", "Risk Analyst"].includes(userRole);

        if (!isHighPrivilege) {
            // Non-privileged users can only see Public and Internal incidents
            filter.confidentialityLevel = { $in: ["Public", "Internal"] };
        }
        // High privilege users can see all incidents

        if (category) filter.category = category;
        if (severity) filter.severity = severity;
        if (status) filter.status = status;
        if (assignedTo) filter.assignedTo = assignedTo;
        if (reportedBy) filter.reportedBy = reportedBy;
        if (confidentialityLevel && isHighPrivilege) {
            filter.confidentialityLevel = confidentialityLevel;
        }

        // Date range filter
        if (startDate || endDate) {
            filter.detectedAt = {};
            if (startDate) filter.detectedAt.$gte = new Date(startDate);
            if (endDate) filter.detectedAt.$lte = new Date(endDate);
        }

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { incidentId: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        // Build sort object
        const sort: any = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate skip
        const skip = (page - 1) * limit;

        // Execute queries
        const [incidents, total] = await Promise.all([
            Incident.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .populate('reportedBy assignedTo incidentManager', 'name email role')
                .populate('responseTeam', 'name email')
                .populate('relatedRisks', 'riskId title riskLevel')
                .lean(),
            Incident.countDocuments(filter)
        ]);

        // Get incident statistics (for privileged users)
        let statistics = null;
        if (isHighPrivilege) {
            const stats = await Incident.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        bySeverity: {
                            $push: {
                                k: "$severity",
                                v: 1
                            }
                        },
                        byStatus: {
                            $push: {
                                k: "$status",
                                v: 1
                            }
                        },
                        byCategory: {
                            $push: {
                                k: "$category",
                                v: 1
                            }
                        },
                        avgResolutionTime: {
                            $avg: {
                                $cond: [
                                    { $and: ["$resolvedAt", "$detectedAt"] },
                                    { $subtract: ["$resolvedAt", "$detectedAt"] },
                                    null
                                ]
                            }
                        },
                        openIncidents: {
                            $sum: {
                                $cond: [
                                    { $in: ["$status", ["Open", "Investigating", "Contained"]] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);

            statistics = stats[0] || {
                total: 0,
                bySeverity: [],
                byStatus: [],
                byCategory: [],
                avgResolutionTime: null,
                openIncidents: 0
            };
        }

        // Calculate pagination info
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        return NextResponse.json({
            success: true,
            incidents,
            statistics,
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
        console.error("Error fetching incidents:", error);
        return NextResponse.json(
            { error: "Failed to fetch incidents" },
            { status: 500 }
        );
    }
}