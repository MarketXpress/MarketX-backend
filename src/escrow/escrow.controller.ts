import { Controller, Post, Get, Put, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { ReleaseEscrowDto } from './dto/update-escrow.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ValidationPipe } from '../pipes/validation.pipe';

@ApiTags('Escrow')
@ApiBearerAuth()
@Controller('escrow')
@UseGuards(AuthGuard, RolesGuard, ThrottlerGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  @Roles(UserRole.SELLER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new escrow' })
  @ApiResponse({ status: 201, description: 'Escrow created', type: EscrowResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiBody({ type: CreateEscrowDto })
  @AuditLog('CREATE_ESCROW')
  async createEscrow(
    @Body(new ValidationPipe()) createEscrowDto: CreateEscrowDto
  ): Promise<EscrowResponseDto> {
    return this.escrowService.createEscrow(createEscrowDto);
  }

  @Get(':id')
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get escrow details' })
  @ApiResponse({ status: 200, description: 'Escrow details', type: EscrowResponseDto })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async getEscrow(
    @Param('id') id: string
  ): Promise<EscrowResponseDto> {
    return this.escrowService.getEscrowStatus(id);
  }

  @Put(':id/release')
  @Roles(UserRole.SELLER)
  @Throttle(5, 60) // 5 requests per minute
  @ApiOperation({ summary: 'Release funds to seller' })
  @ApiResponse({ status: 200, description: 'Funds released', type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid escrow state' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiBody({ type: ReleaseEscrowDto })
  @AuditLog('RELEASE_FUNDS')
  async releaseFunds(
    @Param('id') id: string,
    @Body(new ValidationPipe()) releaseEscrowDto: ReleaseEscrowDto
  ): Promise<TransactionResponseDto> {
    return this.escrowService.releaseFunds({ ...releaseEscrowDto, escrowId: id });
  }

  @Put(':id/confirm')
  @Roles(UserRole.BUYER)
  @Throttle(3, 60) // 3 requests per minute
  @ApiOperation({ summary: 'Confirm receipt by buyer' })
  @ApiResponse({ status: 200, description: 'Receipt confirmed' })
  @ApiResponse({ status: 400, description: 'Invalid escrow state' })
  @ApiBody({ type: ConfirmReceiptDto })
  @AuditLog('CONFIRM_RECEIPT')
  async confirmReceipt(
    @Param('id') id: string,
    @Body(new ValidationPipe()) confirmReceiptDto: ConfirmReceiptDto
  ): Promise<void> {
    return this.escrowService.confirmReceipt({ ...confirmReceiptDto, escrowId: id });
  }

  @Put(':id/dispute')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  @Throttle(2, 60) // 2 requests per minute
  @ApiOperation({ summary: 'Initiate dispute' })
  @ApiResponse({ status: 200, description: 'Dispute initiated' })
  @ApiResponse({ status: 400, description: 'Invalid escrow state' })
  @ApiBody({ type: DisputeEscrowDto })
  @AuditLog('INITIATE_DISPUTE')
  async initiateDispute(
    @Param('id') id: string,
    @Body(new ValidationPipe()) disputeEscrowDto: DisputeEscrowDto
  ): Promise<void> {
    return this.escrowService.initiateDispute({ ...disputeEscrowDto, escrowId: id });
  }

  @Put(':id/resolve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Resolve dispute (admin only)' })
  @ApiResponse({ status: 200, description: 'Dispute resolved' })
  @ApiResponse({ status: 400, description: 'Invalid resolution' })
  @ApiBody({ type: ResolveDisputeDto })
  @AuditLog('RESOLVE_DISPUTE')
  async resolveDispute(
    @Param('id') id: string,
    @Body(new ValidationPipe()) resolveDisputeDto: ResolveDisputeDto
  ): Promise<void> {
    return this.escrowService.resolveDispute(id, resolveDisputeDto.resolution);
  }

  @Get('transaction/:transactionId')
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get escrow by transaction ID' })
  @ApiResponse({ status: 200, description: 'Escrow details', type: EscrowResponseDto })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async getEscrowByTransaction(
    @Param('transactionId') transactionId: string
  ): Promise<EscrowResponseDto> {
    return this.escrowService.getEscrowByTransaction(transactionId);
  }
}
