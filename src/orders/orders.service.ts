import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { OrderUpdatedEvent } from '../notifications/events/order.events';
import { PricingService } from '../products/services/pricing.service';
import {
  CreateOrderDto,
  OrderStatus,
  UpdateOrderStatusDto,
} from './dto/create-order.dto';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private dataSource: DataSource,
    private readonly pricingService: PricingService,
    private readonly eventEmitter: EventEmitter2,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    return await this.dataSource.transaction(async (manager) => {
      const order = manager.create(Order, {
        ...createOrderDto,
        status: OrderStatus.PENDING,
        items: createOrderDto.items,
      });

      const savedOrder = await manager.save(order);

      for (const item of savedOrder.items) {
        await this.inventoryService.reserveInventory(
          item.productId,
          savedOrder.buyerId,
          item.quantity,
          manager,
        );
      }

      return savedOrder;
    });
  }

  async cancelOrder(id: string, userId: string): Promise<Order> {
    return await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id } });

      if (!order || order.buyerId !== userId) {
        throw new BadRequestException('Order not found or unauthorized');
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Order is already cancelled');
      }

      // Requirement: Restore inventory on order cancellation
      for (const item of order.items) {
        await this.inventoryService.releaseInventory(
          item.productId,
          userId,
          item.quantity,
          manager,
        );
      }

      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = new Date();
      return await manager.save(order);
    });
  }

  async findAll(buyerId?: string): Promise<Order[]> {
    if (buyerId) {
      // Return orders for a specific buyer
      return await this.ordersRepository.find({
        where: { buyerId },
        order: { createdAt: 'DESC' },
      });
    }
    return await this.ordersRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }
    return order;
  }

  async updateStatus(
    id: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
  ): Promise<Order> {
    const order = await this.findOne(id);
    const previousStatus = order.status;

    // Handle inventory based on status change
    if (updateOrderStatusDto.status === OrderStatus.PAID) {
      await this.inventoryService.confirmOrder(order);
    } else if (updateOrderStatusDto.status === OrderStatus.CANCELLED) {
      await this.inventoryService.cancelOrder(order);
      order.cancelledAt = new Date();
    } else {
      const now = new Date();
      switch (updateOrderStatusDto.status) {
        case OrderStatus.SHIPPED:
          order.shippedAt = now;
          break;
        case OrderStatus.DELIVERED:
          order.deliveredAt = now;
          break;
      }
    }
    order.status = updateOrderStatusDto.status;

    const updatedOrder = await this.ordersRepository.save(order);

    this.eventEmitter.emit(
      'order.updated',
      new OrderUpdatedEvent(
        updatedOrder.id,
        updatedOrder.buyerId,
        `ORD-${updatedOrder.id.substring(0, 8)}`,
        updatedOrder.status,
        previousStatus,
      ),
    );

    return updatedOrder;
  }
}
