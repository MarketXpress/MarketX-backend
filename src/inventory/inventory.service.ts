import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Listing } from '../listing/entities/listing.entity';
import {
  InventoryHistory,
  InventoryChangeType,
} from './inventory-history.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Product } from '../entities/product.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    @InjectRepository(InventoryHistory)
    private readonly historyRepo: Repository<InventoryHistory>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async adjustInventory(
    listingId: string,
    userId: string,
    change: number,
    type: InventoryChangeType,
    note?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const listing = await manager.findOne(Listing, {
        where: { id: listingId },
      });
      if (!listing) throw new NotFoundException('Listing not found');
      listing.quantity += change;
      listing.available = listing.quantity - listing.reserved;
      if (listing.available < 0)
        throw new BadRequestException('Insufficient inventory');
      await manager.save(listing);
      const history = manager.create(InventoryHistory, {
        listingId,
        userId,
        change,
        type,
        note,
      });
      await manager.save(history);
      return listing;
    });
  }

  async bulkUpdateInventory(
    updates: {
      listingId: string;
      userId: string;
      change: number;
      note?: string;
    }[],
  ) {
    return this.dataSource.transaction(async (manager) => {
      const results: Listing[] = [];
      for (const update of updates) {
        const listing = await manager.findOne(Listing, {
          where: { id: update.listingId },
        });
        if (!listing) continue;
        listing.quantity += update.change;
        listing.available = listing.quantity - listing.reserved;
        await manager.save(listing);
        const history = manager.create(InventoryHistory, {
          listingId: update.listingId,
          userId: update.userId,
          change: update.change,
          type: InventoryChangeType.BULK_UPDATE,
          note: update.note,
        });
        await manager.save(history);
        results.push(listing);
      }
      return results;
    });
  }

  async getInventoryHistory(listingId: string) {
    return this.historyRepo.find({
      where: { listingId },
      order: { createdAt: 'DESC' },
    });
  }

  async getInventory(listingId: string) {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return {
      quantity: listing.quantity,
      reserved: listing.reserved,
      available: listing.available,
    };
  }

  async reserveInventory(
    productId: string,
    userId: string,
    amount: number,
    manager?: EntityManager,
  ) {
    const work = async (em: EntityManager) => {
      const product = await em.findOne(Product, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) throw new NotFoundException('Product not found');

      if (product.available < amount) {
        throw new BadRequestException(
          `Insufficient stock for product: ${product.title}`,
        );
      }

      product.reserved += amount;
      product.available = product.quantity - product.reserved;
      await em.save(product);

      await em.save(
        em.create(InventoryHistory, {
          listingId: productId,
          userId,
          change: amount,
          type: InventoryChangeType.RESERVATION,
          note: `Reserved for checkout`,
        }),
      );

      if (product.available <= 5) {
        this.eventEmitter.emit('inventory.low_stock', {
          productId: product.id,
          title: product.title,
          available: product.available,
        });
      }

      return product;
    };

    return manager ? work(manager) : this.dataSource.transaction(work);
  }

  async releaseInventory(
    productId: string,
    userId: string,
    amount: number,
    manager?: EntityManager,
  ) {
    const work = async (em: EntityManager) => {
      const product = await em.findOne(Product, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) throw new NotFoundException('Product not found');

      product.reserved -= amount;
      if (product.reserved < 0) product.reserved = 0;
      product.available = product.quantity - product.reserved;

      await em.save(product);

      await em.save(
        em.create(InventoryHistory, {
          listingId: productId,
          userId,
          change: -amount,
          type: InventoryChangeType.RELEASE,
          note: 'Reservation released (order cancelled/expired)',
        }),
      );

      return product;
    };

    return manager ? work(manager) : this.dataSource.transaction(work);
  }

  async commitSale(
    productId: string,
    userId: string,
    amount: number,
    manager?: EntityManager,
  ) {
    const work = async (em: EntityManager) => {
      const product = await em.findOne(Product, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) throw new NotFoundException('Product not found');

      product.quantity -= amount;
      product.reserved -= amount;
      if (product.reserved < 0) product.reserved = 0;
      product.available = product.quantity - product.reserved;

      await em.save(product);

      await em.save(
        em.create(InventoryHistory, {
          listingId: productId,
          userId,
          change: -amount,
          type: InventoryChangeType.PURCHASE,
        }),
      );

      return product;
    };

    return manager ? work(manager) : this.dataSource.transaction(work);
  }
}
