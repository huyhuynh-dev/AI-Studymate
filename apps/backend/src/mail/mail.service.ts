import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getOtpMailHtml } from './mail.html.js';

@Injectable()
export class MailService {
    constructor(
        private readonly mailerService: MailerService,
        private readonly configService: ConfigService
    ) { };

    async sendMail(
        message: string,
        subject: string,
        to: string,
    ): Promise<{ success: boolean }> {
        try {
            await this.mailerService.sendMail({
                to,
                from: this.configService.get('MAIL_FROM'),
                subject,
                text: message,
                html: message,
            });

            return {
                success: true,
            };
        } catch (error) {
            return {
                success: false,
            };
        }
    }

    async sendOtpMail(
        to: string,
        otpCode: string,
        expirateInSeconds: number,
        userName?: string,
    ): Promise<{ success: boolean }> {
        try {
            const html = getOtpMailHtml(otpCode, expirateInSeconds, userName);

            const text = `
                AI StudyMate

                Xin chào ${userName ?? 'bạn'},

                Mã OTP của bạn là: ${otpCode}

                Mã OTP có hiệu lực trong ${expirateInSeconds / 60} phút.

                Không chia sẻ mã OTP này với bất kỳ ai.
                    `.trim();

            await this.mailerService.sendMail({
                to,
                from: this.configService.get('MAIL_FROM'),
                subject: 'Mã xác thực OTP - AI StudyMate',
                text,
                html,
            });

            return {
                success: true,
            };
        } catch (error) {
            console.error('Failed to send OTP email:', error);

            return {
                success: false,
            };
        }
    }
}
