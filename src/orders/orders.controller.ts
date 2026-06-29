import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Res,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { OrdersExportService } from './orders-export.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import {
  OrderCreatedEvent,
  OrderCancelledEvent,
  EventNames,
} from '../common/events';
import { IdempotencyService } from '../common/idempotency/idempotency.service';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersExportService: OrdersExportService,
    private readonly eventEmitter: EventEmitter2,
    private readonly idempotencyService: IdempotencyService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    // Behavior when the Idempotency-Key header is missing:
    // proceed normally without idempotency. This matches the service's
    // "opt-in" contract (no key => no de-duplication, no 400).
    if (!idempotencyKey) {
      return await this.processOrderCreation(createOrderDto);
    }

    const responseCacheKey = `idempotency-response:${idempotencyKey}`;
    const cachedResponse = await this.cache.get<Order>(responseCacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    const { executed, result } = await this.idempotencyService.executeOnce<
      Awaited<ReturnType<OrdersService['create']>>
    >(idempotencyKey, async () => {
      const order = await this.processOrderCreation(createOrderDto);
      await this.cache.set(responseCacheKey, order, 24 * 60 * 60 * 1000);
      return order;
    });

    // executed=false covers two cases the service does not distinguish:
    //   1) another request with this key is currently in-flight
    //   2) the key was already processed (timestamp present in cache)
    // In both, fall back to the cached response if available; otherwise
    // re-run so the caller still gets a deterministic answer rather than
    // a silent empty result.
    if (!executed) {
      const replayed = await this.cache.get<Order>(responseCacheKey);
      if (replayed) {
        return replayed;
      }
      return await this.processOrderCreation(createOrderDto);
    }

    return result!;
  }

  private async processOrderCreation(
    createOrderDto: CreateOrderDto,
  ): Promise<Awaited<ReturnType<OrdersService['create']>>> {
    const order = await this.ordersService.create(createOrderDto);

    this.eventEmitter.emit(
      EventNames.ORDER_CREATED,
      new OrderCreatedEvent(
        order.id,
        order.buyerId,
        `ORD-${order.id.substring(0, 8)}`,
        order.totalAmount,
        order.items,
        order.currency,
      ),
    );

    return order;
  }

  @Get()
  async findAll(@Query('buyerId') buyerId?: string) {
    return await this.ordersService.findAll(buyerId);
  }

  @Get('export')
  async exportOrders(
    @Query('format') format: string,
    @Query('buyerId') buyerId: string,
    @Res() res: Response,
  ) {
    if (!buyerId) {
      throw new Error('Buyer ID is required to export orders');
    }

    if (format !== 'csv' && format !== 'pdf') {
      throw new Error('Format must be either csv or pdf');
    }

    const orders = await this.ordersService.findAll(buyerId);

    if (format === 'csv') {
      return this.ordersExportService.exportAsCsv(orders, res);
    } else {
      return this.ordersExportService.exportAsPdf(orders, res);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return await this.ordersService.updateStatus(id, updateOrderStatusDto);
  }

  @Patch(':id/cancel')
  async cancelOrder(@Param('id') id: string, @Body('userId') userId: string) {
    if (!userId) {
      throw new Error('User ID is required to cancel an order');
    }
    const order = await this.ordersService.cancelOrder(id, userId);

    this.eventEmitter.emit(
      EventNames.ORDER_CANCELLED,
      new OrderCancelledEvent(
        order.id,
        order.buyerId,
        `ORD-${order.id.substring(0, 8)}`,
        'User requested cancellation',
      ),
    );

    return order;
  }
}
