export class NotificationCreatedEvent {
    constructor(
      public readonly notification: NotificationEntity,
      public readonly timestamp: Date = new Date()
    ) {}
  }
  
  export class NotificationReadEvent {
    constructor(
      public readonly notificationId: string,
      public readonly userId: string,
      public readonly timestamp: Date = new Date()
    ) {}
  }
  
  export class BulkNotificationEvent {
    constructor(
      public readonly notifications: NotificationEntity[],
      public readonly timestamp: Date = new Date()
    ) {}
  }