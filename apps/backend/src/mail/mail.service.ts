import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
    constructor(private readonly mailerService: MailerService) { };

    async sendMail() {
        try {
            await this.mailerService.sendMail({
                to: 'hh0926261619@gmail.com',
                from: '"Welcome to the fold" <huyhn.tools@gmail.com>',
                subject: 'Quotes', // Subject line
                text: '', // plaintext body
                html: '<p>How many programmers does it take to change a light bulb? None, that’s a hardware problem.</p>',
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
}
