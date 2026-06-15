import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class TokenRegistryService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  // Store token with 7-day TTL
  async store(userId: string, token: string): Promise<void> {
    const key = `refresh_token:${userId}:${token}`;
    await this.cacheManager.set(key, 'active', 604800000); // 7 days in ms

    // Maintain list of tokens for the user
    await this.addTokenToUserList(userId, token);
  }

  async exists(userId: string, token: string): Promise<boolean> {
    const key = `refresh_token:${userId}:${token}`;
    const val = await this.cacheManager.get(key);
    return !!val;
  }

  async invalidate(userId: string, token: string): Promise<void> {
    const key = `refresh_token:${userId}:${token}`;
    await this.cacheManager.del(key);

    // Remove from user list
    await this.removeTokenFromUserList(userId, token);
  }

  // REUSE DETECTION: Invalidate all tokens for a user
  async invalidateAllForUser(userId: string): Promise<void> {
    const userTokensKey = `user_refresh_tokens:${userId}`;
    const tokens: string[] = (await this.cacheManager.get(userTokensKey)) || [];

    if (tokens.length > 0) {
      const tokenKeys = tokens.map(token => `refresh_token:${userId}:${token}`);
      await Promise.all(tokenKeys.map(key => this.cacheManager.del(key)));
    }

    // Clear the user tokens list
    await this.cacheManager.del(userTokensKey);
  }

  private async addTokenToUserList(userId: string, token: string): Promise<void> {
    const userTokensKey = `user_refresh_tokens:${userId}`;
    const tokens: string[] = (await this.cacheManager.get(userTokensKey)) || [];
    if (!tokens.includes(token)) {
      tokens.push(token);
      await this.cacheManager.set(userTokensKey, tokens, 604800000); // Same TTL
    }
  }

  private async removeTokenFromUserList(userId: string, token: string): Promise<void> {
    const userTokensKey = `user_refresh_tokens:${userId}`;
    const tokens: string[] = (await this.cacheManager.get(userTokensKey)) || [];
    const filteredTokens = tokens.filter(t => t !== token);
    if (filteredTokens.length > 0) {
      await this.cacheManager.set(userTokensKey, filteredTokens, 604800000);
    } else {
      await this.cacheManager.del(userTokensKey);
    }
  }
}
