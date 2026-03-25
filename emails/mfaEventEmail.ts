import { baseLayout } from "./base";

export type MfaEventType = "enabled" | "disabled" | "login";

export interface MfaEventEmailData {
    event: MfaEventType;
    email: string;
    name?: string;
    ipAddress?: string;
    timestamp?: string;
}

const EVENT_LABELS: Record<MfaEventType, string> = {
    enabled: "Two-Factor Authentication Enabled",
    disabled: "Two-Factor Authentication Disabled",
    login: "New Login with Two-Factor Authentication",
};

const EVENT_DESCRIPTIONS: Record<MfaEventType, string> = {
    enabled:
        "Two-factor authentication has been successfully enabled on your account. Your account is now more secure.",
    disabled:
        "Two-factor authentication has been disabled on your account. If you did not make this change, please contact your administrator immediately.",
    login:
        "A successful login was completed using two-factor authentication. If this was not you, please contact your administrator immediately.",
};

export function mfaEventEmail(data: MfaEventEmailData): string {
    const label = EVENT_LABELS[data.event];
    const description = EVENT_DESCRIPTIONS[data.event];
    const timestamp = data.timestamp ?? new Date().toLocaleString();
    const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    const body = `
    <p>
      <span class="badge badge-mfa">${label}</span>
    </p>
    <p>Hello${data.name ? ` ${data.name}` : ""},</p>
    <p>${description}</p>
    <table class="data">
      <tr><th>Account</th><td>${data.email}</td></tr>
      <tr><th>Event</th><td>${label}</td></tr>
      <tr><th>Time</th><td>${timestamp}</td></tr>
      ${data.ipAddress ? `<tr><th>IP Address</th><td>${data.ipAddress}</td></tr>` : ""}
    </table>
    <p>If you did not perform this action, please log in and review your account security immediately.</p>
    <a class="btn" href="${appUrl}/profile">Review Account Security</a>
  `;
    return baseLayout(`${label} — CSRARS`, body);
}
