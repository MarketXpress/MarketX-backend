import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EscrowService } from '../escrow.service';
import { Escrow, EscrowStatus } from '../escrow.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { TransactionsService } from '../../transactions/transactions.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';

// Mock User entity for testing
class MockUser {
  id: number;
  stellarAddress: string;
  username: string;
}

describe('Escrow Integration', () => {
  let module: TestingModule;
  let escrowService: EscrowService;
  let transactionsService: TransactionsService;
  let dataSource: DataSource;
  let escrowRepository;
  let transactionRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.test',
          isGlobal: true,
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USERNAME || 'test',
          password: process.env.DB_PASSWORD || 'test',
          database: (process.env.DB_NAME || 'test') + '_test',
          entities: [Escrow, Transaction],
          synchronize: true,
          dropSchema: true,
        }),
        ScheduleModule.forRoot(),
        TypeOrmModule.forFeature([Escrow, Transaction]),
      ],
      providers: [
        EscrowService,
        TransactionsService,
        ConfigService,
        SchedulerRegistry,
      ],
    }).compile();

    escrowService = module.get<EscrowService>(EscrowService);
    transactionsService = module.get<TransactionsService>(TransactionsService);
    dataSource = module.get<DataSource>(DataSource);
    escrowRepository = module.get(getRepositoryToken(Escrow));
    transactionRepository = module.get(getRepositoryToken(Transaction));
  });

  afterEach(async () => {
    await escrowRepository.delete({});
    await transactionRepository.delete({});
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Complete Escrow Flow', () => {
    it('should execute full escrow lifecycle', async () => {
      // 1. Create mock users
      const mockSender = {
        id: 1,
        stellarAddress: 'GABC123',
        username: 'buyer'
      };
      const mockReceiver = {
        id: 2,
        stellarAddress: 'GDEF456',
        username: 'seller'
      };

      // 2. Create Transaction directly in repository (since createTransactionWithEscrow requires escrow)
      const transaction = await transactionRepository.save({
        amount: 100,
        senderId: 1,
        receiverId: 2,
        useEscrow: true,
        status: 'pending',
        sender: mockSender,
        receiver: mockReceiver,
        createdAt: new Date(),
      });

      // 3. Create Escrow
      const escrow = await escrowService.createEscrow({
        transactionId: transaction.id,
        amount: 100,
        timeoutHours: 24,
        buyerAddress: 'GABC123',
        sellerAddress: 'GDEF456',
        memo: 'Integration test',
      });

      expect(escrow.status).toBe(EscrowStatus.LOCKED);

      // 4. Verify database state
      const dbEscrow = await escrowRepository.findOneBy({ id: escrow.id });
      expect(dbEscrow.amount).toBe(100);
      expect(dbEscrow.transactionId).toBe(transaction.id);

      // 5. Release Funds (using the actual method from your service)
      const txHash = await escrowService.releaseFunds({
        escrowId: escrow.id,
        buyerSignature: `CONFIRM_TX_${transaction.id}`,
      });

      expect(txHash).toBe(`stellar-release-tx-${escrow.id}`);

      // 6. Verify final state
      const releasedEscrow = await escrowRepository.findOneBy({ id: escrow.id });
      expect(releasedEscrow.status).toBe(EscrowStatus.RELEASED);
      expect(releasedEscrow.releasedAt).toBeDefined();
    });
  });

  describe('Stellar Integration', () => {
    it('should handle fund locking failure', async () => {
      // Mock the StellarService to throw an error
      const originalLockFunds = escrowService['stellarService'].lockFunds;
      escrowService['stellarService'].lockFunds = jest.fn().mockRejectedValue(new Error('Stellar error'));

      await expect(
        escrowService.createEscrow({
          transactionId: 'tx-fail',
          amount: 100,
          timeoutHours: 24,
          buyerAddress: 'GABC123',
          sellerAddress: 'GDEF456',
          memo: 'Should fail',
        }),
      ).rejects.toThrow('Failed to create escrow');

      // Verify no escrow record persisted
      const escrows = await escrowRepository.find();
      expect(escrows.length).toBe(0);

      // Restore original method
      escrowService['stellarService'].lockFunds = originalLockFunds;
    });
  });

  describe('Database Consistency', () => {
    it('should maintain consistency during concurrent operations', async () => {
      const mockSender = {
        id: 1,
        stellarAddress: 'GABC123',
        username: 'buyer'
      };
      const mockReceiver = {
        id: 2,
        stellarAddress: 'GDEF456',
        username: 'seller'
      };

      const transaction = await transactionRepository.save({
        amount: 200,
        senderId: 1,
        receiverId: 2,
        useEscrow: true,
        status: 'pending',
        sender: mockSender,
        receiver: mockReceiver,
        createdAt: new Date(),
      });

      // Simulate concurrent release attempts
      const escrow = await escrowService.createEscrow({
        transactionId: transaction.id,
        amount: 200,
        timeoutHours: 24,
        buyerAddress: 'GABC123',
        sellerAddress: 'GDEF456',
        memo: 'Concurrency test',
      });

      // Use Promise.allSettled instead of Promise.all to handle expected failures
      const results = await Promise.allSettled([
        escrowService.releaseFunds({
          escrowId: escrow.id,
          buyerSignature: `CONFIRM_TX_${transaction.id}`,
        }),
        escrowService.releaseFunds({
          escrowId: escrow.id,
          buyerSignature: `CONFIRM_TX_${transaction.id}`,
        }),
      ]);

      // At least one should succeed
      const successCount = results.filter(result => result.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThanOrEqual(1);

      // Final state should be released
      const finalEscrow = await escrowRepository.findOneBy({ id: escrow.id });
      expect(finalEscrow.status).toBe(EscrowStatus.RELEASED);
    });
  });

  describe('Timeout Handling', () => {
    it('should auto-release after timeout', async () => {
      const mockSender = {
        id: 1,
        stellarAddress: 'GABC123',
        username: 'buyer'
      };
      const mockReceiver = {
        id: 2,
        stellarAddress: 'GDEF456',
        username: 'seller'
      };

      const transaction = await transactionRepository.save({
        amount: 150,
        senderId: 1,
        receiverId: 2,
        useEscrow: true,
        status: 'pending',
        sender: mockSender,
        receiver: mockReceiver,
        createdAt: new Date(),
      });

      const escrow = await escrowService.createEscrow({
        transactionId: transaction.id,
        amount: 150,
        timeoutHours: 0.01, // 36 seconds for testing
        buyerAddress: 'GABC123',
        sellerAddress: 'GDEF456',
        memo: 'Timeout test',
      });

      // Manually trigger auto-release (instead of waiting)
      await escrowService.handleAutoRelease();

      // Verify auto-release occurred
      const updatedEscrow = await escrowRepository.findOneBy({ id: escrow.id });
      expect(updatedEscrow.status).toBe(EscrowStatus.RELEASED);
    });
  });

  describe('Transaction Service Integration', () => {
    it('should create transaction with escrow using createTransactionWithEscrow', async () => {
      const mockSender = {
        id: 1,
        stellarAddress: 'GABC123',
        username: 'buyer'
      };
      const mockReceiver = {
        id: 2,
        stellarAddress: 'GDEF456',
        username: 'seller'
      };

      const transactionData = {
        amount: 100,
        senderId: 1,
        receiverId: 2,
        useEscrow: true,
        status: 'pending',
        sender: mockSender,
        receiver: mockReceiver,
      };

      const transaction = await transactionsService.createTransactionWithEscrow(transactionData);

      expect(transaction.amount).toBe(100);
      expect(transaction.useEscrow).toBe(true);
      expect(transaction.escrowId).toBeDefined();
      expect(transaction.escrowStatus).toBe(EscrowStatus.LOCKED);
    });

    it('should complete transaction through transaction service', async () => {
      const mockSender = {
        id: 1,
        stellarAddress: 'GABC123',
        username: 'buyer'
      };
      const mockReceiver = {
        id: 2,
        stellarAddress: 'GDEF456',
        username: 'seller'
      };

      const transactionData = {
        amount: 100,
        senderId: 1,
        receiverId: 2,
        useEscrow: true,
        status: 'pending',
        sender: mockSender,
        receiver: mockReceiver,
      };

      const transaction = await transactionsService.createTransactionWithEscrow(transactionData);

      // Complete transaction through service
      await transactionsService.completeTransaction(transaction.id);

      // Verify escrow was released
      const escrow = await escrowRepository.findOneBy({ id: transaction.escrowId });
      expect(escrow.status).toBe(EscrowStatus.RELEASED);
    });
  });

  describe('Dispute Resolution', () => {
    it('should handle dispute initiation and resolution', async () => {
      const mockSender = {
        id: 1,
        stellarAddress: 'GABC123',
        username: 'buyer'
      };
      const mockReceiver = {
        id: 2,
        stellarAddress: 'GDEF456',
        username: 'seller'
      };

      const transaction = await transactionRepository.save({
        amount: 100,
        senderId: 1,
        receiverId: 2,
        useEscrow: true,
        status: 'pending',
        sender: mockSender,
        receiver: mockReceiver,
        createdAt: new Date(),
      });

      const escrow = await escrowService.createEscrow({
        transactionId: transaction.id,
        amount: 100,
        timeoutHours: 24,
        buyerAddress: 'GABC123',
        sellerAddress: 'GDEF456',
        memo: 'Dispute test',
      });

      // Initiate dispute
      const disputedEscrow = await escrowService.initiateDispute({
        escrowId: escrow.id,
        reason: 'Item not received',
        initiatorSignature: 'buyer-signature',
      });

      expect(disputedEscrow.status).toBe(EscrowStatus.DISPUTED);
      expect(disputedEscrow.disputeReason).toBe('Item not received');

      // Resolve dispute with refund
      const txHash = await escrowService.resolveDispute(escrow.id, 'refund');

      expect(txHash).toBe(`stellar-release-tx-${escrow.id}`);

      const resolvedEscrow = await escrowRepository.findOneBy({ id: escrow.id });
      expect(resolvedEscrow.status).toBe(EscrowStatus.REFUNDED);
    });
  });

  describe('Partial Release', () => {
    it('should handle partial fund release', async () => {
      const mockSender = {
        id: 1,
        stellarAddress: 'GABC123',
        username: 'buyer'
      };
      const mockReceiver = {
        id: 2,
        stellarAddress: 'GDEF456',
        username: 'seller'
      };

      const transaction = await transactionRepository.save({
        amount: 100,
        senderId: 1,
        receiverId: 2,
        useEscrow: true,
        status: 'pending',
        sender: mockSender,
        receiver: mockReceiver,
        createdAt: new Date(),
      });

      const escrow = await escrowService.createEscrow({
        transactionId: transaction.id,
        amount: 100,
        timeoutHours: 24,
        buyerAddress: 'GABC123',
        sellerAddress: 'GDEF456',
        memo: 'Partial release test',
      });

      // Partial release
      const txHash = await escrowService.handlePartialRelease({
        escrowId: escrow.id,
        amount: 50,
        recipientAddress: 'GDEF456',
        reason: 'Partial delivery',
      });

      expect(txHash).toBe(`stellar-release-tx-${escrow.id}`);

      // Verify remaining amount
      const updatedEscrow = await escrowRepository.findOneBy({ id: escrow.id });
      expect(updatedEscrow.amount).toBe(50);
    });
  });
});
