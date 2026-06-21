import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { EscrowService } from './escrow.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { Escrow } from '../entities/escrow.entity';

@ApiTags('Escrow')
@Controller('escrow')
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
  async create(@Body() createEscrowDto: CreateEscrowDto): Promise<Escrow> {
    return this.escrowService.createEscrow(createEscrowDto);
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
  ): Promise<Escrow> {
    return this.escrowService.releaseEscrow(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get escrow status by ID' })
  @ApiParam({ name: 'id', description: 'Escrow UUID', type: String })
  @ApiResponse({ status: 200, description: 'Escrow record.' })
  @ApiResponse({ status: 404, description: 'Escrow not found.' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Escrow> {
    return this.escrowService.findOne(id);
  }
}
