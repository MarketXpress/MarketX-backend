import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import { EscrowEntity, EscrowStatus } from './entities/escrow.entity';
import {
  CreateEscrowDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
  EscrowResponseDto,
} from './dto/escrow-transaction.dto';

@Injectable()
export class EscrowService {
  private stellarServer: StellarSdk.Horizon.Server;
  private networkPassphrase: string;

  constructor(
    @InjectRepository(EscrowEntity)
    private readonly escrowRepository: Repository<EscrowEntity>,
  ) {
    this.stellarServer = new StellarSdk.Horizon.Server(
      'https://horizon-testnet.stellar.org',
    );
    this.networkPassphrase = StellarSdk.Networks.TESTNET;
  }

  /**
   * =========================
   * CREATE ESCROW
   * =========================
   */
  async createEscrow(dto: CreateEscrowDto): Promise<EscrowResponseDto> {
    if (dto.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    if (dto.buyerPublicKey === dto.sellerPublicKey) {
      throw new BadRequestException('Buyer and seller cannot be the same');
    }

    const escrowKeypair = StellarSdk.Keypair.random();

    const escrow = this.escrowRepository.create({
      orderId: dto.orderId,
      buyerPublicKey: dto.buyerPublicKey,
      sellerPublicKey: dto.sellerPublicKey,
      amount: dto.amount,
      escrowAccountPublicKey: escrowKeypair.publicKey(),
      status: EscrowStatus.PENDING,
    });

    const savedEscrow = await this.escrowRepository.save(escrow);

    const lockTx = await this.buildTransaction(
      dto.buyerPublicKey,
      escrow.escrowAccountPublicKey,
      dto.amount,
    );

    const txHash = await this.submitTransaction(lockTx);

    savedEscrow.lockTransactionHash = txHash;
    savedEscrow.status = EscrowStatus.LOCKED;

    await this.escrowRepository.save(savedEscrow);

    return this.mapToResponse(savedEscrow);
  }

  /**
   * =========================
   * FULL RELEASE
   * =========================
   */
  async releaseFunds(dto: ReleaseEscrowDto): Promise<EscrowResponseDto> {
    const escrow = await this.findEscrowOrFail(dto.escrowId);

    if (escrow.status !== EscrowStatus.LOCKED) {
      throw new BadRequestException(
        `Cannot release escrow with status: ${escrow.status}`,
      );
    }

    const tx = await this.buildTransaction(
      escrow.escrowAccountPublicKey,
      escrow.sellerPublicKey,
      escrow.amount,
    );

    const hash = await this.submitTransaction(tx);

    escrow.releaseTransactionHash = hash;
    escrow.status = EscrowStatus.RELEASED;
    escrow.deliveryConfirmedAt = new Date();

    await this.escrowRepository.save(escrow);

    this.emitFundsReleasedEvent(escrow);

    return this.mapToResponse(escrow);
  }

  /**
   * =========================
   * 🔥 PARTIAL RELEASE (NEW)
   * =========================
   */
  async releasePartial(
    escrowId: string,
    releasedAmount: number,
  ): Promise<EscrowResponseDto> {
    const escrow = await this.findEscrowOrFail(escrowId);

    if (escrow.status !== EscrowStatus.LOCKED) {
      throw new BadRequestException(
        `Cannot partially release escrow with status: ${escrow.status}`,
      );
    }

    if (releasedAmount <= 0) {
      throw new BadRequestException('Released amount must be positive');
    }

    if (releasedAmount > escrow.amount) {
      throw new BadRequestException(
        'Released amount exceeds escrow balance',
      );
    }

    const refundAmount = escrow.amount - releasedAmount;

    try {
      /**
       * 1. Pay seller (partial)
       */
      const releaseTx = await this.buildTransaction(
        escrow.escrowAccountPublicKey,
        escrow.sellerPublicKey,
        releasedAmount,
      );

      const releaseHash = await this.submitTransaction(releaseTx);

      /**
       * 2. Refund buyer (remaining)
       */
      let refundHash: string | null = null;

      if (refundAmount > 0) {
        const refundTx = await this.buildTransaction(
          escrow.escrowAccountPublicKey,
          escrow.buyerPublicKey,
          refundAmount,
        );

        refundHash = await this.submitTransaction(refundTx);
      }

      /**
       * 3. Update DB
       */
      escrow.releaseTransactionHash = releaseHash;
      escrow.refundTransactionHash = refundHash;

      (escrow as any).releasedAmount = releasedAmount;
      (escrow as any).refundedAmount = refundAmount;

      escrow.status =
        refundAmount > 0
          ? EscrowStatus.PARTIALLY_RELEASED
          : EscrowStatus.RELEASED;

      await this.escrowRepository.save(escrow);

      this.emitFundsReleasedEvent(escrow);

      return this.mapToResponse(escrow);
    } catch (error) {
      escrow.errorMessage = error.message;
      await this.escrowRepository.save(escrow);

      throw new BadRequestException(
        `Failed partial release: ${error.message}`,
      );
    }
  }

  /**
   * =========================
   * REFUND FULL
   * =========================
   */
  async refundBuyer(dto: RefundEscrowDto): Promise<EscrowResponseDto> {
    const escrow = await this.findEscrowOrFail(dto.escrowId);

    if (escrow.status !== EscrowStatus.LOCKED) {
      throw new BadRequestException(
        `Cannot refund escrow with status: ${escrow.status}`,
      );
    }

    const tx = await this.buildTransaction(
      escrow.escrowAccountPublicKey,
      escrow.buyerPublicKey,
      escrow.amount,
    );

    const hash = await this.submitTransaction(tx);

    escrow.refundTransactionHash = hash;
    escrow.status = EscrowStatus.REFUNDED;
    escrow.cancelledAt = new Date();

    await this.escrowRepository.save(escrow);

    return this.mapToResponse(escrow);
  }

  /**
   * =========================
   * HELPERS
   * =========================
   */

  private async findEscrowOrFail(id: string): Promise<EscrowEntity> {
    const escrow = await this.escrowRepository.findOne({ where: { id } });

    if (!escrow) {
      throw new NotFoundException(`Escrow not found: ${id}`);
    }

    return escrow;
  }

  private async buildTransaction(
    from: string,
    to: string,
    amount: number,
  ) {
    const account = await this.stellarServer.loadAccount(from);

    return new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: to,
          amount: amount.toString(),
          asset: StellarSdk.Asset.native(),
        }),
      )
      .setTimeout(180)
      .build();
  }

  private async submitTransaction(tx: any): Promise<string> {
    const res = await this.stellarServer.submitTransaction(tx);
    return res.hash;
  }

  private emitFundsReleasedEvent(escrow: EscrowEntity) {
    console.log('FundsReleasedEvent emitted:', {
      id: escrow.id,
      status: escrow.status,
    });
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
}