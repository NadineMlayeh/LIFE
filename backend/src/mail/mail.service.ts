import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    this.from = process.env.MAIL_FROM ?? 'LIFE <no-reply@life.local>';
    /*
      One transport, two very different jobs.

      Locally this points at Mailpit, which accepts anything, needs no credentials and
      delivers nothing — every message is caught and readable at localhost:8025. In production
      it points at any provider that speaks SMTP, and needs to authenticate, which is what
      `SMTP_USER` decides between here.

      **Nothing above this line names a provider**, which is the point. Which service actually
      carries the mail is four environment variables, so moving between them — or away from one
      whose sending rules turn out not to suit — costs no code at all.

      TLS is *required* whenever credentials are in play rather than merely preferred. Port 587
      is plaintext until STARTTLS upgrades it, and a server that fails to offer the upgrade
      would otherwise be handed the password in the clear. Better to fail the send.
    */
    const user = process.env.SMTP_USER;
    const authenticated = Boolean(user);
    const port = Number(process.env.SMTP_PORT ?? 1025);

    this.transporter = createTransport({
      host: process.env.SMTP_HOST ?? 'localhost',
      port,
      // 465 is TLS from the first byte; 587 starts plain and upgrades.
      secure: port === 465,
      ignoreTLS: !authenticated,
      requireTLS: authenticated && port !== 465,
      ...(authenticated
        ? { auth: { user, pass: process.env.SMTP_PASS ?? '' } }
        : {}),
    });
  }

  async sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Verify your LIFE account',
      text: `Welcome to LIFE.\n\nConfirm your email address by opening this link:\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not create a LIFE account, you can ignore this email.`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; line-height: 1.6; color: #1c1917;">
          <h1 style="font-size: 20px; margin-bottom: 16px;">Welcome to LIFE</h1>
          <p style="margin: 0 0 24px;">Confirm your email address to finish creating your account.</p>
          <p style="margin: 0 0 24px;">
            <a href="${verificationUrl}"
               style="display: inline-block; background: #1c1917; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none;">
              Verify my email
            </a>
          </p>
          <p style="margin: 0 0 8px; font-size: 13px; color: #78716c;">Or paste this link into your browser:</p>
          <p style="margin: 0 0 24px; font-size: 13px; word-break: break-all; color: #78716c;">${verificationUrl}</p>
          <p style="font-size: 13px; color: #78716c;">This link expires in 24 hours. If you did not create a LIFE account, you can ignore this email.</p>
        </div>
      `,
    });

    this.logger.log(`Verification email sent to ${to}`);
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Reset your LIFE password',
      text: `Someone asked to reset the password on your LIFE account.

Set a new one here:
${resetUrl}

This link expires in one hour and can be used once. If it was not you, ignore this email — nothing has changed.`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; line-height: 1.6; color: #1c1917;">
          <h1 style="font-size: 20px; margin-bottom: 16px;">Reset your password</h1>
          <p style="margin: 0 0 24px;">Someone asked to reset the password on your LIFE account.</p>
          <p style="margin: 0 0 24px;">
            <a href="${resetUrl}"
               style="display: inline-block; background: #1c1917; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none;">
              Set a new password
            </a>
          </p>
          <p style="margin: 0 0 8px; font-size: 13px; color: #78716c;">Or paste this link into your browser:</p>
          <p style="margin: 0 0 24px; font-size: 13px; word-break: break-all; color: #78716c;">${resetUrl}</p>
          <p style="font-size: 13px; color: #78716c;">This link expires in one hour and can be used once. If it was not you, ignore this email — nothing has changed.</p>
        </div>
      `,
    });

    // The address is deliberately not logged: a reset request is a sensitive event, and logs
    // are the easiest place for one to leak.
    this.logger.log('Password reset email sent');
  }
}
