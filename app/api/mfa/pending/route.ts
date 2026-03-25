/**
 * POST /api/mfa/pending
 * Body: { userId: string }
 *
 * Sets the httpOnly mfa_pending cookie so the /mfa-verify page can
 * validate the session before accepting a TOTP token.
 * This is called by the login page when it receives MFA_REQUIRED.
 */
import { NextRequest, NextResponse } from "next/server";
import { signMfaPendingToken, MFA_COOKIE } from "@/app/api/mfa/verify/route";
import { validate, MfaPendingSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const v = validate(MfaPendingSchema, await req.json());
    if (!v.success) return v.response;
    const { userId } = v.data;

    const token = signMfaPendingToken(userId);

    const res = NextResponse.json({ success: true });
    res.cookies.set(MFA_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 10, // 10 minutes
        path: "/",
    });

    return res;
}
