import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import {
  CreateShipmentDto,
  UpdateShipmentStatusDto,
  ShipmentResponseDto,
  CarrierInfoDto,
} from './dto/create-shipment.dto';

@ApiTags('Shipping')
@Controller()
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('orders/:id/shipment')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a shipment for an order' })
  @ApiResponse({
    status: 201,
    description: 'Shipment created',
    type: ShipmentResponseDto,
  })
  async createShipment(
    @Param('id') orderId: string,
    @Body() createShipmentDto: CreateShipmentDto,
  ): Promise<ShipmentResponseDto> {
    // Override orderId from the URL param
    createShipmentDto.orderId = orderId;
    const shipment =
      await this.shippingService.createShipment(createShipmentDto);
    console.log(
      `Event emitted: ShipmentCreated - Shipment ID: ${shipment.id}, Order ID: ${orderId}`,
    );
    return shipment;
  }

  @Get('shipments/:trackingNumber')
  @ApiOperation({ summary: 'Look up shipment by tracking number' })
  @ApiResponse({
    status: 200,
    description: 'Shipment found',
    type: ShipmentResponseDto,
  })
  async findByTrackingNumber(
    @Param('trackingNumber') trackingNumber: string,
  ): Promise<ShipmentResponseDto> {
    return this.shippingService.findByTrackingNumber(trackingNumber);
  }

  @Get('shipments/order/:orderId')
  @ApiOperation({ summary: 'Get shipment for an order' })
  @ApiResponse({
    status: 200,
    description: 'Shipment found',
    type: ShipmentResponseDto,
  })
  async findByOrderId(
    @Param('orderId') orderId: string,
  ): Promise<ShipmentResponseDto> {
    return this.shippingService.findByOrderId(orderId);
  }

  @Patch('shipments/:id/status')
  @ApiOperation({ summary: 'Update shipment status' })
  @ApiResponse({
    status: 200,
    description: 'Status updated',
    type: ShipmentResponseDto,
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateShipmentStatusDto: UpdateShipmentStatusDto,
  ): Promise<ShipmentResponseDto> {
    const shipment = await this.shippingService.updateStatus(
      id,
      updateShipmentStatusDto,
    );
    console.log(
      `Event emitted: ShipmentStatusChanged - Shipment ID: ${shipment.id}, Status: ${shipment.status}`,
    );
    return shipment;
  }

  @Get('shipping/carriers')
  @ApiOperation({ summary: 'List all supported shipping carriers' })
  @ApiResponse({
    status: 200,
    description: 'List of carriers',
    type: [CarrierInfoDto],
  })
  getCarriers(): CarrierInfoDto[] {
    return this.shippingService.getCarrierInfo();
  }
}
