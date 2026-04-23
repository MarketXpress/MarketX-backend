async handleOrderAction(dto: OrderActionDto) {
  if ('reason' in dto) {
    // Refund path
    return this.processRefund(dto.orderId, dto.reason);
  } else {
    // Base order path
    return this.createOrder(dto.buyerId, dto.sellerId ?? null);
  }
}
