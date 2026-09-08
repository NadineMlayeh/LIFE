import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    this.from = process.env.MAIL_FROM ?? 'LIFE <no-reply@life.local>';
    this.transporter = createTransport({
      host: process.env.SMTP_HOST ?? 'localhost',
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: false,
      ignoreTLS: true,
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
}
