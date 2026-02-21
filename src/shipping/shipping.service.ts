import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Shipment } from './entities/shipment.entity';
import { Order } from '../orders/entities/order.entity';
import {
  CreateShipmentDto,
  UpdateShipmentStatusDto,
  ShipmentStatus,
  ShippingCarrier,
  ShipmentResponseDto,
  CarrierInfoDto,
} from './dto/create-shipment.dto';
import { OrderStatus } from '../orders/dto/create-order.dto';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  private readonly carrierDetails: CarrierInfoDto[] = [
    {
      carrier: ShippingCarrier.UPS,
      name: 'United Parcel Service',
      trackingUrlTemplate:
        'https://www.ups.com/track?tracknum={trackingNumber}',
      estimatedDeliveryDays: { min: 3, max: 7 },
    },
    {
      carrier: ShippingCarrier.FEDEX,
      name: 'FedEx',
      trackingUrlTemplate:
        'https://www.fedex.com/fedextrack/?trknbr={trackingNumber}',
      estimatedDeliveryDays: { min: 2, max: 5 },
    },
    {
      carrier: ShippingCarrier.DHL,
      name: 'DHL Express',
      trackingUrlTemplate:
        'https://www.dhl.com/en/express/tracking.html?AWB={trackingNumber}',
      estimatedDeliveryDays: { min: 3, max: 10 },
    },
    {
      carrier: ShippingCarrier.USPS,
      name: 'United States Postal Service',
      trackingUrlTemplate:
        'https://tools.usps.com/go/TrackConfirmAction?tLabels={trackingNumber}',
      estimatedDeliveryDays: { min: 5, max: 14 },
    },
    {
      carrier: ShippingCarrier.LOCAL,
      name: 'Local Courier',
      trackingUrlTemplate: '',
      estimatedDeliveryDays: { min: 1, max: 3 },
    },
  ];

  // Valid state transitions for shipment status
  private readonly validTransitions: Record<ShipmentStatus, ShipmentStatus[]> =
    {
      [ShipmentStatus.LABEL_CREATED]: [
        ShipmentStatus.PICKED_UP,
        ShipmentStatus.FAILED,
      ],
      [ShipmentStatus.PICKED_UP]: [
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.FAILED,
      ],
      [ShipmentStatus.IN_TRANSIT]: [
        ShipmentStatus.OUT_FOR_DELIVERY,
        ShipmentStatus.FAILED,
        ShipmentStatus.RETURNED,
      ],
      [ShipmentStatus.OUT_FOR_DELIVERY]: [
        ShipmentStatus.DELIVERED,
        ShipmentStatus.FAILED,
        ShipmentStatus.RETURNED,
      ],
      [ShipmentStatus.DELIVERED]: [],
      [ShipmentStatus.FAILED]: [ShipmentStatus.LABEL_CREATED],
      [ShipmentStatus.RETURNED]: [],
    };

  constructor(
    @InjectRepository(Shipment)
    private shipmentsRepository: Repository<Shipment>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private eventEmitter: EventEmitter2,
  ) {}

  async createShipment(
    createShipmentDto: CreateShipmentDto,
  ): Promise<ShipmentResponseDto> {
    // Find and validate order
    const order = await this.ordersRepository.findOne({
      where: { id: createShipmentDto.orderId },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with ID "${createShipmentDto.orderId}" not found`,
      );
    }

    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException(
        `Order must be in PAID status to create a shipment. Current status: ${order.status}`,
      );
    }

    // Check for existing shipment
    const existingShipment = await this.shipmentsRepository.findOne({
      where: { orderId: createShipmentDto.orderId },
    });

    if (existingShipment) {
      throw new BadRequestException(
        `A shipment already exists for order "${createShipmentDto.orderId}"`,
      );
    }

    // Calculate estimated delivery if not provided
    let estimatedDeliveryDate: Date | undefined;
    if (createShipmentDto.estimatedDeliveryDate) {
      estimatedDeliveryDate = new Date(createShipmentDto.estimatedDeliveryDate);
    } else {
      estimatedDeliveryDate = this.calculateEstimatedDelivery(
        createShipmentDto.carrier,
      );
    }

    // Create shipment
    const shipment = this.shipmentsRepository.create({
      orderId: createShipmentDto.orderId,
      carrier: createShipmentDto.carrier,
      trackingNumber: createShipmentDto.trackingNumber,
      status: ShipmentStatus.LABEL_CREATED,
      shippingAddress: createShipmentDto.shippingAddress,
      weight: createShipmentDto.weight,
      dimensions: createShipmentDto.dimensions,
      shippingCost: createShipmentDto.shippingCost,
      estimatedDeliveryDate,
      labelUrl: createShipmentDto.labelUrl,
      notes: createShipmentDto.notes,
    });

    const savedShipment = await this.shipmentsRepository.save(shipment);

    // Update order status to SHIPPED and set tracking number
    order.status = OrderStatus.SHIPPED;
    order.trackingNumber = createShipmentDto.trackingNumber;
    order.shippedAt = new Date();
    await this.ordersRepository.save(order);

    this.logger.log(
      `Shipment created: ${savedShipment.id} for order: ${order.id}`,
    );

    // Emit event
    this.eventEmitter.emit('shipment.created', {
      shipmentId: savedShipment.id,
      orderId: order.id,
      carrier: savedShipment.carrier,
      trackingNumber: savedShipment.trackingNumber,
      timestamp: new Date(),
    });

    return this.mapToResponseDto(savedShipment);
  }

  async updateStatus(
    id: string,
    updateShipmentStatusDto: UpdateShipmentStatusDto,
  ): Promise<ShipmentResponseDto> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { id },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment with ID "${id}" not found`);
    }

    // Validate state transition
    if (
      !this.isValidStateTransition(
        shipment.status,
        updateShipmentStatusDto.status,
      )
    ) {
      throw new BadRequestException(
        `Invalid state transition from ${shipment.status} to ${updateShipmentStatusDto.status}`,
      );
    }

    const previousStatus = shipment.status;
    shipment.status = updateShipmentStatusDto.status;

    if (updateShipmentStatusDto.notes) {
      shipment.notes = updateShipmentStatusDto.notes;
    }

    // Set actual delivery date when delivered
    if (updateShipmentStatusDto.status === ShipmentStatus.DELIVERED) {
      shipment.actualDeliveryDate = new Date();
    }

    const updatedShipment = await this.shipmentsRepository.save(shipment);

    // Sync order status for terminal shipment states
    await this.syncOrderStatus(
      shipment.orderId,
      updateShipmentStatusDto.status,
    );

    this.logger.log(
      `Shipment ${id} status updated: ${previousStatus} → ${updateShipmentStatusDto.status}`,
    );

    // Emit event
    this.eventEmitter.emit('shipment.status_updated', {
      shipmentId: id,
      orderId: shipment.orderId,
      previousStatus,
      newStatus: updateShipmentStatusDto.status,
      timestamp: new Date(),
    });

    return this.mapToResponseDto(updatedShipment);
  }

  async findByTrackingNumber(
    trackingNumber: string,
  ): Promise<ShipmentResponseDto> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { trackingNumber },
    });

    if (!shipment) {
      throw new NotFoundException(
        `Shipment with tracking number "${trackingNumber}" not found`,
      );
    }

    return this.mapToResponseDto(shipment);
  }

  async findByOrderId(orderId: string): Promise<ShipmentResponseDto> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { orderId },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment for order "${orderId}" not found`);
    }

    return this.mapToResponseDto(shipment);
  }

  async findById(id: string): Promise<ShipmentResponseDto> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { id },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment with ID "${id}" not found`);
    }

    return this.mapToResponseDto(shipment);
  }

  getCarrierInfo(): CarrierInfoDto[] {
    return this.carrierDetails;
  }

  getEstimatedDelivery(carrier: ShippingCarrier): {
    estimatedDays: { min: number; max: number };
    estimatedDate: Date;
  } {
    const carrierInfo = this.carrierDetails.find((c) => c.carrier === carrier);
    if (!carrierInfo) {
      throw new BadRequestException(`Unsupported carrier: ${carrier}`);
    }

    const estimatedDate = new Date();
    estimatedDate.setDate(
      estimatedDate.getDate() + carrierInfo.estimatedDeliveryDays.max,
    );

    return {
      estimatedDays: carrierInfo.estimatedDeliveryDays,
      estimatedDate,
    };
  }

  private calculateEstimatedDelivery(carrier: ShippingCarrier): Date {
    const { estimatedDate } = this.getEstimatedDelivery(carrier);
    return estimatedDate;
  }

  private isValidStateTransition(
    currentStatus: ShipmentStatus,
    newStatus: ShipmentStatus,
  ): boolean {
    const allowedTransitions = this.validTransitions[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
  }

  private async syncOrderStatus(
    orderId: string,
    shipmentStatus: ShipmentStatus,
  ): Promise<void> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
    });
    if (!order) return;

    if (shipmentStatus === ShipmentStatus.DELIVERED) {
      order.status = OrderStatus.DELIVERED;
      order.deliveredAt = new Date();
      await this.ordersRepository.save(order);
    }
  }

  private mapToResponseDto(shipment: Shipment): ShipmentResponseDto {
    return {
      id: shipment.id,
      orderId: shipment.orderId,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      shippingAddress: shipment.shippingAddress,
      weight: shipment.weight,
      dimensions: shipment.dimensions,
      shippingCost: shipment.shippingCost,
      estimatedDeliveryDate: shipment.estimatedDeliveryDate,
      actualDeliveryDate: shipment.actualDeliveryDate,
      labelUrl: shipment.labelUrl,
      notes: shipment.notes,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    };
  }
}
