import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import {
  OrderCreatedEvent,
  OrderCancelledEvent,
  EventNames,
} from '../common/events';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createOrderDto: CreateOrderDto) {
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
