/**
 * MFA utilities — TOTP via otplib v13 + backup codes
 *
 * otplib v13 functional API requires explicit crypto/base32 plugins.
 * We use NobleCryptoPlugin (pure-JS, no native deps) and ScureBase32Plugin.
 */
import { verifySync, generateURI } from "otplib";
import { NobleCryptoPlugin } from "@otplib/plugin-crypto-noble";
import { ScureBase32Plugin } from "@otplib/plugin-base32-scure";
import { generateSecret as otplibGenerateSecret } from "otplib";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const APP_NAME = "CSRARS";

// Shared plugin instances (stateless, safe to reuse)
const cryptoPlugin = new NobleCryptoPlugin();
const base32Plugin = new ScureBase32Plugin();

// ── TOTP ──────────────────────────────────────────────────────────────────────

/** Generate a new Base32-encoded TOTP secret */
export function generateMfaSecret(): string {
    return otplibGenerateSecret({ length: 20, crypto: cryptoPlugin, base32: base32Plugin });
}

/** Build the otpauth:// URI for QR code generation */
export function buildOtpAuthUrl(email: string, secret: string): string {
    return generateURI({ issuer: APP_NAME, label: email, secret });
}

/** Render the otpauth URI as a base64 PNG data URL */
export async function generateQrDataUrl(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl, { width: 200, margin: 2 });
}

/** Verify a 6-digit TOTP token (±30 s window for clock skew) */
export function verifyTotp(token: string, secret: string): boolean {
    try {
        const result = verifySync({
            token,
            secret,
            crypto: cryptoPlugin,
            base32: base32Plugin,
            epochTolerance: 30,
        });
        return result.valid;
    } catch {
        return false;
    }
}

// ── Backup codes ──────────────────────────────────────────────────────────────

const BACKUP_CODE_COUNT = 8;

/** Generate 8 random backup codes — returns plaintext + bcrypt-hashed pairs */
export async function generateBackupCodes(): Promise<{
    plaintext: string[];
    hashed: string[];
}> {
    const plaintext: string[] = [];
    const hashed: string[] = [];

    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
        const code = crypto.randomBytes(5).toString("hex").toUpperCase(); // e.g. "A3F2C1B4D9"
        plaintext.push(code);
        hashed.push(await bcrypt.hash(code, 10));
    }

    return { plaintext, hashed };
}

/**
 * Find a matching backup code using constant-time bcrypt comparison.
 * Returns the index of the matched code (to remove it), or -1.
 */
export async function findMatchingBackupCode(
    submitted: string,
    hashed: string[]
): Promise<number> {
    for (let i = 0; i < hashed.length; i++) {
        const match = await bcrypt.compare(submitted.toUpperCase(), hashed[i]);
        if (match) return i;
    }
    return -1;
}
