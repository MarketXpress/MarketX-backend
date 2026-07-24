import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import axios from 'axios';

import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { LoggerService } from '../common/logger/logger.service';
import { EncryptionService } from '../common/services/encryption.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';

export interface EscrowActor {
  id: string;
  role?: string;
}

@Injectable()
export class EscrowService {
  private readonly server: StellarSdk.Horizon.Server;
  private readonly networkPassphrase: string;
  private readonly friendbotUrl: string;

  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly encryptionService: EncryptionService,
  ) {
    const horizonUrl = this.configService.get<string>(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org',
    );

    this.friendbotUrl = this.configService.get<string>(
      'STELLAR_FRIENDBOT_URL',
      'https://friendbot.stellar.org',
    );

    this.server = new StellarSdk.Horizon.Server(horizonUrl);

    // Default to testnet — production would use StellarSdk.Networks.PUBLIC
    this.networkPassphrase = StellarSdk.Networks.TESTNET;
  }

  // ---------------------------------------------------------------------------
  // createEscrow
  // ---------------------------------------------------------------------------

  /**
   * Generates a fresh Stellar keypair, funds it via Friendbot (testnet),
   * and persists an Escrow record with status FUNDED.
   *
   * The escrow keypair holds XLM on behalf of the buyer. On release, the
   * service signs a payment from this keypair to the seller's Stellar address.
   *
   * NOTE: Friendbot is testnet-only. A mainnet implementation would require
   *       the buyer to sign a payment from their own Stellar account instead.
   */
  async createEscrow(dto: CreateEscrowDto): Promise<Escrow> {
    if (!dto.buyerId) {
      throw new BadRequestException('Authenticated buyer is required');
    }

    const buyerId = dto.buyerId;

    this.logger.info('Creating escrow', {
      buyerId,
      sellerId: dto.sellerId,
      amount: dto.amount,
    });

    // Generate a dedicated escrow keypair
    const escrowKeypair = StellarSdk.Keypair.random();
    const escrowPublicKey = escrowKeypair.publicKey();
    const encryptedSecretKey = this.encryptionService.encryptString(
      escrowKeypair.secret(),
    );

    // Persist with PENDING status before hitting the network. The secret is
    // envelope-encrypted at rest; it is only ever decrypted in-memory, and
    // only at the point of signing a release transaction.
    const escrow = this.escrowRepository.create({
      buyerId,
      sellerId: dto.sellerId,
      amount: dto.amount,
      status: EscrowStatus.PENDING,
      escrowPublicKey,
      escrowSecretKey: encryptedSecretKey,
      released: false,
    });
    await this.escrowRepository.save(escrow);

    try {
      // Fund the escrow account via Friendbot
      const fundingTxHash =
        await this.fundViaFriendbotAndGetHash(escrowPublicKey);

      this.logger.info('Escrow keypair funded via Friendbot', {
        escrowId: escrow.id,
        escrowPublicKey,
        transactionHash: fundingTxHash,
      });

      // Update status to FUNDED
      escrow.status = EscrowStatus.FUNDED;
      escrow.transactionHash = fundingTxHash;
      await this.escrowRepository.save(escrow);

      return escrow;
    } catch (error) {
      this.logger.error(
        'Failed to fund escrow via Friendbot',
        { escrowId: escrow.id },
        error as Error,
      );

      escrow.status = EscrowStatus.FAILED;
      await this.escrowRepository.save(escrow);

      throw new InternalServerErrorException(
        'Stellar escrow funding failed. See server logs for details.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // releaseEscrow
  // ---------------------------------------------------------------------------

  /**
   * Signs and submits a Stellar payment from the escrow keypair to the
   * seller's Stellar wallet address, then marks the escrow as RELEASED.
   *
   * The seller must have a `stellarWalletAddress` recorded. For testnet
   * purposes, if the seller has no wallet address, a new random keypair is
   * generated and Friendbot-funded as a stand-in destination.
   */
  async releaseEscrow(
    escrowId: string,
    actingUser: EscrowActor,
  ): Promise<Escrow> {
    this.logger.info('Releasing escrow', { escrowId });

    const escrow = await this.findOne(escrowId);
    this.assertReleaseAccess(escrow, actingUser);

    if (escrow.status !== EscrowStatus.FUNDED) {
      throw new BadRequestException(
        `Escrow ${escrowId} cannot be released from status '${escrow.status}'. Only FUNDED escrows can be released.`,
      );
    }

    if (!escrow.escrowPublicKey) {
      throw new InternalServerErrorException(
        `Escrow ${escrowId} is missing keypair data and cannot be released.`,
      );
    }

    // Decrypt the signing key before entering the network try/catch below,
    // so a missing/corrupt key surfaces its own precise error instead of
    // being swallowed into the generic "release failed" message.
    const escrowKeypair = await this.getEscrowSigningKeypair(escrowId);

    try {
      // Load the escrow account from Horizon to get the current sequence number
      const escrowAccount = await this.server.loadAccount(
        escrow.escrowPublicKey,
      );

      // Determine destination: seller's Stellar wallet address.
      // For testnet, fall back to a fresh Friendbot-funded address if the
      // seller doesn't have one configured.
      const destinationAddress = await this.resolveSellerAddress(
        escrow.sellerId,
      );

      // Ensure the destination account exists on the testnet ledger
      await this.ensureAccountExists(destinationAddress);

      // XLM is the native asset; amount must be a string for the Stellar SDK
      const releaseAmount = Number(escrow.amount).toFixed(7);

      const transaction = new StellarSdk.TransactionBuilder(escrowAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: destinationAddress,
            asset: StellarSdk.Asset.native(),
            amount: releaseAmount,
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(escrowKeypair);

      const response = await this.server.submitTransaction(transaction);
      const releaseTxHash = response.hash;

      this.logger.info('Escrow released successfully', {
        escrowId,
        releaseTxHash,
        destinationAddress,
        amount: releaseAmount,
      });

      escrow.status = EscrowStatus.RELEASED;
      escrow.transactionHash = releaseTxHash;
      escrow.released = true;
      await this.escrowRepository.save(escrow);

      return escrow;
    } catch (error) {
      this.logger.error(
        'Failed to release escrow',
        { escrowId },
        error as Error,
      );

      // Preserve existing status — do not mark as FAILED on a release error
      // so the operator can retry or investigate.
      throw new InternalServerErrorException(
        'Stellar escrow release failed. See server logs for details.',
      );
    }
  }

  private assertReleaseAccess(escrow: Escrow, actingUser: EscrowActor): void {
    const isParty =
      actingUser.id === escrow.buyerId || actingUser.id === escrow.sellerId;
    const isAdmin = actingUser.role === 'admin';

    if (!isParty && !isAdmin) {
      throw new ForbiddenException(
        'You are not allowed to release this escrow',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  async findOne(escrowId: string): Promise<Escrow> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
    });
    if (!escrow) {
      throw new NotFoundException(`Escrow with ID "${escrowId}" not found`);
    }
    return escrow;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Decrypts the escrow account's Stellar secret key only for the immediate
   * purpose of signing a transaction. The plaintext secret never leaves this
   * method's scope, is never logged, and is never attached back to an entity
   * instance. Access is logged (escrow ID only — never the secret).
   */
  private async getEscrowSigningKeypair(
    escrowId: string,
  ): Promise<StellarSdk.Keypair> {
    const record = await this.escrowRepository
      .createQueryBuilder('escrow')
      .addSelect('escrow.escrowSecretKey')
      .where('escrow.id = :id', { id: escrowId })
      .getOne();

    if (!record?.escrowSecretKey) {
      throw new InternalServerErrorException(
        `Escrow ${escrowId} is missing keypair data and cannot be released.`,
      );
    }

    this.logger.info('Escrow secret key decrypted for transaction signing', {
      escrowId,
    });

    const secret = this.encryptionService.decryptString(record.escrowSecretKey);

    return StellarSdk.Keypair.fromSecret(secret);
  }

  /**
   * Calls Friendbot to fund a given public key and returns the transaction hash.
   */
  private async fundViaFriendbotAndGetHash(publicKey: string): Promise<string> {
    const response = await axios.get<{ hash: string }>(this.friendbotUrl, {
      params: { addr: publicKey },
    });

    const hash = response.data?.hash;
    if (!hash) {
      throw new Error(
        `Friendbot did not return a transaction hash for ${publicKey}`,
      );
    }
    return hash;
  }

  /**
   * Resolves the seller's Stellar address. Falls back to Friendbot-funding a
   * fresh keypair when the seller has no wallet — testnet convenience only.
   *
   * In production this should throw if `User.stellarWalletAddress` is unset.
   */
  private async resolveSellerAddress(sellerId: string): Promise<string> {
    // Attempt to look up the seller's configured Stellar wallet address
    // by querying the users table via TypeORM EntityManager.
    // We avoid injecting UsersService to keep a clean dependency boundary.
    try {
      const userRow = await this.escrowRepository.manager.query(
        'SELECT "stellarWalletAddress" FROM users WHERE id = $1 LIMIT 1',
        [sellerId],
      );

      const address: string | undefined = userRow?.[0]?.stellarWalletAddress;

      if (address) {
        return address;
      }
    } catch {
      // If the query fails (e.g. in tests), fall through to the fallback
    }

    // Testnet fallback: fund a fresh keypair and return its public key
    this.logger.warn(
      'Seller has no Stellar wallet address — generating a testnet fallback destination',
      { sellerId },
    );
    const fallbackKeypair = StellarSdk.Keypair.random();
    await this.fundViaFriendbotAndGetHash(fallbackKeypair.publicKey());
    return fallbackKeypair.publicKey();
  }

  /**
   * Ensures a Stellar account exists on-chain; funds it via Friendbot if not.
   */
  private async ensureAccountExists(publicKey: string): Promise<void> {
    try {
      await this.server.loadAccount(publicKey);
    } catch {
      // Account not found — fund it
      await this.fundViaFriendbotAndGetHash(publicKey);
    }
  }
}
