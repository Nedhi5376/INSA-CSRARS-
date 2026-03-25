import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import AppNotification from "@/models/AppNotification";

// PATCH /api/notifications/[id] — mark a single notification as read
export async function PATCH(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const doc = await AppNotification.findByIdAndUpdate(
        params.id,
        { $set: { read: true } },
        { new: true }
    ).lean();

    if (!doc) {
        return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
