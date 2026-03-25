import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';
import { EscrowService } from './escrow.service';
import {
  CreateEscrowDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
  EscrowResponseDto,
} from './dto/escrow-transaction.dto';
import { ReleasePartialDto } from './dto/release-partial.dto';

@Controller('escrow')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  /**
   * =========================
   * CREATE ESCROW
   * =========================
   */
  @Post()
  @HttpCode(201)
  async createEscrow(
    @Body() dto: CreateEscrowDto & { buyerSecretKey: string },
  ): Promise<EscrowResponseDto> {
    try {
      if (!dto.buyerSecretKey) {
        throw new BadRequestException('buyerSecretKey is required');
      }

      const buyerKeypair = StellarSdk.Keypair.fromSecret(
        dto.buyerSecretKey,
      );

      if (buyerKeypair.publicKey() !== dto.buyerPublicKey) {
        throw new BadRequestException(
          'Secret key does not match public key',
        );
      }

      return await this.escrowService.createEscrow(dto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * =========================
   * FULL RELEASE
   * =========================
   */
  @Post(':id/release')
  @HttpCode(200)
  async releaseFunds(
    @Param('id') escrowId: string,
    @Body() dto: ReleaseEscrowDto & { sellerSecretKey: string },
  ): Promise<EscrowResponseDto> {
    try {
      if (!dto.sellerSecretKey) {
        throw new BadRequestException('sellerSecretKey is required');
      }

      StellarSdk.Keypair.fromSecret(dto.sellerSecretKey);

      return await this.escrowService.releaseFunds({
        escrowId,
        deliveryProof: dto.deliveryProof,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * =========================
   * 🔥 PARTIAL RELEASE (NEW)
   * =========================
   */
  @Post(':id/release-partial')
  @HttpCode(200)
  async releasePartial(
    @Param('id') escrowId: string,
    @Body() dto: ReleasePartialDto & { sellerSecretKey: string },
  ): Promise<EscrowResponseDto> {
    try {
      if (!dto.sellerSecretKey) {
        throw new BadRequestException('sellerSecretKey is required');
      }

      // Validate seller key
      StellarSdk.Keypair.fromSecret(dto.sellerSecretKey);

      return await this.escrowService.releasePartial(
        escrowId,
        dto.releasedAmount,
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * =========================
   * REFUND
   * =========================
   */
  @Post(':id/refund')
  @HttpCode(200)
  async refundBuyer(
    @Param('id') escrowId: string,
    @Body() dto: RefundEscrowDto & { buyerSecretKey: string },
  ): Promise<EscrowResponseDto> {
    try {
      if (!dto.buyerSecretKey) {
        throw new BadRequestException('buyerSecretKey is required');
      }

      StellarSdk.Keypair.fromSecret(dto.buyerSecretKey);

      return await this.escrowService.refundBuyer({
        escrowId,
        reason: dto.reason,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * =========================
   * GET ESCROW BY ID
   * =========================
   */
  @Get(':id')
  async getEscrow(
    @Param('id') escrowId: string,
  ): Promise<EscrowResponseDto> {
    return this.escrowService.getEscrow(escrowId);
  }

  /**
   * =========================
   * GET BY ORDER ID
   * =========================
   */
  @Get('order/:orderId')
  async getEscrowByOrderId(
    @Param('orderId') orderId: string,
  ): Promise<EscrowResponseDto> {
    return this.escrowService.getEscrowByOrderId(orderId);
  }
}