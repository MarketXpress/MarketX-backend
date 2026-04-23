describe('DTO contract alignment', () => {
  it('handles refund DTO path', async () => {
    const dto: RefundDto = { orderId: '123', reason: 'damaged' };
    const result = await service.handleOrderAction(dto);
    expect(result).toContain('refund processed');
  });

  it('handles base order DTO path with optional sellerId', async () => {
    const dto: BaseOrderDto = { buyerId: '456' };
    const result = await service.handleOrderAction(dto);
    expect(result).toContain('order created');
  });
});
