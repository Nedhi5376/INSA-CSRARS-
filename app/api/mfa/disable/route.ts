/**
 * POST /api/mfa/disable
 * Body: { token: string }
 * Requires a valid TOTP token (or backup code) before wiping MFA data.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { verifyTotp, findMatchingBackupCode } from "@/lib/mfa";
import { validate, MfaDisableSchema } from "@/lib/validation";
import { sendEmail } from "@/lib/email";
import { mfaEventEmail } from "@/emails/mfaEventEmail";

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const v = validate(MfaDisableSchema, await req.json());
    if (!v.success) return v.response;
    const { token } = v.data;

    await dbConnect();
    const user = await User.findById((session.user as { id: string }).id).select(
        "+mfaSecret +mfaBackupCodes"
    );

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
        return NextResponse.json({ error: "MFA is not enabled" }, { status: 400 });
    }

    const totpValid = verifyTotp(token, user.mfaSecret);
    const backupIdx = totpValid
        ? -1
        : await findMatchingBackupCode(token, user.mfaBackupCodes ?? []);

    if (!totpValid && backupIdx === -1) {
        return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
    }

    await User.findByIdAndUpdate(user._id, {
        mfaEnabled: false,
        $unset: { mfaSecret: "", mfaBackupCodes: "" },
    });

    // Email: MFA disabled — fire-and-forget
    if (user.email) {
        sendEmail({
            to: user.email,
            subject: "Two-Factor Authentication Disabled — CSRARS",
            html: mfaEventEmail({
                event: "disabled",
                email: user.email,
                name: user.name ?? undefined,
                timestamp: new Date().toLocaleString(),
            }),
        }).catch((e) => console.error("[email] mfa-disable:", e));
    }

    return NextResponse.json({ success: true });
}
