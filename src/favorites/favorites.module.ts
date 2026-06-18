import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { UserFavorite } from './favorites.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserFavorite])],
  providers: [FavoritesService],
  controllers: [FavoritesController],
  exports: [FavoritesService], // Exporting if other service engines need verification lookups
})
export class FavoritesModule {}