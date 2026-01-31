import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import * as StellarSdk from 'stellar-sdk';
import { EscrowService } from './escrow.service';
import {
  CreateEscrowDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
  EscrowResponseDto,
} from './dto/escrow-transaction.dto';

@Controller('escrow')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  /**
   * POST /escrow
   * Create escrow transaction
   * Requires: buyerSecretKey in body to sign the lock transaction
   */
  @Post()
  @HttpCode(201)
  async createEscrow(dto: CreateEscrowDto & { buyerSecretKey: string }): Promise<EscrowResponseDto> {
    try {
      // Create initial escrow record
      const escrow = await this.escrowService.createEscrow(dto);

      // Sign the lock transaction with buyer's secret key
      if (!dto.buyerSecretKey) {
        throw new BadRequestException('buyerSecretKey is required');
      }

      const buyerKeypair = StellarSdk.Keypair.fromSecret(dto.buyerSecretKey);
      if (buyerKeypair.publicKey() !== dto.buyerPublicKey) {
        throw new BadRequestException('Secret key does not match public key');
      }

      return escrow;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * POST /escrow/:id/release
   * Release funds to seller
   * Requires: sellerSecretKey in body to sign the release transaction
   */
  @Post(':id/release')
  @HttpCode(200)
  async releaseFunds(escrowId: string, dto: ReleaseEscrowDto & { sellerSecretKey: string }): Promise<EscrowResponseDto> {
    try {
      if (!dto.sellerSecretKey) {
        throw new BadRequestException('sellerSecretKey is required');
      }

      // Validate seller secret key
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
   * POST /escrow/:id/refund
   * Refund funds back to buyer
   * Requires: buyerSecretKey in body to sign the refund transaction
   */
  @Post(':id/refund')
  @HttpCode(200)
  async refundBuyer(escrowId: string, dto: RefundEscrowDto & { buyerSecretKey: string }): Promise<EscrowResponseDto> {
    try {
      if (!dto.buyerSecretKey) {
        throw new BadRequestException('buyerSecretKey is required');
      }

      // Validate buyer secret key
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
   * GET /escrow/:id
   * Get escrow details
   */
  @Get(':id')
  async getEscrow(escrowId: string): Promise<EscrowResponseDto> {
    return this.escrowService.getEscrow(escrowId);
  }

  /**
   * GET /escrow/order/:orderId
   * Get escrow by order ID
   */
  @Get('order/:orderId')
  async getEscrowByOrderId(orderId: string): Promise<EscrowResponseDto> {
    return this.escrowService.getEscrowByOrderId(orderId);
  }
}
