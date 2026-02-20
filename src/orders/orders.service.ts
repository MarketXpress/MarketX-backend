import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { CreateOrderDto, OrderStatus, UpdateOrderStatusDto } from './dto/create-order.dto';
import { PricingService, SupportedCurrency } from '../products/services/pricing.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private readonly pricingService: PricingService,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    // In a real application, you would fetch product details from a database
    // For now, we'll simulate calculating the total
    
    // Simulate fetching product prices (in a real app, you'd query the products service)
    const simulatedProductPrices: Record<
      string,
      { price: number; currency: SupportedCurrency }
    > = {
      '1': { price: 10.99, currency: SupportedCurrency.USD },
      '2': { price: 24.99, currency: SupportedCurrency.USD },
      '3': { price: 5.49, currency: SupportedCurrency.USD },
    };

    const paymentCurrency = createOrderDto.paymentCurrency ?? SupportedCurrency.USD;
    const subtotals: number[] = [];

    const itemsWithDetails = createOrderDto.items.map(item => {
      const productPricing = simulatedProductPrices[item.productId] || {
        price: 0,
        currency: SupportedCurrency.USD,
      };
      const convertedPrice = this.pricingService.convertAmount(
        productPricing.price,
        productPricing.currency,
        paymentCurrency,
      );
      const subtotal = this.pricingService.multiplyAmount(
        convertedPrice,
        item.quantity,
        paymentCurrency,
      );
      subtotals.push(subtotal);
      
      return {
        productId: item.productId,
        productName: `Product ${item.productId}`, // In real app, fetch from product service
        quantity: item.quantity,
        price: convertedPrice,
        subtotal,
        priceCurrency: paymentCurrency,
      };
    });

    const totalAmount = this.pricingService.addAmounts(subtotals, paymentCurrency);

    const order = this.ordersRepository.create({
      totalAmount,
      currency: paymentCurrency,
      status: OrderStatus.PENDING,
      items: itemsWithDetails,
      buyerId: createOrderDto.buyerId,
    });

    return await this.ordersRepository.save(order);
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

  async updateStatus(id: string, updateOrderStatusDto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.findOne(id);
    
    // Validate state transition
    if (!this.isValidStateTransition(order.status, updateOrderStatusDto.status)) {
      throw new BadRequestException(
        `Invalid state transition from ${order.status} to ${updateOrderStatusDto.status}`
      );
    }

    // Update timestamps based on status
    const now = new Date();
    switch (updateOrderStatusDto.status) {
      case OrderStatus.CANCELLED:
        order.cancelledAt = now;
        break;
      case OrderStatus.SHIPPED:
        order.shippedAt = now;
        break;
      case OrderStatus.DELIVERED:
        order.deliveredAt = now;
        break;
    }

    order.status = updateOrderStatusDto.status;
    order.updatedAt = now;

    return await this.ordersRepository.save(order);
  }

  async cancelOrder(id: string, userId: string): Promise<Order> {
    const order = await this.findOne(id);

    // Business rule: Only allow cancellation for pending/paid orders
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAID) {
      throw new BadRequestException(
        `Cannot cancel order with status ${order.status}. Only pending or paid orders can be cancelled.`
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

  private isValidStateTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
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