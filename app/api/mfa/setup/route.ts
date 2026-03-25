/**
 * POST /api/mfa/setup
 * Generates a fresh TOTP secret and QR code for the authenticated user.
 * The secret is NOT saved yet — the user must confirm with /api/mfa/enable.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateMfaSecret, buildOtpAuthUrl, generateQrDataUrl } from "@/lib/mfa";

export async function POST() {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email!;
    const secret = generateMfaSecret();
    const otpauthUrl = buildOtpAuthUrl(email, secret);
    const qrDataUrl = await generateQrDataUrl(otpauthUrl);

    // Return secret so the client can pass it back during /enable confirmation.
    // It is NOT persisted until the user verifies the code.
    return NextResponse.json({ success: true, secret, qrDataUrl });
}
