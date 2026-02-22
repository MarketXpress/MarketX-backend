import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import { Wishlist } from './entities/wishlist.entity';
import { WishlistItem } from './entities/wishlist-item.entity';
import {
  CreateWishlistDto,
  UpdateWishlistDto,
  AddWishlistItemDto,
  UpdateWishlistItemDto,
} from './dtos/wishlist.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationChannel, NotificationPriority } from '../notifications/notification.entity';

const MAX_ITEMS_PER_WISHLIST = 100;

@Injectable()
export class WishlistsService {
  private readonly logger = new Logger(WishlistsService.name);

  constructor(
    @InjectRepository(Wishlist)
    private readonly wishlistRepo: Repository<Wishlist>,
    @InjectRepository(WishlistItem)
    private readonly itemRepo: Repository<WishlistItem>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateWishlistDto): Promise<Wishlist> {
    const wishlist = this.wishlistRepo.create({
      userId,
      name: dto.name,
      description: dto.description,
      isPublic: dto.isPublic ?? false,
    });
    return this.wishlistRepo.save(wishlist);
  }

  async findAllByUser(userId: string): Promise<Wishlist[]> {
    return this.wishlistRepo.find({
      where: { userId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, wishlistId: string): Promise<Wishlist> {
    const wishlist = await this.wishlistRepo.findOne({
      where: { id: wishlistId, userId },
      relations: ['items'],
    });
    if (!wishlist) throw new NotFoundException('Wishlist not found');
    return wishlist;
  }

  async findPublicByToken(shareToken: string): Promise<Wishlist> {
    const wishlist = await this.wishlistRepo.findOne({
      where: { shareToken, isPublic: true },
      relations: ['items'],
    });
    if (!wishlist) throw new NotFoundException('Shared wishlist not found');
    return wishlist;
  }

  async update(
    userId: string,
    wishlistId: string,
    dto: UpdateWishlistDto,
  ): Promise<Wishlist> {
    const wishlist = await this.findOne(userId, wishlistId);
    Object.assign(wishlist, dto);
    return this.wishlistRepo.save(wishlist);
  }

  async remove(userId: string, wishlistId: string): Promise<void> {
    const wishlist = await this.findOne(userId, wishlistId);
    await this.wishlistRepo.remove(wishlist);
  }

  /** Generate or revoke a public share link */
  async toggleShare(
    userId: string,
    wishlistId: string,
    share: boolean,
  ): Promise<Wishlist> {
    const wishlist = await this.findOne(userId, wishlistId);
    if (share) {
      wishlist.isPublic = true;
      wishlist.shareToken = randomBytes(24).toString('hex');
    } else {
      wishlist.isPublic = false;
      wishlist.shareToken = null;
    }
    return this.wishlistRepo.save(wishlist);
  }

  async addItem(
    userId: string,
    wishlistId: string,
    dto: AddWishlistItemDto,
  ): Promise<WishlistItem> {
    const wishlist = await this.findOne(userId, wishlistId);

    const count = await this.itemRepo.count({ where: { wishlistId } });
    if (count >= MAX_ITEMS_PER_WISHLIST) {
      throw new BadRequestException(
        `Wishlists support a maximum of ${MAX_ITEMS_PER_WISHLIST} items`,
      );
    }

    const existing = await this.itemRepo.findOne({
      where: { wishlistId, productId: dto.productId },
    });
    if (existing) {
      throw new ConflictException('Product already exists in this wishlist');
    }

    const item = this.itemRepo.create({
      wishlistId,
      productId: dto.productId,
      productName: dto.productName,
      priceAtAdded: dto.currentPrice,
      currentPrice: dto.currentPrice,
      lowestPrice: dto.currentPrice,
      productImageUrl: dto.productImageUrl ?? null,
      productUrl: dto.productUrl ?? null,
      priceAlertThreshold: dto.priceAlertThreshold ?? null,
      notificationsEnabled: dto.notificationsEnabled ?? true,
      priceHistory: [
        { price: dto.currentPrice, recordedAt: new Date().toISOString() },
      ],
    });

    return this.itemRepo.save(item);
  }

  async updateItem(
    userId: string,
    wishlistId: string,
    itemId: string,
    dto: UpdateWishlistItemDto,
  ): Promise<WishlistItem> {
    await this.findOne(userId, wishlistId); // ownership check
    const item = await this.itemRepo.findOne({
      where: { id: itemId, wishlistId },
    });
    if (!item) throw new NotFoundException('Wishlist item not found');
    Object.assign(item, dto);
    return this.itemRepo.save(item);
  }

  async removeItem(
    userId: string,
    wishlistId: string,
    itemId: string,
  ): Promise<void> {
    await this.findOne(userId, wishlistId);
    const item = await this.itemRepo.findOne({
      where: { id: itemId, wishlistId },
    });
    if (!item) throw new NotFoundException('Wishlist item not found');
    await this.itemRepo.remove(item);
  }

  /**
   * Called by a scheduled job (e.g. every hour via @nestjs/schedule).
   * Pass in the latest prices fetched from your product catalogue.
   */
  async syncPrices(
    updates: Array<{ productId: string; newPrice: number; isAvailable: boolean }>,
    notificationService?: NotificationsService,
  ): Promise<void> {
    if (!updates.length) return;

    const productIds = updates.map((u) => u.productId);
    const priceMap = new Map(updates.map((u) => [u.productId, u]));

    const items = await this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.wishlist', 'wishlist')
      .where('item.productId IN (:...productIds)', { productIds })
      .andWhere('item.notificationsEnabled = true')
      .getMany();

    const toSave: WishlistItem[] = [];
    const notifications: Array<{
      userId: string;
      item: WishlistItem;
      oldPrice: number;
      newPrice: number;
    }> = [];

    for (const item of items) {
      const update = priceMap.get(item.productId);
      if (!update) continue;

      const { newPrice, isAvailable } = update;
      const oldPrice = Number(item.currentPrice);
      const isPriceDrop = newPrice < oldPrice;

      item.isAvailable = isAvailable;

      if (newPrice !== oldPrice) {
        item.currentPrice = newPrice;

        // Append to history (keep last 90 entries)
        const history = item.priceHistory ?? [];
        history.push({ price: newPrice, recordedAt: new Date().toISOString() });
        if (history.length > 90) history.shift();
        item.priceHistory = history;

        if (newPrice < Number(item.lowestPrice ?? oldPrice)) {
          item.lowestPrice = newPrice;
        }
      }

      toSave.push(item);

      // Queue notification if price dropped and meets threshold
      if (isPriceDrop && item.notificationsEnabled) {
        const threshold = item.priceAlertThreshold;
        const shouldNotify = threshold == null || newPrice <= Number(threshold);
        if (shouldNotify) {
          notifications.push({
            userId: item.wishlist.userId,
            item,
            oldPrice,
            newPrice,
          });
        }
      }
    }

    if (toSave.length) {
      await this.itemRepo.save(toSave);
    }

    // Fire notifications (non-blocking)
    if (notifications.length) {
      const serviceToUse = notificationService || this.notificationsService;
      await Promise.allSettled(
        notifications.map(async ({ userId, item, oldPrice, newPrice }) => {
          const savings = oldPrice - newPrice;
          const savingsPercent = Math.round((savings / oldPrice) * 100);
          
          // Create notification using the actual notification service
          await serviceToUse.createNotification({
            userId,
            title: `Price Drop Alert!`,
            message: `${item.productName} has dropped from $${oldPrice.toFixed(2)} to $${newPrice.toFixed(2)} (${savingsPercent}% off)!`,
            type: NotificationType.PRICE_DROP,
            channel: NotificationChannel.IN_APP,
            priority: NotificationPriority.MEDIUM,
            metadata: {
              wishlistId: item.wishlistId,
              wishlistName: item.wishlist?.name ?? '',
              productId: item.productId,
              productName: item.productName,
              oldPrice,
              newPrice,
              savings,
              savingsPercent,
            },
          } as any);
        }),
      );
    }

    this.logger.log(
      `Price sync: updated ${toSave.length} items, fired ${notifications.length} notifications`,
    );
  }
}