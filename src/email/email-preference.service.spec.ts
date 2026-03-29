import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailPreferenceService } from './email-preference.service';
import { EmailPreference } from './entities/email-preference.entity';

describe('EmailPreferenceService', () => {
    let service: EmailPreferenceService;
    let mockRepo: any;

    const userId = 'user-abc';

    const defaultPrefs: Partial<EmailPreference> = {
        id: 'pref-1',
        userId,
        orderEmails: true,
        shippingEmails: true,
        securityEmails: true,
        accountEmails: true,
        marketingEmails: false,
    };

    beforeEach(async () => {
        mockRepo = {
            findOne: jest.fn(),
            create: jest.fn().mockReturnValue(defaultPrefs),
            save: jest.fn().mockResolvedValue(defaultPrefs),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EmailPreferenceService,
                { provide: getRepositoryToken(EmailPreference), useValue: mockRepo },
            ],
        }).compile();

        service = module.get<EmailPreferenceService>(EmailPreferenceService);
    });

    afterEach(() => jest.clearAllMocks());

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getPreferences()', () => {
        it('should return existing preferences', async () => {
            mockRepo.findOne.mockResolvedValue(defaultPrefs);

            const result = await service.getPreferences(userId);

            expect(result).toEqual(defaultPrefs);
            expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { userId } });
            expect(mockRepo.create).not.toHaveBeenCalled();
        });

        it('should create default preferences for a new user', async () => {
            mockRepo.findOne.mockResolvedValue(null);

            const result = await service.getPreferences(userId);

            expect(mockRepo.create).toHaveBeenCalledWith({ userId });
            expect(mockRepo.save).toHaveBeenCalled();
            expect(result).toMatchObject({ userId });
        });
    });

    describe('updatePreferences()', () => {
        it('should update and persist changed preferences', async () => {
            mockRepo.findOne.mockResolvedValue({ ...defaultPrefs });
            const updated = { ...defaultPrefs, marketingEmails: true };
            mockRepo.save.mockResolvedValue(updated);

            const result = await service.updatePreferences(userId, { marketingEmails: true });

            expect(mockRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ marketingEmails: true }),
            );
            expect(result.marketingEmails).toBe(true);
        });

        it('should only update provided fields (PATCH semantics)', async () => {
            const existing = { ...defaultPrefs };
            mockRepo.findOne.mockResolvedValue(existing);
            mockRepo.save.mockResolvedValue({ ...existing, shippingEmails: false });

            const result = await service.updatePreferences(userId, { shippingEmails: false });

            // orderEmails should remain untouched
            expect(mockRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ orderEmails: true, shippingEmails: false }),
            );
        });
    });

    describe('canReceive()', () => {
        beforeEach(() => {
            mockRepo.findOne.mockResolvedValue({ ...defaultPrefs });
        });

        it('should return true for order emails when opted in', async () => {
            const result = await service.canReceive(userId, 'order');
            expect(result).toBe(true);
        });

        it('should return false for marketing emails (default off)', async () => {
            const result = await service.canReceive(userId, 'marketing');
            expect(result).toBe(false);
        });

        it('should always return true for security emails regardless of preference', async () => {
            mockRepo.findOne.mockResolvedValue({ ...defaultPrefs, securityEmails: false });
            const result = await service.canReceive(userId, 'security');
            expect(result).toBe(true); // security emails cannot be disabled
        });

        it('should return true when no userId is provided', async () => {
            const result = await service.canReceive('', 'order');
            expect(result).toBe(true);
            expect(mockRepo.findOne).not.toHaveBeenCalled();
        });

        it('should return false for shipping emails when opted out', async () => {
            mockRepo.findOne.mockResolvedValue({ ...defaultPrefs, shippingEmails: false });
            const result = await service.canReceive(userId, 'shipping');
            expect(result).toBe(false);
        });
    });
});
