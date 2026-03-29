import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Represents a single SendGrid inbound webhook event.
 * SendGrid sends arrays of these objects.
 */
export class SendGridWebhookEventDto {
    @ApiProperty({ description: 'SendGrid message ID' })
    @IsString()
    sg_message_id: string;

    @ApiProperty({
        description: 'Event type: delivered, bounce, spam_report, open, click, etc.',
    })
    @IsString()
    event: string;

    @ApiProperty({ description: 'Recipient email address' })
    @IsString()
    email: string;

    @ApiProperty({ description: 'Unix timestamp of the event' })
    @IsNumber()
    timestamp: number;

    @ApiPropertyOptional({ description: 'Bounce reason (if event=bounce)' })
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiPropertyOptional({ description: 'Additional categories' })
    @IsOptional()
    @IsArray()
    category?: string[];
}

export class SendGridWebhookPayloadDto {
    @IsArray()
    events: SendGridWebhookEventDto[];
}
