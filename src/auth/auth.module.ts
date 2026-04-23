import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// New Strategies and Guards
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/jwt-refresh.strategy';
import { TokenRegistryService } from './token-registry.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // Register JWT without static config; strategies will handle specific secrets/expiry
    JwtModule.register({}),
  ],
  providers: [
    AuthService,
    TokenRegistryService,
    JwtStrategy,
    RefreshTokenStrategy,
    JwtAuthGuard,
    JwtRefreshGuard,
    LocalAuthGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
