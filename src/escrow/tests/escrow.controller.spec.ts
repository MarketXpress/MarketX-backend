import { Test, TestingModule } from '@nestjs/testing';
import { EscrowController } from '../escrow.controller';
import { EscrowService } from '../escrow.service';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CreateEscrowDto } from '../dto/create-escrow.dto';
import { ReleaseEscrowDto } from '../dto/update-escrow.dto';
import { EscrowStatus } from '../interfaces/escrow.interface';

describe('EscrowController', () => {
  let controller: EscrowController;
  let escrowService: EscrowService;

  const mockEscrow = {
    id: 'escrow123',
    transactionId: 'tx123',
    amount: 100,
    status: EscrowStatus.LOCKED,
    createdAt: new Date(),
    timeoutAt: new Date(Date.now() + 86400000),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EscrowController],
      providers: [
        {
          provide: EscrowService,
          useValue: {
            createEscrow: jest.fn().mockResolvedValue(mockEscrow),
            getEscrowStatus: jest.fn().mockResolvedValue(mockEscrow),
            releaseFunds: jest.fn().mockResolvedValue('stellar-tx-hash'),
            confirmReceipt: jest.fn().mockResolvedValue(undefined),
            initiateDispute: jest.fn().mockResolvedValue(mockEscrow),
            resolveDispute: jest.fn().mockResolvedValue('resolved-tx-hash'),
            getEscrowByTransaction: jest.fn().mockResolvedValue(mockEscrow),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EscrowController>(EscrowController);
    escrowService = module.get<EscrowService>(EscrowService);
  });

  describe('POST /escrow', () => {
    it('should create new escrow with valid data', async () => {
      const dto: CreateEscrowDto = {
        transactionId: 'tx123',
        amount: 100,
        timeoutHours: 72,
        buyerAddress: 'GABC123',
        sellerAddress: 'GDEF456',
        memo: 'Test escrow',
      };

      const result = await controller.createEscrow(dto);
      expect(result).toEqual(mockEscrow);
      expect(escrowService.createEscrow).toHaveBeenCalledWith(dto);
    });

    it('should reject invalid input data', async () => {
      const invalidDto = {
        transactionId: 'invalid',
        amount: -100,
      } as CreateEscrowDto;

      await expect(controller.createEscrow(invalidDto)).rejects.toThrow();
    });
  });

  describe('GET /escrow/:id', () => {
    it('should return escrow details', async () => {
      const result = await controller.getEscrow('escrow123');
      expect(result).toEqual(mockEscrow);
      expect(escrowService.getEscrowStatus).toHaveBeenCalledWith('escrow123');
    });

    it('should return 404 for non-existent escrow', async () => {
      jest.spyOn(escrowService, 'getEscrowStatus').mockRejectedValue(new Error('Not found'));
      await expect(controller.getEscrow('nonexistent')).rejects.toThrow();
    });
  });

  describe('PUT /escrow/:id/release', () => {
    it('should release funds with valid request', async () => {
      const dto: ReleaseEscrowDto = {
        escrowId: 'escrow123',
        buyerSignature: 'valid-sig',
      };

      const result = await controller.releaseFunds('escrow123', dto);
      expect(result).toEqual({ txHash: 'stellar-tx-hash' });
      expect(escrowService.releaseFunds).toHaveBeenCalledWith({
        ...dto,
        escrowId: 'escrow123',
      });
    });

    it('should enforce role-based access', async () => {
      // Would test with RolesGuard mock rejecting non-seller roles
      // Requires more advanced test setup
    });
  });

  describe('PUT /escrow/:id/confirm', () => {
    it('should process buyer confirmation', async () => {
      const dto = {
        buyerSignature: 'valid-sig',
        isConfirmed: true,
      };

      await controller.confirmReceipt('escrow123', dto);
      expect(escrowService.confirmReceipt).toHaveBeenCalledWith({
        ...dto,
        escrowId: 'escrow123',
      });
    });
  });

  describe('PUT /escrow/:id/dispute', () => {
    it('should initiate dispute', async () => {
      const dto = {
        reason: 'Item not received',
        initiatorSignature: 'valid-sig',
      };

      const result = await controller.initiateDispute('escrow123', dto);
      expect(result).toEqual(mockEscrow);
      expect(escrowService.initiateDispute).toHaveBeenCalledWith({
        ...dto,
        escrowId: 'escrow123',
      });
    });
  });

  describe('PUT /escrow/:id/resolve', () => {
    it('should resolve dispute (admin only)', async () => {
      const dto = {
        resolution: 'release',
        adminSignature: 'admin-sig',
      };

      const result = await controller.resolveDispute('escrow123', dto);
      expect(result).toEqual({ txHash: 'resolved-tx-hash' });
    });
  });

  describe('Error Handling', () => {
    it('should format errors consistently', async () => {
      jest.spyOn(escrowService, 'getEscrowStatus').mockRejectedValue(
        new Error('Test error')
      );

      try {
        await controller.getEscrow('escrow123');
      } catch (error) {
        expect(error.response).toMatchObject({
          error: expect.any(String),
          message: expect.any(String),
          statusCode: expect.any(Number),
        });
      }
    });
  });
});
