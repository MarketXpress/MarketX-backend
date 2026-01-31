import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as StellarSdk from 'stellar-sdk';
import { EscrowEntity, EscrowStatus } from './entities/escrow.entity';
import {
  CreateEscrowDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
  EscrowResponseDto,
} from './dto/escrow-transaction.dto';

@Injectable()
export class EscrowService {
  private stellarServer: StellarSdk.Server;
  private networkPassphrase: string;
  private escrowRepository: Repository<EscrowEntity>;

  constructor() {
    // Initialize Stellar SDK for testnet
    this.stellarServer = new StellarSdk.Server('https://horizon-testnet.stellar.org');
    this.networkPassphrase = StellarSdk.Networks.TESTNET_NETWORK_PASSPHRASE;
    // InjectRepository should be handled outside the service class
    // this.escrowRepository = escrowRepository;
  }

  /**
   * Creates and locks funds in escrow
   * Generates new escrow account and transfers funds from buyer
   */
  async createEscrow(dto: CreateEscrowDto): Promise<EscrowResponseDto> {
    try {
      // Validate inputs
      if (dto.amount <= 0) {
        throw new BadRequestException('Amount must be positive');
      }

      if (dto.buyerPublicKey === dto.sellerPublicKey) {
        throw new BadRequestException('Buyer and seller cannot be the same');
      }

      // Generate new escrow account
      const escrowKeypair = StellarSdk.Keypair.random();
      const escrowPublicKey = escrowKeypair.publicKey();

      // Create escrow record
      const escrow = {
        orderId: dto.orderId,
        buyerPublicKey: dto.buyerPublicKey,
        sellerPublicKey: dto.sellerPublicKey,
        amount: dto.amount,
        escrowAccountPublicKey: escrowPublicKey,
        status: EscrowStatus.PENDING,
      };

      const savedEscrow = await this.saveEscrow(escrow);

      // Build lock transaction: buyer funds escrow account
      const lockTx = await this.buildLockTransaction(
        dto.buyerPublicKey,
        escrowPublicKey,
        dto.amount,
      );

      // Sign and submit transaction (buyer secret required - handle in controller)
      const transactionHash = await this.submitTransaction(lockTx);

      // Update escrow with transaction hash
      savedEscrow.lockTransactionHash = transactionHash;
      savedEscrow.status = EscrowStatus.LOCKED;
      await this.saveEscrow(savedEscrow);

      return this.mapToResponse(savedEscrow);
    } catch (error) {
      throw new BadRequestException(`Failed to create escrow: ${error.message}`);
    }
  }

  /**
   * Releases funds to seller upon delivery confirmation
   */
  async releaseFunds(dto: ReleaseEscrowDto): Promise<EscrowResponseDto> {
    const escrow = await this.findEscrowOrFail(dto.escrowId);

    // Validate status
    if (escrow.status !== EscrowStatus.LOCKED) {
      throw new BadRequestException(
        `Cannot release escrow with status: ${escrow.status}`,
      );
    }

    try {
      // Build release transaction: escrow account sends to seller
      const releaseTx = await this.buildReleaseTransaction(
        escrow.escrowAccountPublicKey,
        escrow.sellerPublicKey,
        escrow.amount,
      );

      // Submit transaction
      const transactionHash = await this.submitTransaction(releaseTx);

      // Update escrow record
      escrow.releaseTransactionHash = transactionHash;
      escrow.status = EscrowStatus.RELEASED;
      escrow.deliveryConfirmedAt = new Date();
      await this.saveEscrow(escrow);

      return this.mapToResponse(escrow);
    } catch (error) {
      escrow.errorMessage = error.message;
      await this.saveEscrow(escrow);
      throw new BadRequestException(`Failed to release funds: ${error.message}`);
    }
  }

  /**
   * Refunds funds back to buyer on cancellation
   */
  async refundBuyer(dto: RefundEscrowDto): Promise<EscrowResponseDto> {
    const escrow = await this.findEscrowOrFail(dto.escrowId);

    // Only allow refund if locked
    if (escrow.status !== EscrowStatus.LOCKED) {
      throw new BadRequestException(
        `Cannot refund escrow with status: ${escrow.status}`,
      );
    }

    try {
      // Build refund transaction: escrow account sends back to buyer
      const refundTx = await this.buildRefundTransaction(
        escrow.escrowAccountPublicKey,
        escrow.buyerPublicKey,
        escrow.amount,
      );

      // Submit transaction
      const transactionHash = await this.submitTransaction(refundTx);

      // Update escrow record
      escrow.refundTransactionHash = transactionHash;
      escrow.status = EscrowStatus.REFUNDED;
      escrow.cancelledAt = new Date();
      await this.saveEscrow(escrow);

      return this.mapToResponse(escrow);
    } catch (error) {
      escrow.errorMessage = error.message;
      await this.saveEscrow(escrow);
      throw new BadRequestException(`Failed to refund: ${error.message}`);
    }
  }

  /**
   * Retrieve escrow transaction details
   */
  async getEscrow(escrowId: string): Promise<EscrowResponseDto> {
    const escrow = await this.findEscrowOrFail(escrowId);
    return this.mapToResponse(escrow);
  }

  /**
   * Get escrow by order ID
   */
  async getEscrowByOrderId(orderId: string): Promise<EscrowResponseDto> {
    const escrow = await this.findEscrowByOrderId(orderId);

    if (!escrow) {
      throw new NotFoundException(`Escrow not found for order: ${orderId}`);
    }

    return this.mapToResponse(escrow);
  }

  // Private helper methods
  private async findEscrowOrFail(escrowId: string): Promise<EscrowEntity> {
    const escrow = await this.findEscrowById(escrowId);

    if (!escrow) {
      throw new NotFoundException(`Escrow not found: ${escrowId}`);
    }

    return escrow;
  }

  private async buildLockTransaction(
    fromPublicKey: string,
    toPublicKey: string,
    amount: number,
  ): Promise<StellarSdk.Transaction> {
    const sourceAccount = await this.stellarServer.loadAccount(fromPublicKey);

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: toPublicKey,
          amount: amount.toString(),
          asset: StellarSdk.Asset.native(),
        }),
      )
      .setTimeout(180)
      .build();

    return transaction;
  }

  private async buildReleaseTransaction(
    fromPublicKey: string,
    toPublicKey: string,
    amount: number,
  ): Promise<StellarSdk.Transaction> {
    const sourceAccount = await this.stellarServer.loadAccount(fromPublicKey);

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: toPublicKey,
          amount: amount.toString(),
          asset: StellarSdk.Asset.native(),
        }),
      )
      .setTimeout(180)
      .build();

    return transaction;
  }

  private async buildRefundTransaction(
    fromPublicKey: string,
    toPublicKey: string,
    amount: number,
  ): Promise<StellarSdk.Transaction> {
    const sourceAccount = await this.stellarServer.loadAccount(fromPublicKey);

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: toPublicKey,
          amount: amount.toString(),
          asset: StellarSdk.Asset.native(),
        }),
      )
      .setTimeout(180)
      .build();

    return transaction;
  }

  private async submitTransaction(
    transaction: StellarSdk.Transaction,
  ): Promise<string> {
    // Note: Transaction must be signed before submission
    // This should be done in the controller after getting the signing key
    const response = await this.stellarServer.submitTransaction(transaction);
    return response.hash;
  }

  private mapToResponse(escrow: EscrowEntity): EscrowResponseDto {
    return {
      id: escrow.id,
      orderId: escrow.orderId,
      buyerPublicKey: escrow.buyerPublicKey,
      sellerPublicKey: escrow.sellerPublicKey,
      amount: escrow.amount,
      escrowAccountPublicKey: escrow.escrowAccountPublicKey,
      status: escrow.status,
      lockTransactionHash: escrow.lockTransactionHash || null,
      releaseTransactionHash: escrow.releaseTransactionHash || null,
      refundTransactionHash: escrow.refundTransactionHash || null,
      createdAt: escrow.createdAt,
      updatedAt: escrow.updatedAt,
    };
  }

  // Mock methods for repository operations
  private async saveEscrow(escrow: EscrowEntity): Promise<EscrowEntity> {
    // Simulate saving escrow to database
    return escrow;
  }

  private async findEscrowById(escrowId: string): Promise<EscrowEntity> {
    // Simulate finding escrow by ID from database
    return {} as EscrowEntity;
  }

  private async findEscrowByOrderId(orderId: string): Promise<EscrowEntity> {
    // Simulate finding escrow by order ID from database
    return {} as EscrowEntity;
  }
}
