/**
 * POST /api/mfa/clear
 *
 * Explicitly deletes both MFA cookies (mfa_pending + mfa_verified).
 * Called after a successful signIn() on the MFA verify page, and also
 * on sign-out, so the cookies never linger between sessions.
 */
import { NextResponse } from "next/server";
import { MFA_COOKIE } from "@/app/api/mfa/verify/route";

const MFA_VERIFIED_COOKIE = "mfa_verified";

export async function POST() {
    const res = NextResponse.json({ success: true });

    // Delete both cookies by setting maxAge to 0
    res.cookies.set(MFA_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
    });
    res.cookies.set(MFA_VERIFIED_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
    });

    return res;
}
