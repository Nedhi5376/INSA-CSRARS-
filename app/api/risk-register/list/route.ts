import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
import RiskRegister from "@/models/RiskRegister";
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
        const status = searchParams.get('status');
        const riskLevel = searchParams.get('riskLevel');
        const riskOwner = searchParams.get('riskOwner');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const search = searchParams.get('search');

        // Build filter object
        const filter: any = {};

        if (category) filter.category = category;
        if (status) filter.status = status;
        if (riskLevel) filter.riskLevel = riskLevel;
        if (riskOwner) filter.riskOwner = { $regex: riskOwner, $options: 'i' };

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { riskId: { $regex: search, $options: 'i' } },
                { rootCause: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort object
        const sort: any = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate skip
        const skip = (page - 1) * limit;

        // Execute queries
        const [risks, total] = await Promise.all([
            RiskRegister.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .populate('createdBy', 'name email')
                .populate('updatedBy', 'name email')
                .lean(),
            RiskRegister.countDocuments(filter)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        return NextResponse.json({
            success: true,
            risks,
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
        console.error("Error fetching risk register:", error);
        return NextResponse.json(
            { error: "Failed to fetch risk register" },
            { status: 500 }
        );
    }
}