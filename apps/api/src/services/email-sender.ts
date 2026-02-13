/**
 * Email Sender Service
 *
 * Handles email delivery using nodemailer with SMTP configuration.
 * Used for scheduled report delivery and other automated notifications.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import type { SentMessageInfo } from 'nodemailer';

/**
 * Create nodemailer SMTP transport from environment configuration.
 *
 * Required environment variables:
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port
 * - SMTP_USER: SMTP authentication username
 * - SMTP_PASS: SMTP authentication password
 *
 * @returns Configured nodemailer transporter
 */
function createEmailTransport(): Transporter {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error(
      'Email configuration missing. Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS'
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // Use TLS for port 465, STARTTLS for others
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Send report email with attachment.
 *
 * @param recipients - Array of recipient email addresses
 * @param subject - Email subject line
 * @param bodyHtml - HTML email body
 * @param attachmentPath - File path to the report attachment
 * @param attachmentFilename - Display filename for the attachment
 * @returns Result with success status and message ID or error
 */
export async function sendReportEmail(
  recipients: string[],
  subject: string,
  bodyHtml: string,
  attachmentPath: string,
  attachmentFilename: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!recipients || recipients.length === 0) {
      return {
        success: false,
        error: 'No recipients specified',
      };
    }

    const fromAddress = process.env.SMTP_FROM;
    if (!fromAddress) {
      return {
        success: false,
        error: 'SMTP_FROM environment variable not configured',
      };
    }

    // Create transport
    const transporter = createEmailTransport();

    // Send email
    const info: SentMessageInfo = await transporter.sendMail({
      from: fromAddress,
      to: recipients.join(', '),
      subject: subject,
      html: bodyHtml,
      attachments: [
        {
          filename: attachmentFilename,
          path: attachmentPath,
        },
      ],
    });

    console.log(`Email sent successfully: ${info.messageId}`);
    console.log(`Recipients: ${recipients.join(', ')}`);
    console.log(`Attachment: ${attachmentFilename}`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send email:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Verify SMTP connection is working.
 * Useful for testing email configuration.
 *
 * @returns Whether the SMTP connection is valid
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    const transporter = createEmailTransport();
    await transporter.verify();
    console.log('SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('SMTP connection verification failed:', error);
    return false;
  }
}
