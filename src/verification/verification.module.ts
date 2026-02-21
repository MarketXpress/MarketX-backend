import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { UserVerification } from './user-verification.entity';
import { Users } from '../users/users.entity';
import { DocumentProcessorService } from '../documents/document-processor.service';
import { DocumentStorageService } from '../documents/document-storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserVerification, Users]), ConfigModule],
  controllers: [VerificationController],
  providers: [
    VerificationService,
    DocumentProcessorService,
    DocumentStorageService,
  ],
  exports: [VerificationService],
})
export class VerificationModule {}
