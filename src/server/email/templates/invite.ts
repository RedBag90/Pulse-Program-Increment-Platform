export interface InviteEmailData {
  tenantName: string;
  inviterEmail: string;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
}

export function renderInviteEmail(
  locale: "en" | "de",
  data: InviteEmailData,
): { subject: string; html: string; text: string } {
  if (locale === "de") return renderDe(data);
  return renderEn(data);
}

function renderEn(data: InviteEmailData) {
  const subject = `You've been invited to ${data.tenantName} on Pulse`;
  const text = [
    `Hi,`,
    ``,
    `${data.inviterEmail} has invited you to join ${data.tenantName} on Pulse as ${data.role}.`,
    ``,
    `Accept your invitation (expires in ${data.expiresInDays} days):`,
    data.acceptUrl,
    ``,
    `If you did not expect this invitation, you can safely ignore this email.`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:20px">You've been invited to ${esc(data.tenantName)}</h1>
  <p>${esc(data.inviterEmail)} has invited you to join <strong>${esc(data.tenantName)}</strong> on Pulse as <strong>${esc(data.role)}</strong>.</p>
  <p>
    <a href="${esc(data.acceptUrl)}" style="display:inline-block;padding:12px 24px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px">
      Accept invitation
    </a>
  </p>
  <p style="color:#666;font-size:13px">This link expires in ${data.expiresInDays} days. If you did not expect this invitation, ignore this email.</p>
</body>
</html>`;

  return { subject, html, text };
}

function renderDe(data: InviteEmailData) {
  const subject = `Du wurdest zu ${data.tenantName} auf Pulse eingeladen`;
  const text = [
    `Hallo,`,
    ``,
    `${data.inviterEmail} hat dich eingeladen, ${data.tenantName} auf Pulse als ${data.role} beizutreten.`,
    ``,
    `Einladung annehmen (läuft in ${data.expiresInDays} Tagen ab):`,
    data.acceptUrl,
    ``,
    `Falls du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="de">
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:20px">Einladung zu ${esc(data.tenantName)}</h1>
  <p>${esc(data.inviterEmail)} hat dich eingeladen, <strong>${esc(data.tenantName)}</strong> auf Pulse als <strong>${esc(data.role)}</strong> beizutreten.</p>
  <p>
    <a href="${esc(data.acceptUrl)}" style="display:inline-block;padding:12px 24px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px">
      Einladung annehmen
    </a>
  </p>
  <p style="color:#666;font-size:13px">Dieser Link läuft in ${data.expiresInDays} Tagen ab. Falls du diese Einladung nicht erwartet hast, ignoriere diese E-Mail.</p>
</body>
</html>`;

  return { subject, html, text };
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
