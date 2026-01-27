export class PaymentReceivedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly userId: string,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly paymentMethod: string,
  ) {}
}

export class PaymentFailedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly userId: string,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly reason: string,
  ) {}
}