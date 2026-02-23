import {
    Controller,
    Get,
    Patch,
    Post,
    Body,
    Req,
    UseGuards,
    HttpCode,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { EmailService } from './email.service';
import { EmailPreferenceService } from './email-preference.service';
import { UpdateEmailPreferenceDto } from './dto/email-preference.dto';
import { SendGridWebhookEventDto } from './dto/webhook-event.dto';
import { SendEmailDto } from './dto/send-email.dto';
import { JwtAuthGuard } from '../Authentication/jwt-auth-guard';
import { AdminGuard } from '../guards/admin.guard';
import { Public } from '../Authentication/public.decorator';

@ApiTags('Email')
@Controller('email')
export class EmailController {
    private readonly logger = new Logger(EmailController.name);

    constructor(
        private readonly emailService: EmailService,
        private readonly emailPreferenceService: EmailPreferenceService,
    ) { }

    // ── User Email Preferences ─────────────────────────────────────────────────

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('preferences')
    @ApiOperation({ summary: 'Get current user email preferences' })
    async getPreferences(@Req() req: any) {
        const userId = req.user?.sub ?? req.user?.userId ?? req.user?.id;
        return this.emailPreferenceService.getPreferences(String(userId));
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Patch('preferences')
    @ApiOperation({ summary: 'Update current user email preferences' })
    async updatePreferences(
        @Req() req: any,
        @Body() dto: UpdateEmailPreferenceDto,
    ) {
        const userId = req.user?.sub ?? req.user?.userId ?? req.user?.id;
        return this.emailPreferenceService.updatePreferences(String(userId), dto);
    }

    // ── Admin: Send Test Email ─────────────────────────────────────────────────

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, AdminGuard)
    @Post('test')
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({ summary: '[Admin] Queue a test email' })
    @ApiBody({ type: SendEmailDto })
    async sendTestEmail(@Body() dto: SendEmailDto) {
        await this.emailService.queueEmail(dto);
        return { message: 'Test email queued successfully' };
    }

    // ── SendGrid Delivery Webhooks ─────────────────────────────────────────────

    /**
     * SendGrid calls this endpoint for delivery events (delivered, bounce, spam_report, etc.)
     * Register this URL in the SendGrid dashboard → Mail Settings → Event Webhook.
     * Endpoint: POST /email/webhook/sendgrid
     */
    @Public()
    @Post('webhook/sendgrid')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'SendGrid delivery event webhook receiver' })
    async handleSendGridWebhook(@Body() events: SendGridWebhookEventDto[]) {
        if (!Array.isArray(events)) {
            this.logger.warn('Received non-array SendGrid webhook payload');
            return { received: 0 };
        }

        let processed = 0;
        for (const event of events) {
            try {
                await this.emailService.trackDeliveryEvent(event);
                processed++;
            } catch (err) {
                this.logger.error(`Failed to track webhook event: ${err.message}`);
            }
        }

        this.logger.debug(`Processed ${processed}/${events.length} SendGrid webhook events`);
        return { received: events.length, processed };
    }
}
