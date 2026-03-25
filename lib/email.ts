/**
 * lib/email.ts
 *
 * Reusable email service built on nodemailer.
 * Configure via environment variables — no code changes needed to switch providers.
 *
 * Required env vars:
 *   EMAIL_HOST      SMTP host (e.g. smtp.gmail.com)
 *   EMAIL_PORT      SMTP port (e.g. 587)
 *   EMAIL_USER      SMTP username / address
 *   EMAIL_PASSWORD  SMTP password / app-password
 *   EMAIL_FROM      Sender display address (e.g. "CSRARS <noreply@csrars.com>")
 *   EMAIL_TO        Default recipient for system alerts (admin address)
 */
import nodemailer from "nodemailer";

// ── Transport (created once, reused across calls) ─────────────────────────────

function createTransport() {
    const host = process.env.EMAIL_HOST;
    const port = parseInt(process.env.EMAIL_PORT ?? "587", 10);
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASSWORD;

    if (!host || !user || !pass) {
        return null; // Email not configured — all sends will be no-ops
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for 587/25
        auth: { user, pass },
    });
}

// Lazy singleton — only created when first needed
let _transport: ReturnType<typeof nodemailer.createTransport> | null | undefined =
    undefined;

function getTransport() {
    if (_transport === undefined) {
        _transport = createTransport();
    }
    return _transport;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
    /** Recipient address(es) */
    to: string | string[];
    subject: string;
    html: string;
    /** Override the FROM address for this message */
    from?: string;
}

/**
 * Send an email. Never throws — logs and returns false on failure.
 * Returns true on success.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
    const transport = getTransport();

    if (!transport) {
        // Email not configured — log and skip silently so nothing breaks
        console.warn(
            "[email] Skipping send — EMAIL_HOST / EMAIL_USER / EMAIL_PASSWORD not set.",
            { subject: opts.subject, to: opts.to }
        );
        return false;
    }

    try {
        const from =
            opts.from ??
            process.env.EMAIL_FROM ??
            process.env.EMAIL_USER ??
            "CSRARS <noreply@csrars.com>";

        const info = await transport.sendMail({
            from,
            to: Array.isArray(opts.to) ? opts.to.join(", ") : opts.to,
            subject: opts.subject,
            html: opts.html,
        });

        console.log("[email] Sent:", info.messageId, "→", opts.to);
        return true;
    } catch (err) {
        console.error("[email] Failed to send:", opts.subject, err);
        return false;
    }
}

/**
 * Convenience: send to the configured admin address (EMAIL_TO).
 * Falls back to EMAIL_USER if EMAIL_TO is not set.
 */
export async function sendAdminEmail(
    subject: string,
    html: string
): Promise<boolean> {
    const to =
        process.env.EMAIL_TO ?? process.env.EMAIL_USER;

    if (!to) {
        console.warn("[email] EMAIL_TO not set — skipping admin email:", subject);
        return false;
    }

    return sendEmail({ to, subject, html });
}
