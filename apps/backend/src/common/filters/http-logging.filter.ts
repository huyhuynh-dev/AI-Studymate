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
        const status = exception instanceof HttpException
            ? exception.getStatus()
            : 500;
        const exceptionResponse = exception instanceof HttpException
            ? exception.getResponse()
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
