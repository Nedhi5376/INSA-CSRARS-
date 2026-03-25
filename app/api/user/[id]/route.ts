import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { validate, UpdateUserRoleSchema } from "@/lib/validation";

// GET /api/user/[id] — Director only: fetch any user's profile
export async function GET(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    const sessionUser = session?.user as { id: string; role: string } | undefined;

    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (sessionUser.role !== "Director") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();
    const user = await User.findById(params.id).select("-password").lean();
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
}

// PATCH /api/user/[id] — Director only: update another user's role
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    const sessionUser = session?.user as { id: string; role: string } | undefined;

    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (sessionUser.role !== "Director") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Prevent a Director from changing their own role via this endpoint
    if (sessionUser.id === params.id) {
        return NextResponse.json(
            { error: "Use /api/user/profile to update your own profile" },
            { status: 400 }
        );
    }

    const v = validate(UpdateUserRoleSchema, await req.json());
    if (!v.success) return v.response;
    const { role } = v.data;

    await dbConnect();
    const user = await User.findByIdAndUpdate(
        params.id,
        { role },
        { new: true, select: "-password" }
    ).lean();

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
}
