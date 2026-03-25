import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import AppNotification from "@/models/AppNotification";

// PATCH /api/notifications/read-all — mark every unread notification as read
export async function PATCH() {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    await AppNotification.updateMany({ read: false }, { $set: { read: true } });

    return NextResponse.json({ success: true });
}
