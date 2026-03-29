import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { EmailPreferenceService } from './email-preference.service';
import { EmailLog, EmailStatus } from './entities/email-log.entity';

describe('EmailService', () => {
    let service: EmailService;
    let mockQueue: any;
    let mockEmailLogRepo: any;
    let mockPreferenceService: any;
    let mockConfigService: any;

    const mockLog: Partial<EmailLog> = {
        id: 'log-123',
        to: 'test@example.com',
        template: 'order-confirmation',
        subject: 'Your Order Confirmed!',
        status: EmailStatus.QUEUED,
        attempts: 0,
    };

    beforeEach(async () => {
        mockQueue = {
            add: jest.fn().mockResolvedValue({ id: 'job-1' }),
        };

        mockEmailLogRepo = {
            create: jest.fn().mockReturnValue(mockLog),
            save: jest.fn().mockResolvedValue(mockLog),
            findOne: jest.fn().mockResolvedValue(mockLog),
        };

        mockPreferenceService = {
            canReceive: jest.fn().mockResolvedValue(true),
        };

        mockConfigService = {
            get: jest.fn((key: string) => {
                const values: Record<string, string> = {
                    SENDGRID_API_KEY: '',          // dry-run mode
                    EMAIL_FROM: 'noreply@marketx.com',
                    APP_URL: 'https://marketx.com',
                };
                return values[key] ?? null;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EmailService,
                { provide: ConfigService, useValue: mockConfigService },
                { provide: getQueueToken('email'), useValue: mockQueue },
                { provide: getRepositoryToken(EmailLog), useValue: mockEmailLogRepo },
                { provide: EmailPreferenceService, useValue: mockPreferenceService },
            ],
        }).compile();

        service = module.get<EmailService>(EmailService);
    });

    afterEach(() => jest.clearAllMocks());

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('queueEmail()', () => {
        it('should create a log record and add a Bull job', async () => {
            const dto = {
                to: 'buyer@example.com',
                subject: 'Test Subject',
                template: 'order-confirmation',
                context: { name: 'Buyer' },
                userId: 'user-1',
            };

            const result = await service.queueEmail(dto);

            expect(mockEmailLogRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: dto.to,
                    template: dto.template,
                    subject: dto.subject,
                    status: EmailStatus.QUEUED,
                    userId: dto.userId,
                }),
            );
            expect(mockEmailLogRepo.save).toHaveBeenCalled();
            expect(mockQueue.add).toHaveBeenCalledWith(
                'send-email',
                expect.objectContaining({ to: dto.to, logId: mockLog.id }),
                expect.any(Object),
            );
            expect(result).toMatchObject({ id: mockLog.id });
        });
    });

    describe('sendOrderConfirmation()', () => {
        it('should check preferences and queue an order email', async () => {
            await service.sendOrderConfirmation({
                userId: 'user-1',
                to: 'buyer@example.com',
                name: 'Jane',
                orderId: 'ord-abc',
                orderNumber: 'ORD-00000001',
                total: 49.99,
                currency: 'USD',
                items: [{ productName: 'Widget', quantity: 2, price: 24.99, subtotal: 49.98 }],
                trackingUrl: 'https://marketx.com/orders/ord-abc',
            });

            expect(mockPreferenceService.canReceive).toHaveBeenCalledWith('user-1', 'order');
            expect(mockQueue.add).toHaveBeenCalledWith(
                'send-email',
                expect.objectContaining({ template: 'order-confirmation' }),
                expect.any(Object),
            );
        });

        it('should skip sending if user opted out of order emails', async () => {
            mockPreferenceService.canReceive.mockResolvedValue(false);

            await service.sendOrderConfirmation({
                userId: 'user-1',
                to: 'buyer@example.com',
                name: 'Jane',
                orderId: 'ord-abc',
                orderNumber: 'ORD-00000001',
                total: 49.99,
                currency: 'USD',
                items: [],
                trackingUrl: 'https://marketx.com/orders/ord-abc',
            });

            expect(mockQueue.add).not.toHaveBeenCalled();
        });
    });

    describe('sendPasswordReset()', () => {
        it('should queue a password-reset email without checking preferences', async () => {
            await service.sendPasswordReset({
                userId: 'user-2',
                to: 'user@example.com',
                name: 'Alice',
                resetUrl: 'https://marketx.com/reset-password?token=abc123',
                expiryTime: '15 minutes',
            });

            // Security emails bypass preference checks
            expect(mockPreferenceService.canReceive).not.toHaveBeenCalled();
            expect(mockQueue.add).toHaveBeenCalledWith(
                'send-email',
                expect.objectContaining({ template: 'password-reset' }),
                expect.any(Object),
            );
        });
    });

    describe('sendShippingUpdate()', () => {
        it('should check preferences and queue a shipping email', async () => {
            await service.sendShippingUpdate({
                userId: 'user-3',
                to: 'shopper@example.com',
                name: 'Bob',
                orderId: 'ord-xyz',
                orderNumber: 'ORD-00000002',
                trackingNumber: '1Z999AA1012345678',
                carrier: 'UPS',
                trackingUrl: 'https://ups.com/track?tracknum=1Z999AA1012345678',
            });

            expect(mockPreferenceService.canReceive).toHaveBeenCalledWith('user-3', 'shipping');
            expect(mockQueue.add).toHaveBeenCalledWith(
                'send-email',
                expect.objectContaining({ template: 'shipping-update' }),
                expect.any(Object),
            );
        });
    });

    describe('sendWelcome()', () => {
        it('should queue a welcome email for new users', async () => {
            await service.sendWelcome({
                userId: 'user-4',
                to: 'newuser@example.com',
                name: 'Charlie',
                loginUrl: 'https://marketx.com/login',
            });

            expect(mockPreferenceService.canReceive).toHaveBeenCalledWith('user-4', 'account');
            expect(mockQueue.add).toHaveBeenCalledWith(
                'send-email',
                expect.objectContaining({ template: 'welcome' }),
                expect.any(Object),
            );
        });
    });

    describe('trackDeliveryEvent()', () => {
        it('should update email log status to DELIVERED on delivery event', async () => {
            const deliveredLog = { ...mockLog, messageId: 'msg-abc', status: EmailStatus.SENT };
            mockEmailLogRepo.findOne.mockResolvedValue(deliveredLog);

            await service.trackDeliveryEvent({
                sg_message_id: 'msg-abc.filter0',
                event: 'delivered',
                email: 'buyer@example.com',
                timestamp: Math.floor(Date.now() / 1000),
            });

            expect(mockEmailLogRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ status: EmailStatus.DELIVERED }),
            );
        });

        it('should update log status to BOUNCED on bounce event', async () => {
            const bouncedLog = { ...mockLog, messageId: 'msg-xyz', status: EmailStatus.SENT };
            mockEmailLogRepo.findOne.mockResolvedValue(bouncedLog);

            await service.trackDeliveryEvent({
                sg_message_id: 'msg-xyz.filter0',
                event: 'bounce',
                email: 'bad@nxdomain.com',
                timestamp: Math.floor(Date.now() / 1000),
                reason: '550 User unknown',
            });

            expect(mockEmailLogRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ status: EmailStatus.BOUNCED, errorMessage: '550 User unknown' }),
            );
        });

        it('should do nothing for open/click events', async () => {
            await service.trackDeliveryEvent({
                sg_message_id: 'msg-open.filter0',
                event: 'open',
                email: 'user@example.com',
                timestamp: Math.floor(Date.now() / 1000),
            });

            expect(mockEmailLogRepo.save).not.toHaveBeenCalled();
        });

        it('should handle missing log gracefully', async () => {
            mockEmailLogRepo.findOne.mockResolvedValue(null);

            await expect(
                service.trackDeliveryEvent({
                    sg_message_id: 'nonexistent.filter0',
                    event: 'delivered',
                    email: 'someone@example.com',
                    timestamp: Math.floor(Date.now() / 1000),
                }),
            ).resolves.not.toThrow();
        });
    });

    describe('sendMail() — dry-run mode', () => {
        it('should log the email and update log to SENT in dry-run mode', async () => {
            // In dry-run mode (no API key), sendMail should not throw
            // We need to mock fs.existsSync + readFileSync for template resolution
            const mockSaved = { ...mockLog, status: EmailStatus.SENT };
            mockEmailLogRepo.findOne.mockResolvedValue({ ...mockLog });
            mockEmailLogRepo.save.mockResolvedValue(mockSaved);

            // Provide a simple template so renderTemplate doesn't need disk access
            jest.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
            jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
            jest.spyOn(require('fs'), 'readFileSync').mockReturnValue('<p>Hello {{name}}</p>');

            await expect(
                service.sendMail({
                    to: 'test@example.com',
                    subject: 'Test',
                    template: 'order-confirmation',
                    context: { name: 'Test' },
                    logId: 'log-123',
                }),
            ).resolves.not.toThrow();
        });
    });
});
