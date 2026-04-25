import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EscrowService } from './escrow.service';
import { Repository } from 'typeorm';

describe('EscrowService - Transaction hash handling', () => {
  let service: EscrowService;
  let mockEscrowRepo: any;

  beforeEach(async () => {
    mockEscrowRepo = {
      findOneBy: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        {
          provide: getRepositoryToken(Object),
          useValue: mockEscrowRepo,
        },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
  });

  it('allows null transaction hash', async () => {
    const escrow = { id: 'escrow1', transactionHash: null };
    mockEscrowRepo.findOneBy.mockResolvedValue(escrow);
    mockEscrowRepo.save.mockImplementation(async (e: any) => e);

    const result = await service.assignTransactionHash('escrow1', null);
    expect(result.transactionHash).toBeNull();
  });

  it('saves valid transaction hash', async () => {
    const escrow = { id: 'escrow1', transactionHash: null };
    mockEscrowRepo.findOneBy.mockResolvedValue(escrow);
    mockEscrowRepo.save.mockImplementation(async (e: any) => e);

    const result = await service.assignTransactionHash('escrow1', '0xabc123');
    expect(result.transactionHash).toBe('0xabc123');
  });

  it('should throw if escrow not found', async () => {
    mockEscrowRepo.findOneBy.mockResolvedValue(null);
    await expect(
      service.assignTransactionHash('nonexistent', '0xabc'),
    ).rejects.toThrow('Escrow not found');
  });
});
