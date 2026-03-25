import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import AppNotification from "@/models/AppNotification";

// GET /api/notifications — return the 50 most recent notifications with real read state
export async function GET() {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();

        const notifications = await AppNotification.find({})
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        return NextResponse.json(
            notifications.map((n) => ({
                id: String(n._id),
                type: n.type,
                title: n.title,
                message: n.message,
                meta: n.meta,
                date: n.createdAt,
                read: n.read,
            }))
        );
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return NextResponse.json(
            { error: "Failed to fetch notifications" },
            { status: 500 }
        );
    }
}
