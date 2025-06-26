import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { Users } from 'src/users/users.entity';
import { Listing } from 'src/listing/entities/listing.entities';

@Module({
  imports: [TypeOrmModule.forFeature([Users, Listing])],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
