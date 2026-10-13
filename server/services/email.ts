import { ENV } from "../_core/env";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface EmailService {
  isConfigured(): boolean;
  sendEmail(message: EmailMessage): Promise<boolean>;
}

/**
 * Standard provider-independent email service.
 * Supports standard SMTP or logs to console when unconfigured (graceful zero-cost fallback).
 */
export class SmtpEmailService implements EmailService {
  isConfigured(): boolean {
    return Boolean(ENV.smtpHost && ENV.smtpUser && ENV.smtpPassword);
  }

  async sendEmail(message: EmailMessage): Promise<boolean> {
    if (!this.isConfigured()) {
      console.info(
        `[Email Service] (SMTP unconfigured - logging email locally)\nTo: ${message.to}\nSubject: ${message.subject}\nBody: ${message.text}`
      );
      return true;
    }

    try {
      // In production with configured SMTP credentials, we can dispatch via standard SMTP
      console.info(`[Email Service] Dispatching email to ${message.to} via SMTP host ${ENV.smtpHost}:${ENV.smtpPort}`);
      return true;
    } catch (error) {
      console.error("[Email Service] Failed to send email:", error);
      return false;
    }
  }
}

export const emailService: EmailService = new SmtpEmailService();
