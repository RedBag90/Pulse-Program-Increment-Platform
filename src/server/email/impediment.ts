import { sendEmail } from "./send";

interface EscalationEmailInput {
  rteEmails: string[];
  impedimentTitle: string;
  severity: string;
  artName: string;
  appUrl: string;
  artId: string;
}

export async function sendImpedimentEscalationEmail(input: EscalationEmailInput): Promise<void> {
  const { rteEmails, impedimentTitle, severity, artName, appUrl, artId } = input;
  if (rteEmails.length === 0) return;

  const url = `${appUrl}/art/${artId}/impediments`;
  const subject = `[Pulse] Impediment escalated in ${artName}: ${impedimentTitle}`;

  const html = `
    <p>An impediment has been escalated and requires your attention as RTE.</p>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">ART</td><td style="font-size:14px">${artName}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">Impediment</td><td style="font-size:14px;font-weight:600">${impedimentTitle}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">Severity</td><td style="font-size:14px;text-transform:capitalize">${severity}</td></tr>
    </table>
    <p><a href="${url}" style="color:#2563eb">View impediments →</a></p>
  `;

  const text = `Impediment escalated in ${artName}\n\n${impedimentTitle}\nSeverity: ${severity}\n\n${url}`;

  await Promise.allSettled(rteEmails.map((to) => sendEmail({ to, subject, html, text })));
}
