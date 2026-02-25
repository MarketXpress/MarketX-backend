import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../email.service';
import { OrderCreatedEvent, OrderUpdatedEvent } from '../../notifications/events/order.events';
import { OrderStatus } from '../../orders/dto/create-order.dto';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrderEmailListener {
    private readonly logger = new Logger(OrderEmailListener.name);

    constructor(
        private readonly emailService: EmailService,
        private readonly usersService: UsersService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Listen to order.created → send order confirmation email.
     */
    @OnEvent('order.created', { async: true })
    async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
        this.logger.debug(`order.created event received for order ${event.orderId}`);

        try {
            const user = await this.usersService.findOne(parseInt(event.userId, 10));
            const appUrl = this.configService.get<string>('APP_URL') || 'https://marketx.com';

            await this.emailService.sendOrderConfirmation({
                userId: event.userId,
                to: user.email,
                name: user.name,
                orderId: event.orderId,
                orderNumber: event.orderNumber,
                total: event.totalAmount,
                currency: 'USD',
                items: (event.items || []).map((item: any) => ({
                    productName: item.productName ?? `Product ${item.productId}`,
                    quantity: item.quantity,
                    price: Number(item.price),
                    subtotal: Number(item.subtotal),
                })),
                trackingUrl: `${appUrl}/orders/${event.orderId}`,
            });
        } catch (err) {
            this.logger.error(
                `Failed to queue order confirmation for order ${event.orderId}: ${err.message}`,
            );
        }
    }

    /**
     * Listen to order.updated → when status becomes SHIPPED, send shipping email.
     */
    @OnEvent('order.updated', { async: true })
    async handleOrderUpdated(event: OrderUpdatedEvent): Promise<void> {
        if (event.status !== OrderStatus.SHIPPED) return;

        this.logger.debug(`order.updated (→ SHIPPED) event received for order ${event.orderId}`);

        try {
            const user = await this.usersService.findOne(parseInt(event.userId, 10));
            const appUrl = this.configService.get<string>('APP_URL') || 'https://marketx.com';

            await this.emailService.sendShippingUpdate({
                userId: event.userId,
                to: user.email,
                name: user.name,
                orderId: event.orderId,
                orderNumber: event.orderNumber,
                trackingNumber: 'See carrier portal',
                carrier: 'Carrier',
                trackingUrl: `${appUrl}/orders/${event.orderId}/tracking`,
            });
        } catch (err) {
            this.logger.error(
                `Failed to queue shipping update for order ${event.orderId}: ${err.message}`,
            );
        }
    }
}
