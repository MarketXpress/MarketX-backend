import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from './users.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminGuard } from '../guards/admin.guard';
import { UserOwnerOrAdminGuard } from '../guards/user-owner-or-admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Users])],
  controllers: [UsersController],
  providers: [UsersService, AdminGuard, UserOwnerOrAdminGuard],
  exports: [UsersService],
})
export class UsersModule {}
