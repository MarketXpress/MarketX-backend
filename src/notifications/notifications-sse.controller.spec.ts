import { EventEmitter2 } from '@nestjs/event-emitter';
import { UnauthorizedException } from '@nestjs/common';
import { firstValueFrom, take, timeout } from 'rxjs';

import {
  EventNames,
  NotificationCreatedEvent,
  NotificationSendPushEvent,
} from '../common/events';
import { NotificationsSseController } from './notifications-sse.controller';

describe('NotificationsSseController', () => {
  let eventEmitter: EventEmitter2;
  let controller: NotificationsSseController;

  beforeEach(() => {
    eventEmitter = new EventEmitter2();
    controller = new NotificationsSseController(eventEmitter);
  });

  it('emits created notifications only for the authenticated user', async () => {
    const stream = controller.stream({
      user: { id: 101 },
    } as never);
    const nextEvent = firstValueFrom(stream.pipe(take(1), timeout(500)));

    eventEmitter.emit(
      EventNames.NOTIFICATION_CREATED,
      new NotificationCreatedEvent(
        'foreign-notification',
        '202',
        'info',
        'Foreign title',
        'Foreign body',
        'in-app',
      ),
    );
    eventEmitter.emit(
      EventNames.NOTIFICATION_CREATED,
      new NotificationCreatedEvent(
        'owned-notification',
        '101',
        'info',
        'Owned title',
        'Owned body',
        'in-app',
      ),
    );

    await expect(nextEvent).resolves.toMatchObject({
      data: {
        type: EventNames.NOTIFICATION_CREATED,
        notificationId: 'owned-notification',
        title: 'Owned title',
      },
    });
  });

  it('emits push notifications only for the authenticated user', async () => {
    const stream = controller.stream({
      user: { userId: 101 },
    } as never);
    const nextEvent = firstValueFrom(stream.pipe(take(1), timeout(500)));

    eventEmitter.emit(
      EventNames.NOTIFICATION_SEND_PUSH,
      new NotificationSendPushEvent('202', 'Foreign title', 'Foreign body'),
    );
    eventEmitter.emit(
      EventNames.NOTIFICATION_SEND_PUSH,
      new NotificationSendPushEvent('101', 'Owned title', 'Owned body', {
        orderId: 42,
      }),
    );

    await expect(nextEvent).resolves.toMatchObject({
      data: {
        type: EventNames.NOTIFICATION_SEND_PUSH,
        title: 'Owned title',
        data: { orderId: 42 },
      },
    });
  });

  it('isolates created notifications in the reverse user direction', async () => {
    const stream = controller.stream({
      user: { id: 202 },
    } as never);
    const nextEvent = firstValueFrom(stream.pipe(take(1), timeout(500)));

    eventEmitter.emit(
      EventNames.NOTIFICATION_CREATED,
      new NotificationCreatedEvent(
        'foreign-notification',
        '101',
        'info',
        'Foreign title',
        'Foreign body',
        'in-app',
      ),
    );
    eventEmitter.emit(
      EventNames.NOTIFICATION_CREATED,
      new NotificationCreatedEvent(
        'owned-notification',
        '202',
        'info',
        'Owned title',
        'Owned body',
        'in-app',
      ),
    );

    await expect(nextEvent).resolves.toMatchObject({
      data: {
        notificationId: 'owned-notification',
        title: 'Owned title',
      },
    });
  });

  it('isolates push notifications in the reverse user direction', async () => {
    const stream = controller.stream({
      user: { userId: '202' },
    } as never);
    const nextEvent = firstValueFrom(stream.pipe(take(1), timeout(500)));

    eventEmitter.emit(
      EventNames.NOTIFICATION_SEND_PUSH,
      new NotificationSendPushEvent('101', 'Foreign title', 'Foreign body'),
    );
    eventEmitter.emit(
      EventNames.NOTIFICATION_SEND_PUSH,
      new NotificationSendPushEvent('202', 'Owned title', 'Owned body'),
    );

    await expect(nextEvent).resolves.toMatchObject({
      data: {
        title: 'Owned title',
        message: 'Owned body',
      },
    });
  });

  it('rejects a guarded request with no valid authenticated user ID', () => {
    expect(() => controller.stream({ user: {} } as never)).toThrow(
      UnauthorizedException,
    );
  });
});
