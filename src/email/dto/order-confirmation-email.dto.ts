export interface OrderItem {
    productName: string;
    quantity: number;
    price: number;
    subtotal: number;
}

export interface OrderConfirmationEmailDto {
    userId?: string;
    to: string;
    name: string;
    orderId: string;
    orderNumber: string;
    total: number;
    currency: string;
    items: OrderItem[];
    trackingUrl: string;
}
