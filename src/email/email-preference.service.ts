import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailPreference } from './entities/email-preference.entity';
import { UpdateEmailPreferenceDto } from './dto/email-preference.dto';

export type EmailType = 'order' | 'shipping' | 'security' | 'account' | 'marketing';

@Injectable()
export class EmailPreferenceService {
    private readonly logger = new Logger(EmailPreferenceService.name);

    constructor(
        @InjectRepository(EmailPreference)
        private readonly preferenceRepository: Repository<EmailPreference>,
    ) { }

    /**
     * Get preferences for a user. Creates default preferences if none exist.
     */
    async getPreferences(userId: string): Promise<EmailPreference> {
        const existing = await this.preferenceRepository.findOne({ where: { userId } });
        if (existing) return existing;

        this.logger.debug(`Creating default email preferences for user ${userId}`);
        const defaults = this.preferenceRepository.create({ userId });
        return this.preferenceRepository.save(defaults);
    }

    /**
     * Update preferences for a user.
     */
    async updatePreferences(
        userId: string,
        dto: UpdateEmailPreferenceDto,
    ): Promise<EmailPreference> {
        const prefs = await this.getPreferences(userId);
        Object.assign(prefs, dto);
        return this.preferenceRepository.save(prefs);
    }

    /**
     * Check whether a user has opted in to a certain email type.
     * Security emails always return true (cannot fully opt-out).
     */
    async canReceive(userId: string, type: EmailType): Promise<boolean> {
        if (!userId) return true; // no user context → allow

        const prefs = await this.getPreferences(userId);
        switch (type) {
            case 'order':
                return prefs.orderEmails;
            case 'shipping':
                return prefs.shippingEmails;
            case 'security':
                return true; // always send security emails
            case 'account':
                return prefs.accountEmails;
            case 'marketing':
                return prefs.marketingEmails;
            default:
                return true;
        }
    }
}
