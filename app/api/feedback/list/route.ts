import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
import Feedback from "@/models/Feedback";
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
        const type = searchParams.get('type');
        const status = searchParams.get('status');
        const priority = searchParams.get('priority');
        const category = searchParams.get('category');
        const assignedTo = searchParams.get('assignedTo');
        const submittedBy = searchParams.get('submittedBy');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const search = searchParams.get('search');
        const myFeedback = searchParams.get('myFeedback') === 'true';

        // Build filter object
        const filter: any = {};

        // Role-based filtering
        const isAdmin = ["Director", "Risk Analyst"].includes(session.user.role || "");

        if (myFeedback) {
            // User wants to see only their own feedback
            filter.submittedBy = session.user.id;
        } else if (!isAdmin) {
            // Non-admin users can only see public feedback or their own
            filter.$or = [
                { isPublic: true },
                { submittedBy: session.user.id }
            ];
        }
        // Admin users can see all feedback (no additional filter needed)

        if (type) filter.type = type;
        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (category) filter.category = category;
        if (assignedTo) filter.assignedTo = assignedTo;
        if (submittedBy && isAdmin) filter.submittedBy = submittedBy;

        if (search) {
            filter.$and = filter.$and || [];
            filter.$and.push({
                $or: [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { category: { $regex: search, $options: 'i' } },
                    { tags: { $in: [new RegExp(search, 'i')] } }
                ]
            });
        }

        // Build sort object
        const sort: any = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate skip
        const skip = (page - 1) * limit;

        // Execute queries
        const [feedbacks, total] = await Promise.all([
            Feedback.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .populate('submittedBy', 'name email role')
                .populate('assignedTo', 'name email role')
                .populate('responses.respondedBy', 'name email role')
                .lean(),
            Feedback.countDocuments(filter)
        ]);

        // Get feedback statistics (only for admins)
        let statistics = null;
        if (isAdmin) {
            const stats = await Feedback.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        byStatus: {
                            $push: {
                                k: "$status",
                                v: 1
                            }
                        },
                        byType: {
                            $push: {
                                k: "$type",
                                v: 1
                            }
                        },
                        byPriority: {
                            $push: {
                                k: "$priority",
                                v: 1
                            }
                        },
                        avgResponseTime: {
                            $avg: {
                                $cond: [
                                    { $gt: [{ $size: "$responses" }, 0] },
                                    {
                                        $subtract: [
                                            { $arrayElemAt: ["$responses.respondedAt", 0] },
                                            "$createdAt"
                                        ]
                                    },
                                    null
                                ]
                            }
                        }
                    }
                }
            ]);

            statistics = stats[0] || {
                total: 0,
                byStatus: [],
                byType: [],
                byPriority: [],
                avgResponseTime: null
            };
        }

        // Calculate pagination info
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        return NextResponse.json({
            success: true,
            feedbacks,
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
        console.error("Error fetching feedback:", error);
        return NextResponse.json(
            { error: "Failed to fetch feedback" },
            { status: 500 }
        );
    }
}