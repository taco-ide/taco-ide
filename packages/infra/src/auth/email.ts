import { Resend } from "resend";
import { env } from "../env";
import { escapeHtml } from "./invitation-email";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

interface SendPasswordResetEmailParams {
  to: string;
  resetUrl: string;
  userName: string;
}

interface SendVerificationEmailParams {
  to: string;
  verificationUrl: string;
  userName: string;
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  userName,
}: SendPasswordResetEmailParams) {
  // In development without API key, just log
  if (!resend) {
    console.log(`[DEV] Password reset email for ${to}:`);
    console.log(`  Reset URL: ${resetUrl}`);
    return;
  }

  try {
    const safeUserName = escapeHtml(userName);
    await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: "Reset your password - TACO-IDE",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Reset Password</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">Reset Your Password</h1>
            <p>Hi ${safeUserName},</p>
            <p>You requested to reset your password. Click the button below to create a new password:</p>
            <a href="${resetUrl}"
               style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Reset Password
            </a>
            <p>If you didn't request this, you can safely ignore this email.</p>
            <p>This link will expire in 1 hour.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #0070f3;">${resetUrl}</a>
            </p>
          </body>
        </html>
      `,
    });

    console.log(`Password reset email sent to ${to}`);
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
}

export async function sendVerificationEmail({
  to,
  verificationUrl,
  userName,
}: SendVerificationEmailParams) {
  // In development without API key, just log
  if (!resend) {
    console.log(`[DEV] Verification email for ${to}:`);
    console.log(`  Verification URL: ${verificationUrl}`);
    return;
  }

  try {
    const safeUserName = escapeHtml(userName);
    await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: "Verify your email - TACO-IDE",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Verify Email</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">Verify Your Email</h1>
            <p>Hi ${safeUserName},</p>
            <p>Welcome to TACO-IDE! Please verify your email address by clicking the button below:</p>
            <a href="${verificationUrl}"
               style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Verify Email
            </a>
            <p>This link will expire in 24 hours.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${verificationUrl}" style="color: #0070f3;">${verificationUrl}</a>
            </p>
          </body>
        </html>
      `,
    });

    console.log(`Verification email sent to ${to}`);
  } catch (error) {
    console.error("Failed to send verification email:", error);
    throw new Error("Failed to send verification email");
  }
}
