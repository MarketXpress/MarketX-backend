describe('Escrow transaction hash handling', () => {
  it('allows null transaction hash', async () => {
    const escrow = await service.assignTransactionHash('escrow1', null);
    expect(escrow.transactionHash).toBeNull();
  });

  it('saves valid transaction hash', async () => {
    const escrow = await service.assignTransactionHash('escrow1', '0xabc123...');
    expect(escrow.transactionHash).toBe('0xabc123...');
  });
});
