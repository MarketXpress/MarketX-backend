import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Connection } from 'typeorm';
import { Listing } from '../listing/entities/listing.entity';
import { InventoryHistory, InventoryChangeType } from './inventory-history.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    @InjectRepository(InventoryHistory)
    private readonly historyRepo: Repository<InventoryHistory>,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    private readonly connection: Connection,
  ) {}

  async adjustInventory(listingId: string, userId: string, change: number, type: InventoryChangeType, note?: string) {
    return this.connection.transaction(async manager => {
      const listing = await manager.findOne(Listing, { where: { id: listingId } });
      if (!listing) throw new NotFoundException('Listing not found');
      listing.quantity += change;
      listing.available = listing.quantity - listing.reserved;
      if (listing.available < 0) throw new BadRequestException('Insufficient inventory');
      await manager.save(listing);
      const history = this.historyRepo.create({ listingId, userId, change, type, note });
      await manager.save(history);
      if (listing.available <= 5) {
        // await this.notificationsService.notifyLowStock(listing);
      }
      return listing;
    });
  }

  async reserveInventory(listingId: string, userId: string, amount: number) {
    return this.connection.transaction(async manager => {
      const listing = await manager.findOne(Listing, { where: { id: listingId } });
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.available < amount) throw new BadRequestException('Not enough available inventory');
      listing.reserved += amount;
      listing.available = listing.quantity - listing.reserved;
      await manager.save(listing);
      const history = this.historyRepo.create({ listingId, userId, change: amount, type: InventoryChangeType.RESERVATION });
      await manager.save(history);
      return listing;
    });
  }

  async releaseInventory(listingId: string, userId: string, amount: number) {
    return this.connection.transaction(async manager => {
      const listing = await manager.findOne(Listing, { where: { id: listingId } });
      if (!listing) throw new NotFoundException('Listing not found');
      listing.reserved -= amount;
      if (listing.reserved < 0) listing.reserved = 0;
      listing.available = listing.quantity - listing.reserved;
      await manager.save(listing);
      const history = this.historyRepo.create({ listingId, userId, change: -amount, type: InventoryChangeType.RELEASE });
      await manager.save(history);
      return listing;
    });
  }

  async bulkUpdateInventory(updates: { listingId: string; userId: string; change: number; note?: string }[]) {
    return this.connection.transaction(async manager => {
      const results: Listing[] = [];
      for (const update of updates) {
        const listing = await manager.findOne(Listing, { where: { id: update.listingId } });
        if (!listing) continue;
        listing.quantity += update.change;
        listing.available = listing.quantity - listing.reserved;
        await manager.save(listing);
        const history = this.historyRepo.create({
          listingId: update.listingId,
          userId: update.userId,
          change: update.change,
          type: InventoryChangeType.BULK_UPDATE,
          note: update.note,
        });
        await manager.save(history);
        if (listing.available <= 5) {
          // await this.notificationsService.notifyLowStock(listing);
        }
        results.push(listing);
      }
      return results;
    });
  }

  async getInventoryHistory(listingId: string) {
    return this.historyRepo.find({ where: { listingId }, order: { createdAt: 'DESC' } });
  }

  async getInventory(listingId: string) {
    const listing = await this.listingRepo.findOne({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    return {
      quantity: listing.quantity,
      reserved: listing.reserved,
      available: listing.available,
    };
  }
} 