/**
 * emails/base.ts
 * Shared HTML wrapper used by every template.
 */
export function baseLayout(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#0f172a; font-family:Arial,sans-serif; color:#e2e8f0; }
    .wrapper { max-width:600px; margin:32px auto; background:#1e293b; border-radius:8px; overflow:hidden; border:1px solid #334155; }
    .header { background:#1d4ed8; padding:24px 32px; }
    .header h1 { margin:0; font-size:20px; color:#fff; letter-spacing:0.5px; }
    .header p  { margin:4px 0 0; font-size:13px; color:#bfdbfe; }
    .body   { padding:28px 32px; }
    .body p { margin:0 0 14px; font-size:14px; line-height:1.6; color:#cbd5e1; }
    .badge  { display:inline-block; padding:3px 10px; border-radius:9999px; font-size:12px; font-weight:700; }
    .badge-critical { background:#7f1d1d; color:#fca5a5; }
    .badge-high     { background:#7c2d12; color:#fdba74; }
    .badge-analysis { background:#14532d; color:#86efac; }
    .badge-info     { background:#1e3a5f; color:#93c5fd; }
    .badge-mfa      { background:#4c1d95; color:#c4b5fd; }
    table.data { width:100%; border-collapse:collapse; margin:16px 0; font-size:13px; }
    table.data th { background:#0f172a; color:#94a3b8; text-align:left; padding:8px 10px; border-bottom:1px solid #334155; }
    table.data td { padding:8px 10px; border-bottom:1px solid #1e293b; color:#e2e8f0; }
    .footer { padding:16px 32px; background:#0f172a; font-size:11px; color:#475569; text-align:center; }
    .btn { display:inline-block; margin-top:8px; padding:10px 22px; background:#1d4ed8; color:#fff; border-radius:6px; text-decoration:none; font-size:13px; font-weight:600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>CSRARS</h1>
      <p>Cyber Security Risk Analysis &amp; Reporting System</p>
    </div>
    <div class="body">${body}</div>
    <div class="footer">
      This is an automated message from CSRARS. Do not reply to this email.
    </div>
  </div>
</body>
</html>`;
}
