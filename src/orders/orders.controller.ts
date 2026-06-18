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
  UseGuards,
  Request,
  Res,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Response } from 'express';
import { OrdersService } from './orders.service';
import { OrdersExportService } from './orders-export.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  OrderCreatedEvent,
  OrderCancelledEvent,
  EventNames,
} from '../common/events';

@ApiTags('Orders')
@UseGuards(JwtAuthGuard) // Protect standard resource access layers explicitly
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersExportService: OrdersExportService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @ApiOperation({ summary: 'Create a new order' })
  @ApiBody({ type: CreateOrderDto })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(ValidationPipe) createOrderDto: CreateOrderDto, @Request() req) {
    // Force the order creation context to match the authenticated user's integer ID
    const order = await this.ordersService.create({
      ...createOrderDto,
      buyerId: Number(req.user.id),
    });

    // FIX: Explicitly wrapped order.id with String() to prevent serialization 
    // crashes if your order model uses numeric primary tracking keys.
    const orderStringId = String(order.id);
    const orderRef = `ORD-${orderStringId.substring(0, 8)}`;

    this.eventEmitter.emit(
      EventNames.ORDER_CREATED,
      new OrderCreatedEvent(
        order.id,
        order.buyerId,
        orderRef,
        order.totalAmount,
        order.items,
        order.currency,
      ),
    );

    return order;
  }

  @ApiOperation({ summary: 'Export user order history as CSV or PDF' })
  @ApiQuery({ name: 'format', description: 'Export format targeting "csv" or "pdf"', example: 'csv' })
  @Get('export')
  async exportOrders(
    @Query('format') format: string,
    @Request() req,
    @Res() res: Response,
  ) {
    if (!format) {
      throw new BadRequestException('Export query format parameter matching "csv" or "pdf" is required.');
    }

    // Force integer type evaluations for our database lookup routines
    const authenticatedUserId = Number(req.user.id);
    const orders = await this.ordersService.findAllForUser(authenticatedUserId);
    const userEmail = req.user.email || 'user@associated-identity.com';
    const normalizedFormat = format.toLowerCase().trim();

    switch (normalizedFormat) {
      case 'csv': {
        const csvData = await this.ordersExportService.exportToCsv(orders);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=order_history_${authenticatedUserId}.csv`);
        return res.status(HttpStatus.OK).send(csvData);
      }

      case 'pdf': {
        const pdfBuffer = await this.ordersExportService.exportToPdf(orders, userEmail);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=order_history_${authenticatedUserId}.pdf`);
        return res.status(HttpStatus.OK).send(pdfBuffer);
      }

      default:
        throw new BadRequestException(`The file transmission target format "${format}" is not supported.`);
    }
  }

  @ApiOperation({ summary: 'Find all orders for user context' })
  @Get()
  async findAll(@Request() req) {
    // Scoped directly over active session contexts to prevent data leak exposures
    return await this.ordersService.findAllForUser(Number(req.user.id));
  }

  @ApiOperation({ summary: 'Find specific order by ID reference' })
  @ApiParam({ name: 'id', type: 'string', description: 'Order target identifier key' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.ordersService.findOne(id);
  }

  @ApiOperation({ summary: 'Update an order status code context' })
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body(ValidationPipe) updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return await this.ordersService.updateStatus(id, updateOrderStatusDto);
  }

  @ApiOperation({ summary: 'Cancel an open active order transaction record' })
  @Patch(':id/cancel')
  async cancelOrder(@Param('id') id: string, @Request() req) {
    const authenticatedUserId = Number(req.user.id);
    const order = await this.ordersService.cancelOrder(id, authenticatedUserId);

    const orderStringId = String(order.id);
    const orderRef = `ORD-${orderStringId.substring(0, 8)}`;

    this.eventEmitter.emit(
      EventNames.ORDER_CANCELLED,
      new OrderCancelledEvent(
        order.id,
        order.buyerId,
        orderRef,
        'User requested cancellation',
      ),
    );

    return order;
  }
}