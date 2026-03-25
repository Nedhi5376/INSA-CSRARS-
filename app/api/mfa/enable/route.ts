/**
 * POST /api/mfa/enable
 * Body: { secret: string, token: string }
 * Verifies the TOTP token against the provided secret, then persists the
 * secret + hashed backup codes and sets mfaEnabled = true.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { verifyTotp, generateBackupCodes } from "@/lib/mfa";
import { validate, MfaEnableSchema } from "@/lib/validation";
import { sendEmail } from "@/lib/email";
import { mfaEventEmail } from "@/emails/mfaEventEmail";

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const v = validate(MfaEnableSchema, await req.json());
    if (!v.success) return v.response;
    const { secret, token } = v.data;

    if (!verifyTotp(token, secret)) {
        return NextResponse.json(
            { error: "Invalid verification code. Please try again." },
            { status: 400 }
        );
    }

    const { plaintext, hashed } = await generateBackupCodes();

    await dbConnect();
    await User.findByIdAndUpdate(
        (session.user as { id: string }).id,
        { mfaEnabled: true, mfaSecret: secret, mfaBackupCodes: hashed }
    );

    // Email: MFA enabled — fire-and-forget
    if (session.user.email) {
        sendEmail({
            to: session.user.email,
            subject: "Two-Factor Authentication Enabled — CSRARS",
            html: mfaEventEmail({
                event: "enabled",
                email: session.user.email,
                name: session.user.name ?? undefined,
                timestamp: new Date().toLocaleString(),
            }),
        }).catch((e) => console.error("[email] mfa-enable:", e));
    }

    return NextResponse.json({ success: true, backupCodes: plaintext });
}
