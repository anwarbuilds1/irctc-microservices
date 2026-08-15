import { env } from '../config/env';
import { logger } from '../config/logger';

export class EmailService {
  /**
   * Sends an OTP verification email to the user.
   * Handles Resend API integration.
   * 
   * @param email The recipient email address.
   * @param otp The plaintext OTP.
   */
  public static async sendOtpEmail(email: string, otp: string): Promise<void> {
    const from = env.RESEND_FROM_EMAIL;
    const apiKey = env.RESEND_API_KEY;

    // Log the action (without the OTP in production logs)
    logger.info({ email }, 'Initiating OTP email transmission');

    if (!apiKey || apiKey === 're_mock_key' || env.NODE_ENV === 'test') {
      logger.info(`[EmailService] [MOCK] Sending OTP to ${email}. OTP is: ${otp}`);
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: email,
          subject: 'Verify your email - IRCTC Services',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
              <h2 style="color: #0284c7; text-align: center;">Verify Your Email Address</h2>
              <p>Hello,</p>
              <p>Thank you for signing up on IRCTC Microservices. Please use the following One-Time Password (OTP) to verify your email address:</p>
              <div style="text-align: center; margin: 30px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1e293b; padding: 10px 20px; background-color: #f1f5f9; border-radius: 4px;">${otp}</span>
              </div>
              <p>This OTP is valid for <strong>5 minutes</strong> and can only be used once.</p>
              <p style="color: #64748b; font-size: 14px; margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                If you did not request this verification, please ignore this email.
              </p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorDetail = await response.text();
        logger.error(`Resend API response error: ${response.status} ${response.statusText} - ${errorDetail}`);
        throw new Error(`Failed to send email via Resend API: ${response.statusText}`);
      }

      logger.info({ email }, 'OTP email successfully transmitted via Resend');
    } catch (error) {
      logger.error(error, `Failed to send email to ${email} using Resend`);
      throw error;
    }
  }
}
