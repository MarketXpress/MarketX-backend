import { Controller, Post, Body, Get, Param, Query, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { SubmitEvidenceDto } from './dto/submit-evidence.dto';
import { EscalateDisputeDto } from './dto/escalate-dispute.dto';

@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  async createDispute(@Body() dto: CreateDisputeDto) {
    return this.disputesService.createDispute(dto);
  }

  @Get(':id')
  async getDispute(@Param('id') id: string) {
    return this.disputesService.getDisputeById(id);
  }

  @Get()
  async listUserDisputes(@Query('userId') userId: string) {
    return this.disputesService.listDisputes({ complainantId: userId });
  }

  @Post('evidence')
  @UseInterceptors(FileInterceptor('file'))
  async submitEvidence(
    @Body() dto: SubmitEvidenceDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (file) {
      dto.fileUrl = await this.disputesService.uploadEvidenceFile(file);
    }
    return this.disputesService.submitEvidence(dto);
  }

  @Post('escalate')
  async escalateDispute(@Body() dto: EscalateDisputeDto, @Req() req) {
    // Assume req.user.id is available from auth middleware
    const userId = req.user?.id || dto.complainantId;
    return this.disputesService.escalateDispute(dto, userId);
  }
} 