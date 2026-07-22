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
  UseGuards,
  Request,
  Inject,
  Res,
  ConflictException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
    @Request() req: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    // The buyer is always the authenticated caller, never a client-supplied value.
    const dto = { ...createOrderDto, buyerId: req.user.id };

    // Behavior when the Idempotency-Key header is missing:
    // proceed normally without idempotency. This matches the service's
    // "opt-in" contract (no key => no de-duplication, no 400).
    if (!idempotencyKey) {
      return await this.processOrderCreation(dto);
    }

    const responseCacheKey = `idempotency-response:${idempotencyKey}`;
    const cachedResponse = await this.cache.get<Order>(responseCacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    const { executed, result } = await this.idempotencyService.executeOnce<
      Awaited<ReturnType<OrdersService['create']>>
    >(idempotencyKey, async () => {
      const order = await this.processOrderCreation(dto);
      await this.cache.set(responseCacheKey, order, 24 * 60 * 60 * 1000);
      return order;
    });

    // executed=false covers two cases the service does not distinguish:
    //   1) another request with this key is currently in-flight
    //   2) the key was already processed (timestamp present in cache)
    // In both, fall back to the cached response if available; otherwise
    // fail fast so the same key cannot create a duplicate order.
    if (!executed) {
      const replayed = await this.cache.get<Order>(responseCacheKey);
      if (replayed) {
        return replayed;
      }

      throw new ConflictException(
        'An order request with this Idempotency-Key is already in progress. Please retry shortly.',
      );
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
  async findAll(@Request() req: any, @Query('buyerId') buyerId?: string) {
    // Only admins may look up another buyer's orders; everyone else is
    // scoped to their own, regardless of what the query string says.
    const scopedBuyerId = req.user.role === 'admin' ? buyerId : req.user.id;
    return await this.ordersService.findAll(scopedBuyerId);
  }

  @Get('export')
  async exportOrders(
    @Query('format') format: string,
    @Query('buyerId') buyerId: string,
    @Res() res: Response,
    @Request() req: any,
  ) {
    // Only admins may export another buyer's order history; everyone else
    // is scoped to their own, regardless of what the query string says.
    const scopedBuyerId = req.user.role === 'admin' ? buyerId : req.user.id;

    if (!scopedBuyerId) {
      throw new Error('Buyer ID is required to export orders');
    }

    if (format !== 'csv' && format !== 'pdf') {
      throw new Error('Format must be either csv or pdf');
    }

    const orders = await this.ordersService.findAll(scopedBuyerId);

    if (format === 'csv') {
      return this.ordersExportService.exportAsCsv(orders, res);
    } else {
      return this.ordersExportService.exportAsPdf(orders, res);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return await this.ordersService.findOne(id, req.user);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    @Request() req: any,
  ) {
    return await this.ordersService.updateStatus(
      id,
      updateOrderStatusDto,
      req.user,
    );
  }

  @Patch(':id/cancel')
  async cancelOrder(@Param('id') id: string, @Request() req: any) {
    const order = await this.ordersService.cancelOrder(id, req.user.id);

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
