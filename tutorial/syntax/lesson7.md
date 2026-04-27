# 第 7 课语法补充：@Catch 与 ExceptionFilter.catch()

## 解释

`@Catch()` 是 NestJS 提供的异常过滤器装饰器。它的作用是告诉 NestJS：这个类是一个 Exception Filter，可以捕获并处理异常。

常见写法有两种：

- `@Catch()`：不传参数，表示捕获所有异常。
- `@Catch(HttpException)`：只捕获 `HttpException` 这一类异常。

当前项目第 7 课使用的是 `@Catch()`，因为我们希望统一处理所有错误：包括 `NotFoundException`、`BadRequestException`、`ValidationPipe` 抛出的异常，以及未知系统错误。

`catch(exception, host)` 是 Exception Filter 必须实现的方法。它会在请求处理过程中出现异常时被 NestJS 调用。

- `exception`：当前被抛出的异常对象。
- `host`：当前请求上下文，可以通过它拿到 HTTP 请求对象和响应对象。
- `host.switchToHttp()`：把通用上下文切换成 HTTP 上下文。
- `ctx.getResponse<Response>()`：拿到 Express 的响应对象，用来设置状态码并返回 JSON。
- `ctx.getRequest<Request>()`：拿到 Express 的请求对象，用来读取当前请求路径。
- `exception instanceof HttpException`：判断这个异常是不是 NestJS HTTP 异常。
- `exception.getStatus()`：读取 HTTP 异常自带的状态码。
- `exception.getResponse()`：读取 HTTP 异常自带的响应内容。

注意：未知错误不应该把 `stack` 直接返回给客户端，否则会暴露服务端代码路径和内部实现。

## 示例代码

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

// 不传参数表示捕获所有异常
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  // exception 是被 throw 出来的异常
  // host 是 NestJS 传入的请求上下文
  catch(exception: unknown, host: ArgumentsHost) {
    // 当前项目是 HTTP 接口，所以先切换到 HTTP 上下文
    const ctx = host.switchToHttp();

    // Express 的 response：用于手动返回状态码和 JSON
    const response = ctx.getResponse<Response>();

    // Express 的 request：用于读取当前请求路径
    const request = ctx.getRequest<Request>();

    // 判断是不是 NestJS 内置 HTTP 异常
    const isHttpException = exception instanceof HttpException;

    // 已知 HTTP 异常使用自己的状态码，未知异常统一当成 500
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // 已知 HTTP 异常读取原始响应体，未知异常给通用提示
    const exceptionResponse = isHttpException
      ? exception.getResponse()
      : 'Internal server error';

    response.status(statusCode).json({
      success: false,
      statusCode,
      message: exceptionResponse,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
```

## 当前项目中的用法

当前项目在 `src/common/filters/http-exception.filter.ts` 中实现全局异常过滤器，在 `src/main.ts` 中注册：

```ts
app.useGlobalFilters(new HttpExceptionFilter());
```

注册之后，下面这些错误都会进入同一个过滤器：

```ts
throw new NotFoundException('Not Exists');
throw new BadRequestException('already exists');
```

最终接口会返回统一结构：

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Not Exists",
  "error": "Not Found",
  "path": "/courses/999",
  "timestamp": "2026-04-27T10:00:00.000Z"
}
```

## 常见错误

1. 只写了 Filter 类，但忘记在 `main.ts` 注册。

```ts
app.useGlobalFilters(new HttpExceptionFilter());
```

2. 把业务失败写成普通返回值。

```ts
// 不推荐：状态码可能仍然是 200
return { message: 'not found' };

// 推荐：让 NestJS 按异常流程返回 404
throw new NotFoundException('Not Exists');
```

3. 未知异常直接返回 `exception.stack`。

```ts
// 不推荐：会暴露服务端内部路径和调用栈
response.json({ stack: (exception as Error).stack });
```

未知异常应该返回通用错误信息，详细堆栈留在服务端日志中。
