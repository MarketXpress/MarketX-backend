import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmailPreferenceDto {
    @ApiPropertyOptional({ description: 'Receive order confirmation & status emails' })
    @IsOptional()
    @IsBoolean()
    orderEmails?: boolean;

    @ApiPropertyOptional({ description: 'Receive shipping notification emails' })
    @IsOptional()
    @IsBoolean()
    shippingEmails?: boolean;

    @ApiPropertyOptional({ description: 'Receive security & account emails' })
    @IsOptional()
    @IsBoolean()
    securityEmails?: boolean;

    @ApiPropertyOptional({ description: 'Receive account-related emails' })
    @IsOptional()
    @IsBoolean()
    accountEmails?: boolean;

    @ApiPropertyOptional({ description: 'Receive marketing & promotional emails' })
    @IsOptional()
    @IsBoolean()
    marketingEmails?: boolean;
}
