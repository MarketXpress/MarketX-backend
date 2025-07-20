import { Test, TestingModule } from '@nestjs/testing';
import { MockStellarService } from './mocks/stellar.mocks';
import { EscrowStatus } from '../interfaces/escrow.interface';

describe('StellarService', () => {
  let mockStellarService: MockStellarService;

  beforeEach(async () => {
    mockStellarService = new MockStellarService();
  });

  describe('createAccount', () => {
    it('should create a new account with valid format', async () => {
      const accountId = await mockStellarService.createAccount();
      
      expect(accountId).toBeDefined();
      expect(accountId).toMatch(/^G[A-Z0-9]{6,}$/);
      expect(typeof accountId).toBe('string');
    });

    it('should create unique accounts on multiple calls', async () => {
      const account1 = await mockStellarService.createAccount();
      const account2 = await mockStellarService.createAccount();
      
      expect(account1).not.toBe(account2);
    });
  });

  describe('lockFunds', () => {
    it('should lock funds successfully with valid parameters', async () => {
      const { buyer, seller } = MockStellarService.getTestAccounts();
      const escrowId = 'test-escrow-1';
      const amount = 100;
      
      const txHash = await mockStellarService.lockFunds(
        buyer.address,
        seller.address,
        amount,
        escrowId
      );
      
      expect(txHash).toBe(`lock-tx-${escrowId}`);
      expect(typeof txHash).toBe('string');
    });

    it('should throw error for invalid buyer address', async () => {
      const { seller } = MockStellarService.getTestAccounts();
      
      await expect(
        mockStellarService.lockFunds(
          'INVALID_ADDRESS',
          seller.address,
          100,
          'test-escrow-1'
        )
      ).rejects.toThrow('Account INVALID_ADDRESS not found');
    });

    it('should throw error for invalid seller address', async () => {
      const { buyer } = MockStellarService.getTestAccounts();
      
      await expect(
        mockStellarService.lockFunds(
          buyer.address,
          'INVALID_ADDRESS',
          100,
          'test-escrow-1'
        )
      ).rejects.toThrow('Account INVALID_ADDRESS not found');
    });
  });

  describe('releaseFunds', () => {
    it('should release funds successfully after locking', async () => {
      const { buyer, seller } = MockStellarService.getTestAccounts();
      const escrowId = 'test-escrow-release';
      const amount = 100;
      
      // First lock funds
      await mockStellarService.lockFunds(
        buyer.address,
        seller.address,
        amount,
        escrowId
      );
      
      // Then release them
      const txHash = await mockStellarService.releaseFunds(
        escrowId,
        seller.address,
        amount
      );
      
      expect(txHash).toBe(`release-tx-${escrowId}`);
      expect(typeof txHash).toBe('string');
    });

    it('should throw error for non-existent escrow', async () => {
      const { seller } = MockStellarService.getTestAccounts();
      
      await expect(
        mockStellarService.releaseFunds(
          'non-existent-escrow',
          seller.address,
          100
        )
      ).rejects.toThrow('Escrow not found');
    });
  });

  describe('getAccountInfo', () => {
    it('should return account info for valid account', async () => {
      const { buyer } = MockStellarService.getTestAccounts();
      
      const accountInfo = await mockStellarService.getAccountInfo(buyer.address);
      
      expect(accountInfo).toBeDefined();
      expect(accountInfo.id).toBe(buyer.address);
      expect(accountInfo.balances).toBeDefined();
      expect(Array.isArray(accountInfo.balances)).toBe(true);
    });

    it('should throw error for invalid account', async () => {
      await expect(
        mockStellarService.getAccountInfo('INVALID_ADDRESS')
      ).rejects.toThrow('Account INVALID_ADDRESS not found');
    });
  });

  describe('verifyTransaction', () => {
    it('should verify existing transaction', async () => {
      const { buyer, seller } = MockStellarService.getTestAccounts();
      const escrowId = 'test-escrow-verify';
      
      // Create a transaction
      const txHash = await mockStellarService.lockFunds(
        buyer.address,
        seller.address,
        100,
        escrowId
      );
      
      // Verify it exists
      const isValid = await mockStellarService.verifyTransaction(txHash);
      expect(isValid).toBe(true);
    });

    it('should return false for non-existent transaction', async () => {
      const isValid = await mockStellarService.verifyTransaction('non-existent-tx');
      expect(isValid).toBe(false);
    });
  });

  describe('Static test data methods', () => {
    it('should return valid test accounts', () => {
      const accounts = MockStellarService.getTestAccounts();
      
      expect(accounts.buyer).toBeDefined();
      expect(accounts.seller).toBeDefined();
      expect(accounts.buyer.address).toBe('GABC123');
      expect(accounts.seller.address).toBe('GDEF456');
    });

    it('should return valid test transaction', () => {
      const transaction = MockStellarService.getTestTransaction();
      
      expect(transaction.txHash).toBeDefined();
      expect(transaction.amount).toBe('100');
      expect(transaction.source).toBe('GABC123');
      expect(transaction.destination).toBe('GDEF456');
    });

    it('should return valid escrow data', () => {
      const escrowData = MockStellarService.getEscrowData();
      
      expect(escrowData.escrowId).toBeDefined();
      expect(escrowData.status).toBe(EscrowStatus.LOCKED);
      expect(escrowData.amount).toBe('100');
      expect(escrowData.timeoutAt).toBeDefined();
    });
  });
});
