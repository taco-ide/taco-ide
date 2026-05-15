import { Resend } from "resend";
import { env } from "../env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export interface SendInvitationEmailParams {
  to: string;
  organizationName: string;
  invitationId: string;
  inviterName?: string;
  expiresAt?: Date;
  role: string;
}

/**
 * Sends an organization invitation email with a link to accept it.
 *
 * Use this from both the Better Auth `organization.sendInvitationEmail`
 * hook and any route that creates invitations bypassing Better Auth
 * (e.g. Platform Admin direct inserts via Drizzle).
 *
 * Side-effect: dispatches an email via Resend when RESEND_API_KEY is
 * configured; otherwise logs to stdout. Throws on transport failure so
 * callers can decide whether to swallow (route) or surface (hook).
 */
export async function sendInvitationEmail({
  to,
  organizationName,
  invitationId,
  inviterName,
  expiresAt,
  role,
}: SendInvitationEmailParams): Promise<void> {
  const acceptUrl = `${env.FRONTEND_URL}/auth/accept-invitation?id=${encodeURIComponent(invitationId)}`;
  const inviterLine = inviterName
    ? `${inviterName} invited you to join`
    : "You have been invited to join";
  const expiresLine = expiresAt
    ? `<p>This invitation expires on ${expiresAt.toUTCString()}.</p>`
    : "";

  if (!resend) {
    console.log(`[DEV] Invitation email for ${to}:`);
    console.log(`  Organization: ${organizationName}`);
    console.log(`  Role: ${role}`);
    console.log(`  Accept URL: ${acceptUrl}`);
    if (expiresAt) console.log(`  Expires at: ${expiresAt.toISOString()}`);
    return;
  }

  try {
    await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: `Invitation to join ${organizationName} - TACO-IDE`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Organization Invitation</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">You're invited</h1>
            <p>${inviterLine} <strong>${organizationName}</strong> on TACO-IDE as <strong>${role}</strong>.</p>
            <a href="${acceptUrl}"
               style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Accept Invitation
            </a>
            ${expiresLine}
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${acceptUrl}" style="color: #0070f3;">${acceptUrl}</a>
            </p>
          </body>
        </html>
      `,
    });

    console.log(`Invitation email sent to ${to}`);
  } catch (error) {
    console.error("Failed to send invitation email:", error);
    throw new Error("Failed to send invitation email");
  }
}
