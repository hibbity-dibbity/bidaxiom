import { Resend } from "resend";

/**
 * Email service using Resend for transactional emails.
 *
 * Falls back to console logging when RESEND_API_KEY is not configured
 * (allows development without email service).
 */

// Lazy getters to ensure env vars are read after dotenv loads
function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function getFromEmail(): string {
  return process.env.EMAIL_FROM || "noreply@constructionmgmt.app";
}

// Lazy initialization - only create client if API key is configured
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (resendClient !== null) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[EMAIL] RESEND_API_KEY not configured - emails will be logged to console");
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

/**
 * Send verification email with token link.
 *
 * @param email - Recipient email address
 * @param token - Verification token (plaintext)
 */
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${getAppUrl()}/verify-email?token=${token}`;
  const subject = "Verify your email address";
  const html = `
    <h2>Welcome to Construction Management</h2>
    <p>Please verify your email address by clicking the link below:</p>
    <p><a href="${verifyUrl}">Verify Email</a></p>
    <p>This link expires in 1 hour.</p>
    <p>If you didn't create this account, you can safely ignore this email.</p>
  `;

  const client = getResendClient();
  if (!client) {
    console.log(`[EMAIL DEV] Verification email to ${email}:`);
    console.log(`Subject: ${subject}`);
    console.log(`Link: ${verifyUrl}`);
    return;
  }

  try {
    console.log(`[EMAIL] Attempting to send email:`);
    console.log(`  From: ${getFromEmail()}`);
    console.log(`  To: ${email}`);
    console.log(`  Subject: ${subject}`);

    const result = await client.emails.send({
      from: getFromEmail(),
      to: email,
      subject,
      html,
    });

    console.log(`[EMAIL] Resend API response:`, JSON.stringify(result, null, 2));
    console.log(`[EMAIL] Verification email sent to ${email}`);
  } catch (err) {
    console.error(`[EMAIL] Failed to send verification email to ${email}:`, err);
    throw new Error("Failed to send verification email");
  }
}

/**
 * Send password reset email with token link.
 *
 * @param email - Recipient email address
 * @param token - Password reset token (plaintext)
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${getAppUrl()}/reset-password?token=${token}`;
  const subject = "Reset your password";
  const html = `
    <h2>Password Reset Request</h2>
    <p>You requested to reset your password. Click the link below to set a new password:</p>
    <p><a href="${resetUrl}">Reset Password</a></p>
    <p><strong>This link expires in 1 hour.</strong></p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  `;

  const client = getResendClient();
  if (!client) {
    console.log(`[EMAIL DEV] Password reset email to ${email}:`);
    console.log(`Subject: ${subject}`);
    console.log(`Link: ${resetUrl}`);
    return;
  }

  try {
    await client.emails.send({
      from: getFromEmail(),
      to: email,
      subject,
      html,
    });
    console.log(`[EMAIL] Password reset email sent to ${email}`);
  } catch (err) {
    console.error(`[EMAIL] Failed to send password reset email to ${email}:`, err);
    throw new Error("Failed to send password reset email");
  }
}

/**
 * Send organization invitation email with token link.
 *
 * @param email - Recipient email address
 * @param orgName - Organization name
 * @param inviterName - Name of person who sent the invitation
 * @param token - Invitation token (plaintext)
 */
export async function sendInvitationEmail(
  email: string,
  orgName: string,
  inviterName: string,
  token: string
): Promise<void> {
  const inviteUrl = `${getAppUrl()}/sign-up?invitation=${token}`;
  const subject = `You've been invited to join ${orgName}`;
  const html = `
    <h2>You've been invited!</h2>
    <p>${inviterName} has invited you to join <strong>${orgName}</strong> on Construction Management.</p>
    <p>Click the link below to accept the invitation and create your account:</p>
    <p><a href="${inviteUrl}">Accept Invitation</a></p>
    <p>This invitation expires in 7 days.</p>
  `;

  const client = getResendClient();
  if (!client) {
    console.log(`[EMAIL DEV] Invitation email to ${email}:`);
    console.log(`Subject: ${subject}`);
    console.log(`Link: ${inviteUrl}`);
    return;
  }

  try {
    await client.emails.send({
      from: getFromEmail(),
      to: email,
      subject,
      html,
    });
    console.log(`[EMAIL] Invitation email sent to ${email}`);
  } catch (err) {
    console.error(`[EMAIL] Failed to send invitation email to ${email}:`, err);
    throw new Error("Failed to send invitation email");
  }
}
