import { Controller, Get, Post, Body, Patch, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createOrderDto: CreateOrderDto) {
    const order = await this.ordersService.create(createOrderDto);
    // Emit event: OrderCreated
    console.log(`Event emitted: OrderCreated - Order ID: ${order.id}`);
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
    @Body() updateOrderStatusDto: UpdateOrderStatusDto
  ) {
    const order = await this.ordersService.updateStatus(id, updateOrderStatusDto);
    // Emit event: OrderStatusChanged
    console.log(`Event emitted: OrderStatusChanged - Order ID: ${order.id}, Status: ${order.status}`);
    return order;
  }

  @Patch(':id/cancel')
  async cancelOrder(
    @Param('id') id: string,
    @Body('userId') userId: string  // In a real app, this would come from authentication
  ) {
    if (!userId) {
      throw new Error('User ID is required to cancel an order');
    }
    const order = await this.ordersService.cancelOrder(id, userId);
    // Emit event: OrderCancelled
    console.log(`Event emitted: OrderCancelled - Order ID: ${order.id}`);
    return order;
  }
}