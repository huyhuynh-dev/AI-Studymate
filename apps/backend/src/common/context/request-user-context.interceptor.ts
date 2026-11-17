import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { RequestContextStore } from './request-context.js';

@Injectable()
export class RequestUserContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as { userId?: string; sub?: string } | undefined;
    const userId = user?.userId || user?.sub;

    if (!userId) {
      return next.handle();
    }

    return new Observable((subscriber) =>
      RequestContextStore.runWithUserContext(userId, () =>
        next.handle().subscribe({
          next: (val) => subscriber.next(val),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        }),
      ),
    );
  }
}
