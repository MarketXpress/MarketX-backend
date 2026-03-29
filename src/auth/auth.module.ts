import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-yet';

// New Strategies and Guards
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/jwt-refresh.strategy';
import { TokenRegistryService } from './token-registry.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // Register JWT without static config; strategies will handle specific secrets/expiry
    JwtModule.register({}),

    // Redis Cache Manager Integration
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore.redisStore({
          url:
            configService.get<string>('REDIS_URL') || 'redis://localhost:6379',
          ttl: 604800000, // Default 7 days
        }),
      }),
    }),
    UsersModule,
  ],
  providers: [
    AuthService,
    TokenRegistryService,
    JwtStrategy,
    RefreshTokenStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
