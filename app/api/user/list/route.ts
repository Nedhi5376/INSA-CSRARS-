import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

// GET /api/user/list — Director only: list all users
export async function GET() {
    const session = await getSession();
    const sessionUser = session?.user as { id: string; role: string } | undefined;

    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (sessionUser.role !== "Director") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();
    const users = await User.find({}).select("-password").lean();

    return NextResponse.json({ success: true, users });
}
