import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import {
  CreateOrderDto,
  OrderStatus,
  UpdateOrderStatusDto,
} from './dto/create-order.dto';
import {
  PricingService,
  SupportedCurrency,
} from '../products/services/pricing.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  OrderCreatedEvent,
  OrderUpdatedEvent,
} from '../notifications/events/order.events';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private readonly pricingService: PricingService,
    private readonly eventEmitter: EventEmitter2,
    private readonly inventoryService: InventoryService,
  ) { }
    private dataSource: DataSource,
    private inventoryService: InventoryService,
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
      // Confirm the order and reduce inventory
      await this.inventoryService.confirmOrder(order);
      order.status = OrderStatus.PAID;
    } else if (updateOrderStatusDto.status === OrderStatus.CANCELLED) {
      // Cancel the order and release inventory
      await this.inventoryService.cancelOrder(order);
      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = new Date();
    } else {
      // Validate state transition for other statuses
      if (
        !this.isValidStateTransition(order.status, updateOrderStatusDto.status)
      ) {
        throw new BadRequestException(
          `Invalid state transition from ${order.status} to ${updateOrderStatusDto.status}`,
        );
      }

      // Update timestamps based on status
      const now = new Date();
      switch (updateOrderStatusDto.status) {
        case OrderStatus.SHIPPED:
          order.shippedAt = now;
          break;
        case OrderStatus.DELIVERED:
          order.deliveredAt = now;
          break;
      }

    // Validate state transition
    if (
      !this.isValidStateTransition(order.status, updateOrderStatusDto.status)
    ) {
      throw new BadRequestException(
        `Invalid state transition from ${order.status} to ${updateOrderStatusDto.status}`,
      );
    }

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

  async cancelOrder(id: string, userId: string): Promise<Order> {
    const order = await this.findOne(id);

    // Business rule: Only allow cancellation for pending/paid orders
    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.PAID
    ) {
      throw new BadRequestException(
        `Cannot cancel order with status ${order.status}. Only pending or paid orders can be cancelled.`,
      );
    }

    // Business rule: Only the buyer can cancel their own order
    if (order.buyerId !== userId) {
      throw new BadRequestException('Only the buyer can cancel their order');
    }

    const updateOrderStatusDto: UpdateOrderStatusDto = {
      status: OrderStatus.CANCELLED,
    };

    return this.updateStatus(id, updateOrderStatusDto);
  }

  private isValidStateTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): boolean {
    // Define valid state transitions
    const validTransitions: { [key in OrderStatus]: OrderStatus[] } = {
      [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    const allowedTransitions = validTransitions[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
  }
}
