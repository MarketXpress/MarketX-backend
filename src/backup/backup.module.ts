import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';

@Module({
  imports: [ScheduleModule.forRoot(), ConfigModule],
  providers: [BackupService],
  controllers: [BackupController],
  exports: [BackupService],
})
export class BackupModule {}