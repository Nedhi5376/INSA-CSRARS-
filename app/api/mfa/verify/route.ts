/**
 * POST /api/mfa/verify
 * Body: { userId: string, token: string }
 *
 * Validates the TOTP token (or backup code) for a pending-MFA user.
 * On success, sets a short-lived signed cookie `mfa_verified` so the
 * credentials authorize() can confirm MFA was completed.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { verifyTotp, findMatchingBackupCode } from "@/lib/mfa";
import { validate, MfaVerifySchema } from "@/lib/validation";
import { sendEmail } from "@/lib/email";
import { mfaEventEmail } from "@/emails/mfaEventEmail";

export const MFA_COOKIE = "mfa_pending";
const MFA_VERIFIED_COOKIE = "mfa_verified";

function getHmacSecret(): Buffer {
    const key = process.env.NEXTAUTH_SECRET ?? "fallback-secret-change-me";
    return Buffer.from(key, "utf8");
}

/** Sign a payload as base64url(json).base64url(hmac) */
export function signMfaToken(payload: object): string {
    const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const hmac = crypto
        .createHmac("sha256", getHmacSecret())
        .update(data)
        .digest("base64url");
    return `${data}.${hmac}`;
}

/** Verify and decode a signed token, returns payload or null */
export function verifyMfaToken(token: string): Record<string, unknown> | null {
    try {
        const [data, hmac] = token.split(".");
        if (!data || !hmac) return null;
        const expected = crypto
            .createHmac("sha256", getHmacSecret())
            .update(data)
            .digest("base64url");
        if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
            return null;
        }
        const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
        // Check expiry
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

/** Sign a short-lived pending token for a userId */
export function signMfaPendingToken(userId: string): string {
    return signMfaToken({ userId, exp: Date.now() + 10 * 60 * 1000 }); // 10 min
}

/** Verify a pending token and return userId or null */
export function verifyMfaPendingToken(token: string): string | null {
    const payload = verifyMfaToken(token);
    if (!payload) return null;
    return (payload.userId as string) ?? null;
}

export async function POST(req: NextRequest) {
    const v = validate(MfaVerifySchema, await req.json());
    if (!v.success) return v.response;
    const { userId, token } = v.data;

    // Validate the pending cookie to prevent brute-force on arbitrary userIds
    const pendingCookie = req.cookies.get(MFA_COOKIE)?.value;
    if (!pendingCookie) {
        return NextResponse.json(
            { error: "MFA session expired. Please log in again." },
            { status: 401 }
        );
    }
    const pendingUserId = verifyMfaPendingToken(pendingCookie);
    if (pendingUserId !== userId) {
        return NextResponse.json({ error: "Invalid MFA session." }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById(userId).select("+mfaSecret +mfaBackupCodes");

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
        return NextResponse.json({ error: "MFA not configured." }, { status: 400 });
    }

    const totpValid = verifyTotp(token, user.mfaSecret);
    let usedBackupIdx = -1;

    if (!totpValid) {
        usedBackupIdx = await findMatchingBackupCode(token, user.mfaBackupCodes ?? []);
    }

    if (!totpValid && usedBackupIdx === -1) {
        return NextResponse.json(
            { error: "Invalid code. Please try again." },
            { status: 400 }
        );
    }

    // Consume backup code if used
    if (usedBackupIdx !== -1) {
        const updated = [...(user.mfaBackupCodes ?? [])];
        updated.splice(usedBackupIdx, 1);
        await User.findByIdAndUpdate(userId, { mfaBackupCodes: updated });
    }

    // Issue a short-lived "mfa_verified" cookie
    const verifiedToken = signMfaPendingToken(`verified:${userId}`);

    // Email: MFA login — fire-and-forget
    if (user.email) {
        sendEmail({
            to: user.email,
            subject: "New Login with Two-Factor Authentication — CSRARS",
            html: mfaEventEmail({
                event: "login",
                email: user.email,
                name: user.name ?? undefined,
                timestamp: new Date().toLocaleString(),
            }),
        }).catch((e) => console.error("[email] mfa-login:", e));
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(MFA_VERIFIED_COOKIE, verifiedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60, // 60 seconds — just enough to complete the signIn() call
        path: "/",
    });
    // Clear the pending cookie
    res.cookies.set(MFA_COOKIE, "", { maxAge: 0, path: "/" });

    return res;
}
