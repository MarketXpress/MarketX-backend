export interface ShippingUpdateEmailDto {
    userId?: string;
    to: string;
    name: string;
    orderId: string;
    orderNumber: string;
    trackingNumber: string;
    carrier: string;
    trackingUrl: string;
    estimatedDelivery?: string;
}
