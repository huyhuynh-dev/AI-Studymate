import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpLoggingFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpLoggingFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const context = host.switchToHttp();
        const request = context.getRequest<Request>();
        const response = context.getResponse<Response>();
        const fallbackStatus =
            (exception as any)?.status || (exception as any)?.statusCode || 500;
        const status = exception instanceof HttpException
            ? exception.getStatus()
            : typeof fallbackStatus === 'number' && fallbackStatus >= 400 && fallbackStatus < 600
                ? fallbackStatus
                : 500;

        const rawMessage = (exception as any)?.message;
        const exceptionResponse = exception instanceof HttpException
            ? exception.getResponse()
            : (typeof rawMessage === 'string' && rawMessage.length > 0)
                ? rawMessage
                : 'Internal server error';

        this.logger.error(
            JSON.stringify({
                method: request.method,
                path: request.originalUrl,
                status,
                error: exceptionResponse,
            }),
        );

        if (response.headersSent) {
            return;
        }

        response.status(status).json(
            typeof exceptionResponse === 'string'
                ? { statusCode: status, message: exceptionResponse }
                : exceptionResponse,
        );
    }
}
