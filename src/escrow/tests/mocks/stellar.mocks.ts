import { EscrowStatus } from '../../interfaces/escrow.interface';

export class MockStellarService {
  private testAccounts = new Map<string, any>();
  private testTransactions = new Map<string, any>();
  private escrowStates = new Map<string, EscrowStatus>();

  constructor() {
    // Initialize with test accounts
    this.testAccounts.set('GABC123', {
      id: 'GABC123',
      balances: [{ asset_type: 'native', balance: '1000' }],
      sequence: '1',
    });

    this.testAccounts.set('GDEF456', {
      id: 'GDEF456',
      balances: [{ asset_type: 'native', balance: '500' }],
      sequence: '1',
    });

    // Initialize escrow states
    this.escrowStates.set('escrow1', EscrowStatus.LOCKED);
  }

  // Mock account creation
  async createAccount(): Promise<string> {
    const newAccountId = `G${Math.random().toString(36).substring(2, 37).toUpperCase()}`;
    this.testAccounts.set(newAccountId, {
      id: newAccountId,
      balances: [{ asset_type: 'native', balance: '0' }],
      sequence: '1',
    });
    return newAccountId;
  }

  // Mock fund locking
  async lockFunds(
    buyerAddress: string,
    sellerAddress: string,
    amount: number,
    escrowId: string
  ): Promise<string> {
    this.validateAccount(buyerAddress);
    this.validateAccount(sellerAddress);

    const txHash = `lock-tx-${escrowId}`;
    this.testTransactions.set(txHash, {
      source: buyerAddress,
      destination: sellerAddress,
      amount,
      escrowId,
      status: 'pending',
    });

    this.escrowStates.set(escrowId, EscrowStatus.LOCKED);

    return txHash;
  }

  // Mock fund release
  async releaseFunds(
    escrowId: string,
    recipientAddress: string,
    amount: number
  ): Promise<string> {
    if (!this.escrowStates.has(escrowId)) {
      throw new Error('Escrow not found');
    }

    const txHash = `release-tx-${escrowId}`;
    this.testTransactions.set(txHash, {
      escrowId,
      recipient: recipientAddress,
      amount,
      status: 'completed',
    });

    this.escrowStates.set(escrowId, EscrowStatus.RELEASED);

    return txHash;
  }

  // Mock account info retrieval
  async getAccountInfo(accountId: string): Promise<any> {
    this.validateAccount(accountId);
    return this.testAccounts.get(accountId);
  }

  // Mock transaction verification
  async verifyTransaction(txHash: string): Promise<boolean> {
    return this.testTransactions.has(txHash);
  }

  // Helper to validate test accounts
  private validateAccount(accountId: string): void {
    if (!this.testAccounts.has(accountId)) {
      throw new Error(`Account ${accountId} not found`);
    }
  }

  // Test data fixtures
  static getTestAccounts() {
    return {
      buyer: {
        address: 'GABC123',
        secret: 'SABC123',
        balance: '1000',
      },
      seller: {
        address: 'GDEF456',
        secret: 'SDEF456',
        balance: '500',
      },
    };
  }

  static getTestTransaction() {
    return {
      txHash: 'test-tx-hash',
      amount: '100',
      source: 'GABC123',
      destination: 'GDEF456',
      memo: 'Test transaction',
    };
  }

  static getEscrowData() {
    return {
      escrowId: 'test-escrow-1',
      status: EscrowStatus.LOCKED,
      amount: '100',
      timeoutAt: new Date(Date.now() + 86400000).toISOString(),
    };
  }
}
