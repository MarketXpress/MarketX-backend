import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { UserVerification } from './entities/user-verification.entity';
import { DocumentProcessorService } from '../documents/document-processor.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserVerification])],
  controllers: [VerificationController],
  providers: [VerificationService, DocumentProcessorService],
  exports: [VerificationService],
})
export class VerificationModule {}
