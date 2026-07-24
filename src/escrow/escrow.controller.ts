import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { EscrowService } from './escrow.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { Escrow } from '../entities/escrow.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Escrow')
@Controller('escrow')
@UseGuards(JwtAuthGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create and fund a Stellar escrow (testnet)',
    description:
      'Generates a dedicated Stellar escrow keypair, funds it via Friendbot, ' +
      'and persists the escrow record. Returns the escrow with status FUNDED ' +
      'and the Stellar transaction hash.',
  })
  @ApiResponse({ status: 201, description: 'Escrow created and funded.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 500, description: 'Stellar network error.' })
  async create(
    @Req() req: { user: { id: string } },
    @Body() createEscrowDto: CreateEscrowDto,
  ): Promise<Escrow> {
    return this.escrowService.createEscrow({
      ...createEscrowDto,
      buyerId: req.user.id,
    });
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Release escrow funds to the seller',
    description:
      'Signs and submits a Stellar payment from the escrow keypair to the ' +
      "seller's Stellar wallet address. Updates status to RELEASED and stores " +
      'the release transaction hash.',
  })
  @ApiParam({ name: 'id', description: 'Escrow UUID', type: String })
  @ApiResponse({ status: 200, description: 'Escrow released successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Escrow is not in FUNDED state.',
  })
  @ApiResponse({ status: 404, description: 'Escrow not found.' })
  @ApiResponse({ status: 500, description: 'Stellar network error.' })
  async release(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { id: string; role?: string } },
  ): Promise<Escrow> {
    return this.escrowService.releaseEscrow(id, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get escrow status by ID' })
  @ApiParam({ name: 'id', description: 'Escrow UUID', type: String })
  @ApiResponse({ status: 200, description: 'Escrow record.' })
  @ApiResponse({ status: 404, description: 'Escrow not found.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Escrow> {
    return this.escrowService.findOne(id);
  }
}
