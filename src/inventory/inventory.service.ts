import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Connection } from 'typeorm';
import { Listing } from '../listing/entities/listing.entity';
import { InventoryHistory, InventoryChangeType } from './inventory-history.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Order } from '../orders/entities/order.entity';

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
        await this.notifyLowStock(listing);
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
      if (listing.available <= 5) {
        await this.notifyLowStock(listing);
      }
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
          await this.notifyLowStock(listing);
        }
        results.push(listing);
      }
      return results;
    });
  }

  /**
   * Reserve inventory for an order during checkout
   */
  async reserveForOrder(order: Order) {
    return this.connection.transaction(async manager => {
      for (const item of order.items) {
        const listing = await manager.findOne(Listing, { where: { id: item.productId } });
        if (!listing) {
          throw new NotFoundException(`Listing ${item.productId} not found`);
        }
        if (listing.available < item.quantity) {
          throw new BadRequestException(`Not enough inventory for ${item.productName}. Available: ${listing.available}, Requested: ${item.quantity}`);
        }
        
        // Reserve the quantity
        listing.reserved += item.quantity;
        listing.available = listing.quantity - listing.reserved;
        await manager.save(listing);
        
        // Log the reservation
        const history = this.historyRepo.create({
          listingId: item.productId,
          userId: order.buyerId,
          change: item.quantity,
          type: InventoryChangeType.RESERVATION,
          note: `Reserved for order ${order.id}`,
        });
        await manager.save(history);
      }
    });
  }

  /**
   * Confirm inventory reservation when order is paid (convert reservation to purchase)
   */
  async confirmOrder(order: Order) {
    return this.connection.transaction(async manager => {
      for (const item of order.items) {
        const listing = await manager.findOne(Listing, { where: { id: item.productId } });
        if (!listing) {
          throw new NotFoundException(`Listing ${item.productId} not found`);
        }
        
        // Reduce the available quantity (since it was already reserved)
        listing.quantity -= item.quantity;
        listing.reserved -= item.quantity;
        if (listing.reserved < 0) listing.reserved = 0;
        listing.available = listing.quantity - listing.reserved;
        await manager.save(listing);
        
        // Log the purchase
        const history = this.historyRepo.create({
          listingId: item.productId,
          userId: order.buyerId,
          change: -item.quantity,
          type: InventoryChangeType.PURCHASE,
          note: `Order ${order.id} confirmed`,
        });
        await manager.save(history);
        
        // Check if low stock notification is needed
        if (listing.available <= 5) {
          await this.notifyLowStock(listing);
        }
      }
    });
  }

  /**
   * Release reserved inventory when order is cancelled
   */
  async cancelOrder(order: Order) {
    return this.connection.transaction(async manager => {
      for (const item of order.items) {
        const listing = await manager.findOne(Listing, { where: { id: item.productId } });
        if (!listing) {
          throw new NotFoundException(`Listing ${item.productId} not found`);
        }
        
        // Release the reserved quantity
        listing.reserved -= item.quantity;
        if (listing.reserved < 0) listing.reserved = 0;
        listing.available = listing.quantity - listing.reserved;
        await manager.save(listing);
        
        // Log the release
        const history = this.historyRepo.create({
          listingId: item.productId,
          userId: order.buyerId,
          change: item.quantity,
          type: InventoryChangeType.CANCELLATION,
          note: `Order ${order.id} cancelled`,
        });
        await manager.save(history);
      }
    });
  }

  /**
   * Restore inventory when order is refunded
   */
  async restoreInventoryFromRefund(order: Order) {
    return this.connection.transaction(async manager => {
      for (const item of order.items) {
        const listing = await manager.findOne(Listing, { where: { id: item.productId } });
        if (!listing) {
          throw new NotFoundException(`Listing ${item.productId} not found`);
        }
        
        // Increase quantity (restore stock)
        listing.quantity += item.quantity;
        listing.available = listing.quantity - listing.reserved;
        await manager.save(listing);
        
        // Log the restoration
        const history = this.historyRepo.create({
          listingId: item.productId,
          userId: order.buyerId,
          change: item.quantity,
          type: InventoryChangeType.REFUND,
          note: `Order ${order.id} refunded`,
        });
        await manager.save(history);
        
        // Check if low stock notification is needed
        if (listing.available <= 5) {
          await this.notifyLowStock(listing);
        }
      }
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

  /**
   * Send low stock notification to seller
   */
  private async notifyLowStock(listing: Listing) {
    try {
      // Find the seller ID from the listing
      const userId = listing.userId;
      
      await this.notificationsService.createNotification({
        userId,
        title: 'Low Stock Alert',
        message: `Your listing "${listing.title}" has low stock. Only ${listing.available} items remaining.`,
        type: 'inventory_low_stock',
        channel: 'in_app',
        priority: 'high',
        metadata: {
          listingId: listing.id,
          available: listing.available,
          threshold: 5,
        },
      } as any);
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Failed to send low stock notification:', error);
    }
  }
} 