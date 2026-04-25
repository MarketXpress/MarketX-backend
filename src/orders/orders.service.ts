import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { OrderUpdatedEvent, OrderCompletedEvent, EventNames } from '../common/events';
import { PricingService } from '../products/services/pricing.service';
import { SupportedCurrency } from '../products/services/pricing.service';
import { ProductsService } from '../products/products.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { AdminWebhookService } from '../admin/admin-webhook.service';
import { PaymentStatus } from '../payments/dto/payment.dto';
import { StatusTransitionValidator } from '../common/validators';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class OrdersService {
  // Order status transition validator
  private readonly orderTransitionValidator = new StatusTransitionValidator<OrderStatus>(
    {
      [OrderStatus.PENDING]: [
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
        OrderStatus.MANUAL_REVIEW,
      ],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.REFUNDED],
      [OrderStatus.COMPLETED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
      [OrderStatus.MANUAL_REVIEW]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    },
    'Order',
  );

  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private dataSource: DataSource,
    private readonly pricingService: PricingService,
    private readonly productsService: ProductsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly inventoryService: InventoryService,
    private readonly adminWebhookService: AdminWebhookService,
    private readonly logger: LoggerService,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    return await this.dataSource.transaction(async (manager) => {
      const paymentCurrency =
        createOrderDto.paymentCurrency || SupportedCurrency.USD;

      const orderItems = createOrderDto.items.map((item) => {
        const product = this.productsService.findOne(
          item.productId,
          paymentCurrency,
        );

        if (!product) {
          throw new NotFoundException(
            `Product with ID ${item.productId} not found`,
          );
        }

        if (product.currency !== paymentCurrency) {
          throw new BadRequestException(
            `Product ${item.productId} currency ${product.currency} does not match order currency ${paymentCurrency}`,
          );
        }

        const price = Number(product.price);
        const subtotal = price * item.quantity;

        return {
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          price,
          subtotal,
          priceCurrency: product.currency,
        };
      });

      const orderMilestones = createOrderDto.milestones?.map((milestone) => ({
        title: milestone.title,
        description: milestone.description,
        amount: milestone.amount,
        percentage: milestone.percentage,
        type: milestone.type || 'standard',
        trigger: milestone.trigger || 'manual',
        autoRelease: milestone.autoRelease || false,
        sortOrder: milestone.sortOrder || 0,
      }));

      const totalAmount = orderItems.reduce(
        (sum, item) => sum + item.subtotal,
        0,
      );

      if (totalAmount <= 0) {
        throw new BadRequestException('Order total amount must be greater than zero');
      }

      const totalMilestoneAmount = orderMilestones?.reduce(
        (sum, milestone) => sum + milestone.amount,
        0,
      );

      if (totalMilestoneAmount && totalMilestoneAmount > totalAmount) {
        throw new BadRequestException(
          'Total milestone amount cannot exceed order total',
        );
      }

      const order = manager.create(Order, {
        buyerId: createOrderDto.buyerId,
        totalAmount,
        currency: paymentCurrency,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        items: orderItems,
        escrowType: createOrderDto.escrowType,
        milestones: orderMilestones,
        releasedAmount: 0,
        remainingAmount: totalAmount,
        shippingAddress: createOrderDto.shippingAddress,
      });

      const savedOrder = await manager.save(order);

      this.logger.info('Order created', {
        orderId: savedOrder.id,
        buyerId: savedOrder.buyerId,
        totalAmount: savedOrder.totalAmount,
        currency: savedOrder.currency,
      });

      for (const item of savedOrder.items) {
        await this.inventoryService.reserveInventory(
          item.productId,
          savedOrder.buyerId,
          item.quantity,
          manager,
        );
      }

      if (savedOrder.totalAmount > 5000) {
        await this.adminWebhookService.notifyAdmin('Massive Order Detected', {
          orderId: savedOrder.id,
          buyerId: savedOrder.buyerId,
          amount: savedOrder.totalAmount,
          itemCount: savedOrder.items.length,
        });
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
      const cancelledOrder = await manager.save(order);

      this.logger.info('Order cancelled', {
        orderId: cancelledOrder.id,
        buyerId: userId,
      });

      return cancelledOrder;
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

    // Validate status transition
    this.orderTransitionValidator.validate(
      previousStatus,
      updateOrderStatusDto.status,
    );

    // Handle inventory based on status change
    if (updateOrderStatusDto.status === OrderStatus.PAID) {
      await this.inventoryService.confirmOrder(order);
      order.paymentStatus = PaymentStatus.PAID;
      order.confirmedAt = new Date();
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

    this.logger.info('Order status updated', {
      orderId: updatedOrder.id,
      previousStatus,
      newStatus: updatedOrder.status,
    });

    this.eventEmitter.emit(
      EventNames.ORDER_UPDATED,
      new OrderUpdatedEvent(
        updatedOrder.id,
        updatedOrder.buyerId,
        `ORD-${updatedOrder.id.substring(0, 8)}`,
        updatedOrder.status,
        previousStatus,
      ),
    );

    // Emit order.completed event when order is completed
    if (updateOrderStatusDto.status === OrderStatus.COMPLETED) {
      this.eventEmitter.emit(
        EventNames.ORDER_COMPLETED,
        new OrderCompletedEvent(
          updatedOrder.id,
          updatedOrder.buyerId,
          `ORD-${updatedOrder.id.substring(0, 8)}`,
          Number(updatedOrder.totalAmount),
        ),
      );
    }

    return updatedOrder;
  }
}
