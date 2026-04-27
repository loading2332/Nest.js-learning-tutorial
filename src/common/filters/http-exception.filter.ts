import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException
      ? exception.getResponse()
      : 'Internal server error';

    const { message, error } = this.normalizeExceptionResponse(
      exceptionResponse,
      statusCode,
    );

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private normalizeExceptionResponse(
    exceptionResponse: string | object,
    statusCode: number,
  ) {
    if (typeof exceptionResponse === 'string') {
      return {
        message: exceptionResponse,
        error: this.getDefaultError(statusCode),
      };
    }

    const responseBody = exceptionResponse as {
      message?: string | string[];
      error?: string;
    };

    return {
      message: responseBody.message ?? this.getDefaultError(statusCode),
      error: responseBody.error ?? this.getDefaultError(statusCode),
    };
  }

  private getDefaultError(statusCode: number) {
    const defaultErrors: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
    };

    return defaultErrors[statusCode] ?? 'Internal Server Error';
  }
}
