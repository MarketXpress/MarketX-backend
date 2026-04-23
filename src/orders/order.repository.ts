async exportOrders(): Promise<OrderExportDto[]> {
  return this.orderRepo
    .createQueryBuilder('order')
    .select([
      'order.id AS orderId',
      'order.createdAt AS orderDate',
      'order.totalAmount AS total',
      'customer.name AS customerName',
    ])
    .leftJoin('order.customer', 'customer')
    .getRawMany();
}
