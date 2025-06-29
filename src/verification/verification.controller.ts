import { Controller, Post, UploadedFile, UseInterceptors, Body, Get, Param, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VerificationService } from './verification.service';
import { VerificationType } from './enums/verification.enums';
import { StartVerificationDto } from './dto/verification.dto';
import { File as MulterFile } from 'multer';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('start')
  async start(@Body() dto: StartVerificationDto) {
    if (!dto.userId || !dto.verificationType) throw new BadRequestException('userId and verificationType required');
    return this.verificationService.startVerification(dto.userId, dto.verificationType);
  }

  @Post('upload/:type')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('type') type: VerificationType,
    @Body('userId') userId: number,
    @UploadedFile() file: MulterFile,
  ) {
    if (!userId || !file) throw new BadRequestException('userId and file required');
    return this.verificationService.uploadDocument(userId, type, file);
  }

  @Get('status/:userId')
  async status(@Param('userId') userId: number) {
    return this.verificationService.getVerificationStatus(userId);
  }

  @Get('trust-score/:userId')
  async trustScore(@Param('userId') userId: number) {
    return this.verificationService.calculateTrustScore(userId);
  }
}
