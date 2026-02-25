import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag } from './entities/feature-flag.entity';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { RedisCacheService } from '../redis-caching/redis-cache.service';
import { CacheKeys, CacheTTL } from '../redis-caching/cache-keys';

@Injectable()
export class FeatureFlagsService {
  constructor(
    @InjectRepository(FeatureFlag)
    private readonly repo: Repository<FeatureFlag>,
    private readonly cache: RedisCacheService,
  ) {}

  // ── CRUD ────────────────────────────────────────────────────────────────

  create(dto: CreateFeatureFlagDto): Promise<FeatureFlag> {
    return this.repo.save(this.repo.create(dto));
  }

  findAll(): Promise<FeatureFlag[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }

  async findOne(key: string): Promise<FeatureFlag> {
    const flag = await this.repo.findOne({ where: { key } });
    if (!flag) throw new NotFoundException(`Feature flag "${key}" not found`);
    return flag;
  }

  async update(key: string, dto: UpdateFeatureFlagDto): Promise<FeatureFlag> {
    const flag = await this.findOne(key);
    Object.assign(flag, dto);
    const saved = await this.repo.save(flag);
    await this.cache.del(CacheKeys.featureFlag(key));
    return saved;
  }

  async remove(key: string): Promise<void> {
    const flag = await this.findOne(key);
    await this.repo.remove(flag);
    await this.cache.del(CacheKeys.featureFlag(key));
  }

  // ── Evaluation ──────────────────────────────────────────────────────────

  /**
   * Check whether a feature flag is enabled for an optional userId.
   * Priority (highest → lowest):
   *   1. Per-user override
   *   2. Rollout percentage (deterministic per userId:key)
   *   3. Environment default (NODE_ENV)
   *   4. Global `enabled`
   */
  async isEnabled(key: string, userId?: string): Promise<boolean> {
    const flag = await this.cache.getOrSet(
      CacheKeys.featureFlag(key),
      () => this.repo.findOne({ where: { key } }).then((f) => f ?? null),
      CacheTTL.FEATURE_FLAG,
    );

    if (!flag) return false; // flag not found → off

    // 1. Per-user override
    if (userId && flag.userOverrides?.[userId] !== undefined) {
      return flag.userOverrides[userId];
    }

    // 2. Rollout percentage
    if (flag.rolloutPercentage !== null && flag.rolloutPercentage !== undefined && userId) {
      return this.hashBucket(userId, key) < flag.rolloutPercentage;
    }

    // 3. Environment default
    const env = process.env.NODE_ENV ?? 'development';
    if (flag.environmentDefaults?.[env] !== undefined) {
      return flag.environmentDefaults[env];
    }

    // 4. Global default
    return flag.enabled;
  }

  // ── User overrides ───────────────────────────────────────────────────────

  async setUserOverride(key: string, userId: string, value: boolean): Promise<FeatureFlag> {
    const flag = await this.findOne(key);
    flag.userOverrides = { ...flag.userOverrides, [userId]: value };
    const saved = await this.repo.save(flag);
    await this.cache.del(CacheKeys.featureFlag(key));
    return saved;
  }

  async removeUserOverride(key: string, userId: string): Promise<FeatureFlag> {
    const flag = await this.findOne(key);
    const { [userId]: _removed, ...rest } = flag.userOverrides ?? {};
    flag.userOverrides = rest;
    const saved = await this.repo.save(flag);
    await this.cache.del(CacheKeys.featureFlag(key));
    return saved;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Maps userId+key to a stable 0–99 bucket.
   * Same user always lands in the same bucket across restarts.
   */
  private hashBucket(userId: string, key: string): number {
    const str = `${userId}:${key}`;
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return Math.abs(hash >>> 0) % 100;
  }
}