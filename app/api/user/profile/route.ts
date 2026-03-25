import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { validate, UpdateProfileSchema } from "@/lib/validation";

// GET /api/user/profile — return the current user's profile
export async function GET() {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById((session.user as { id: string }).id)
        .select("-password")
        .lean();

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
}

// PATCH /api/user/profile — update name and/or password
export async function PATCH(req: NextRequest) {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const v = validate(UpdateProfileSchema, await req.json());
    if (!v.success) return v.response;
    const { name, currentPassword, newPassword } = v.data;

    await dbConnect();
    const user = await User.findById((session.user as { id: string }).id);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (name !== undefined) {
        user.name = name.trim();
    }

    if (newPassword) {
        if (!user.password) {
            return NextResponse.json(
                { error: "Password change is not available for SSO accounts" },
                { status: 400 }
            );
        }
        const valid = await bcrypt.compare(currentPassword!, user.password);
        if (!valid) {
            return NextResponse.json(
                { error: "Current password is incorrect" },
                { status: 400 }
            );
        }
        user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    return NextResponse.json({
        success: true,
        user: {
            id: String(user._id),
            email: user.email,
            name: user.name,
            role: user.role,
            ssoProvider: user.ssoProvider,
        },
    });
}
