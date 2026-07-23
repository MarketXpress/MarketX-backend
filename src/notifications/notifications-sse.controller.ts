import { Controller, MessageEvent, Req, Sse, UseGuards } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Request } from 'express';
import { Observable, fromEvent, merge } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  EventNames,
  NotificationCreatedEvent,
  NotificationSendPushEvent,
} from '../common/events';

/**
 * Provides a Server-Sent Events (SSE) endpoint for real-time push notifications.
 *
 * The browser subscribes once and receives a stream of notification events
 * scoped to the authenticated user. No WebSocket server or external broker is
 * required – events are piped directly from the in-process EventEmitter2.
 *
 * Note: The native browser `EventSource` API does not support custom request
 * headers.  Frontend clients should use a fetch-based SSE library (e.g.
 * `@microsoft/fetch-event-source`) so that the `Authorization: Bearer <token>`
 * header can be attached to the initial handshake request.
 */
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsSseController {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * GET /notifications/stream
   *
   * Returns an infinite SSE stream that emits notification events for the
   * authenticated user.  The stream closes when the client disconnects.
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Sse('stream')
  @ApiOperation({ summary: 'Stream real-time notifications' })
  @ApiResponse({
    status: 200,
    description: 'Server-sent notification stream opened.',
  })
  stream(@Req() req: Request): Observable<MessageEvent> {
    const user = req.user as Record<string, unknown>;
    const rawId = user['userId'] ?? user['id'] ?? user['sub'];
    const userId =
      typeof rawId === 'string'
        ? rawId
        : typeof rawId === 'number'
          ? String(rawId)
          : '';

    const created$ = fromEvent<NotificationCreatedEvent>(
      this.eventEmitter,
      EventNames.NOTIFICATION_CREATED,
    ).pipe(
      filter((event) => event.userId === userId),
      map(
        (event): MessageEvent => ({
          data: {
            type: EventNames.NOTIFICATION_CREATED,
            notificationId: event.notificationId,
            title: event.title,
            message: event.message,
            notificationType: event.type,
            channel: event.channel,
          },
        }),
      ),
    );

    const push$ = fromEvent<NotificationSendPushEvent>(
      this.eventEmitter,
      EventNames.NOTIFICATION_SEND_PUSH,
    ).pipe(
      filter((event) => event.userId === userId),
      map(
        (event): MessageEvent => ({
          data: {
            type: EventNames.NOTIFICATION_SEND_PUSH,
            title: event.title,
            message: event.message,
            ...(event.data !== undefined && { data: event.data }),
          },
        }),
      ),
    );

    return merge(created$, push$);
  }
}
