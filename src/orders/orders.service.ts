import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  OrderUpdatedEvent,
  OrderCompletedEvent,
  EventNames,
} from '../common/events';
import { SupportedCurrency } from '../products/services/pricing.service';
import { ProductsService } from '../products/products.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import { Order, OrderStatus, PaymentStatus } from './entities/order.entity';
import { StatusTransitionValidator } from '../common/validators';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class OrdersService {
  private readonly orderTransitionValidator =
    new StatusTransitionValidator<OrderStatus>(
      {
        [OrderStatus.PENDING]: [
          OrderStatus.CONFIRMED,
          OrderStatus.CANCELLED,
          OrderStatus.MANUAL_REVIEW,
        ],
        [OrderStatus.CONFIRMED]: [
          OrderStatus.PROCESSING,
          OrderStatus.CANCELLED,
        ],
        [OrderStatus.PROCESSING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
        [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
        [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.REFUNDED],
        [OrderStatus.COMPLETED]: [OrderStatus.REFUNDED],
        [OrderStatus.CANCELLED]: [],
        [OrderStatus.REFUNDED]: [],
        [OrderStatus.MANUAL_REVIEW]: [
          OrderStatus.CONFIRMED,
          OrderStatus.CANCELLED,
        ],
      },
      'Order',
    );

  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private dataSource: DataSource,
    private readonly productsService: ProductsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    this.logger.info('Creating order', { buyerId: createOrderDto.buyerId });
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

      const totalAmount = orderItems.reduce(
        (sum, item) => sum + item.subtotal,
        0,
      );

      if (totalAmount <= 0) {
        throw new BadRequestException(
          'Order total amount must be greater than zero',
        );
      }

      const order = manager.create(Order, {
        buyerId: createOrderDto.buyerId,
        totalAmount,
        currency: paymentCurrency,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        items: orderItems,
        releasedAmount: 0,
        remainingAmount: totalAmount,
        shippingAddress: createOrderDto.shippingAddress,
      });

      const savedOrder = await manager.save(order);

      this.logger.info('Order created', {
        orderId: savedOrder.id,
        buyerId: savedOrder.buyerId,
        totalAmount: savedOrder.totalAmount,
      });

      return savedOrder;
    });
  }

  async cancelOrder(id: string, userId: string): Promise<Order> {
    this.logger.info('Cancelling order', { orderId: id, userId });
    return await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id } });

      if (!order || order.buyerId !== userId) {
        throw new BadRequestException('Order not found or unauthorized');
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Order is already cancelled');
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
      return await this.ordersRepository.find({
        where: { buyerId },
        order: { createdAt: 'DESC' },
      });
    }
    return await this.ordersRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }
    return order;
  }

  async updateStatus(
    id: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
  ): Promise<Order> {
    this.logger.info('Updating order status', {
      orderId: id,
      newStatus: updateOrderStatusDto.status,
    });
    const order = await this.findOne(id);
    const previousStatus = order.status;

    this.orderTransitionValidator.validate(
      previousStatus,
      updateOrderStatusDto.status,
    );

    if (updateOrderStatusDto.status === OrderStatus.PAID) {
      order.paymentStatus = PaymentStatus.PAID;
      order.confirmedAt = new Date();
    } else if (updateOrderStatusDto.status === OrderStatus.CANCELLED) {
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
      EventNames.ORDER_UPDATED,
      new OrderUpdatedEvent(
        updatedOrder.id,
        updatedOrder.buyerId,
        `ORD-${updatedOrder.id.substring(0, 8)}`,
        updatedOrder.status,
        previousStatus,
      ),
    );

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
