# 第 7 节：异常处理与统一错误响应

## 本节目标

学完这一节，你要能做到：

- 理解 NestJS 内置 HTTP 异常的作用。
- 使用 `NotFoundException` 返回 404。
- 使用 `BadRequestException` 返回 400。
- 理解 `UnauthorizedException` 的使用场景。
- 区分请求格式错误、业务错误和系统错误。
- 编写全局 Exception Filter。
- 统一项目的错误响应结构。
- 避免把内部错误堆栈直接暴露给客户端。

前两节我们已经处理了 DTO 校验和 Pipe 参数转换。它们主要解决的是：

```txt
请求进来的数据格式是否正确？
```

这一节要解决的是：

```txt
业务执行过程中出错了，应该怎样给客户端返回稳定、清晰、安全的错误？
```

## 一、为什么需要异常处理

先看一个常见问题。

用户请求：

```txt
GET /courses/999
```

如果课程不存在，之前我们可能返回：

```json
{
  "message": "课程不存在"
}
```

但这个响应有几个问题：

- HTTP 状态码可能还是 200。
- 客户端无法稳定判断这是成功还是失败。
- 不同接口可能返回不同错误格式。
- 如果直接抛出系统错误，可能暴露内部实现细节。

更合理的响应应该类似：

```json
{
  "statusCode": 404,
  "message": "课程不存在",
  "error": "Not Found",
  "path": "/courses/999",
  "timestamp": "2026-04-27T10:00:00.000Z"
}
```

它同时告诉客户端：

- 请求失败了。
- 失败状态码是 404。
- 失败原因是课程不存在。
- 哪个路径出错了。
- 错误发生在什么时间。

这就是统一错误响应的价值。

## 二、异常和返回值的区别

在 Service 中遇到业务失败时，你可以选择返回一个错误对象：

```ts
return {
  message: '课程不存在',
};
```

也可以选择抛出异常：

```ts
throw new NotFoundException('课程不存在');
```

在 NestJS 项目里，更推荐使用异常表达失败。

原因是：

- 返回值更适合表达成功结果。
- 异常更适合表达流程失败。
- NestJS 能自动把异常转换为 HTTP 响应。
- 全局 Filter 可以统一处理异常格式。

也就是说：

```txt
成功：return data
失败：throw exception
```

这个规则会让接口代码更清晰。

## 三、NestJS 内置 HTTP 异常

NestJS 提供了很多内置异常类，它们都来自 `@nestjs/common`。

常用的有：

```ts
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
```

常见场景：

```txt
BadRequestException       400 请求参数或业务输入不合法
UnauthorizedException     401 未登录或 token 无效
ForbiddenException        403 已登录但没有权限
NotFoundException         404 资源不存在
ConflictException         409 资源冲突，比如重复创建
InternalServerErrorException 500 服务端内部错误
```

本节重点使用三个：

```txt
NotFoundException
BadRequestException
UnauthorizedException
```

## 四、`NotFoundException`：资源不存在

课程详情接口中，用户传了一个合法 ID，但这个 ID 对应的课程不存在。

这种情况适合返回：

```txt
404 Not Found
```

Service 中可以这样写：

```ts
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class CoursesService {
  findOne(id: number) {
    const course = this.courses.find((item) => item.id === id);

    if (!course) {
      throw new NotFoundException('课程不存在');
    }

    return course;
  }
}
```

这样当课程不存在时，NestJS 会自动返回 404。

请求：

```bash
curl http://localhost:3000/courses/999
```

默认响应大概是：

```json
{
  "message": "课程不存在",
  "error": "Not Found",
  "statusCode": 404
}
```

注意：这是 NestJS 默认错误格式。后面我们会用 Filter 改造成项目统一格式。

## 五、`BadRequestException`：请求业务输入不合法

`BadRequestException` 表示客户端传入的数据不符合要求。

它和 DTO 校验有点像，但关注点不同。

DTO 校验适合处理“格式规则”：

```txt
title 必须是字符串
title 不能为空
price 必须是数字
price 不能小于 0
```

Service 中的业务校验适合处理“业务规则”：

```txt
课程标题不能重复
已下架课程不能报名
免费课程不能设置优惠价
```

比如创建课程时，不允许标题重复：

```ts
import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class CoursesService {
  create(input: CreateCourseInput) {
    const existingCourse = this.courses.find((course) => {
      return course.title === input.title;
    });

    if (existingCourse) {
      throw new BadRequestException('课程标题已存在');
    }

    const course: Course = {
      id: this.getNextId(),
      title: input.title,
      description: input.description,
      price: input.price,
    };

    this.courses.push(course);

    return course;
  }
}
```

请求：

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "NestJS 入门",
    "description": "重复课程",
    "price": 99
  }'
```

预期返回 400。

## 六、`UnauthorizedException`：未认证

`UnauthorizedException` 表示用户没有通过认证。

常见场景：

```txt
没有登录
没有携带 token
token 过期
token 无效
账号密码错误
```

示例：

```ts
import { UnauthorizedException } from '@nestjs/common';

function login(username: string, password: string) {
  const isValidUser = username === 'admin' && password === '123456';

  if (!isValidUser) {
    throw new UnauthorizedException('用户名或密码错误');
  }

  return {
    accessToken: 'mock-token',
  };
}
```

这一节还没有正式实现登录认证，所以先理解它的语义。

后面学习 JWT 和 Guard 时会大量用到：

```txt
401 Unauthorized
```

注意区分：

```txt
401 Unauthorized：你是谁还没确认，或者登录凭证无效
403 Forbidden：知道你是谁，但你没有权限访问
```

## 七、改造 `CoursesService`

这一节建议先改造课程 Service。

打开：

```txt
src/courses.service.ts
```

确认顶部导入异常类：

```ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
```

然后把查询不存在课程时返回对象的写法：

```ts
return {
  message: '课程不存在',
};
```

改成：

```ts
throw new NotFoundException('课程不存在');
```

可以先整理一个私有方法，专门查课程：

```ts
private findCourseById(id: number) {
  const course = this.courses.find((item) => item.id === id);

  if (!course) {
    throw new NotFoundException('课程不存在');
  }

  return course;
}
```

然后其他方法复用它：

```ts
findOne(id: number) {
  return this.findCourseById(id);
}
```

更新课程：

```ts
update(id: number, input: UpdateCourseInput) {
  const course = this.findCourseById(id);

  Object.assign(course, input);

  return course;
}
```

删除课程：

```ts
remove(id: number) {
  const course = this.findCourseById(id);

  this.courses = this.courses.filter((item) => item.id !== id);

  return course;
}
```

创建课程时检查重复标题：

```ts
create(input: CreateCourseInput) {
  const existingCourse = this.courses.find((course) => {
    return course.title === input.title;
  });

  if (existingCourse) {
    throw new BadRequestException('课程标题已存在');
  }

  const course: Course = {
    id: this.getNextId(),
    title: input.title,
    description: input.description,
    price: input.price,
  };

  this.courses.push(course);

  return course;
}
```

这里的思路是：

```txt
查不到资源：NotFoundException
业务输入冲突：BadRequestException
```

## 八、为什么异常适合放在 Service

课程不存在、课程标题重复，这些都属于业务规则。

它们不应该散落在 Controller 中：

```ts
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  const course = this.coursesService.findOne(id);

  if (!course) {
    throw new NotFoundException('课程不存在');
  }

  return course;
}
```

更推荐：

```ts
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.coursesService.findOne(id);
}
```

由 Service 负责判断：

```ts
findOne(id: number) {
  return this.findCourseById(id);
}
```

这样 Controller 仍然保持很薄，只负责 HTTP 层。

## 九、什么是 Exception Filter

Exception Filter 是 NestJS 专门处理异常的机制。

当代码中抛出异常：

```ts
throw new NotFoundException('课程不存在');
```

NestJS 会捕获它，并把它转换成 HTTP 响应。

默认格式已经能用，但真实项目通常希望统一成自己的格式。

比如我们希望所有错误都长这样：

```json
{
  "success": false,
  "statusCode": 404,
  "message": "课程不存在",
  "error": "Not Found",
  "path": "/courses/999",
  "timestamp": "2026-04-27T10:00:00.000Z"
}
```

这时就可以写全局 Exception Filter。

## 十、创建全局异常过滤器

建议创建目录：

```txt
src/common/filters/
```

然后创建文件：

```txt
src/common/filters/http-exception.filter.ts
```

写入：

```ts
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
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      default:
        return 'Internal Server Error';
    }
  }
}
```

这里有几个重点：

- `@Catch()` 不传参数，表示捕获所有异常。
- `exception instanceof HttpException` 用来判断是不是 NestJS HTTP 异常。
- 已知 HTTP 异常使用它自己的状态码。
- 未知异常统一当成 500。
- 响应中不返回 `exception.stack`，避免暴露内部细节。

## 十一、注册全局 Filter

打开：

```txt
src/main.ts
```

引入过滤器：

```ts
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
```

在 `bootstrap()` 中注册：

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

完整文件类似：

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

这样整个应用抛出的异常都会先经过这个 Filter。

## 十二、测试错误响应

启动项目：

```bash
pnpm run start:dev
```

### 1. 查询不存在课程

```bash
curl http://localhost:3000/courses/999
```

预期返回类似：

```json
{
  "success": false,
  "statusCode": 404,
  "message": "课程不存在",
  "error": "Not Found",
  "path": "/courses/999",
  "timestamp": "2026-04-27T10:00:00.000Z"
}
```

### 2. 创建重复课程

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "NestJS 入门",
    "description": "重复标题",
    "price": 99
  }'
```

预期返回类似：

```json
{
  "success": false,
  "statusCode": 400,
  "message": "课程标题已存在",
  "error": "Bad Request",
  "path": "/courses",
  "timestamp": "2026-04-27T10:00:00.000Z"
}
```

### 3. 传入非法 ID

如果上一节使用了 `ParseIntPipe`：

```bash
curl http://localhost:3000/courses/abc
```

预期返回 400，并且也会进入统一错误格式。

这说明：

```txt
Pipe 抛出的异常
Service 抛出的异常
都可以被全局 Exception Filter 统一处理
```

## 十三、业务错误与系统错误

异常不一定都是一类问题。

### 业务错误

业务错误是用户或业务流程可以预期的失败。

例如：

```txt
课程不存在
课程标题重复
用户未登录
没有权限
库存不足
余额不足
```

这类错误应该给客户端明确提示。

常见做法：

```ts
throw new NotFoundException('课程不存在');
throw new BadRequestException('课程标题已存在');
throw new UnauthorizedException('请先登录');
```

### 系统错误

系统错误是代码、基础设施或不可预期问题导致的失败。

例如：

```txt
数据库连接失败
空指针错误
第三方接口异常
代码逻辑 bug
磁盘或网络故障
```

这类错误不应该把内部细节直接返回给客户端。

客户端看到：

```json
{
  "success": false,
  "statusCode": 500,
  "message": "Internal Server Error",
  "error": "Internal Server Error"
}
```

服务端日志中再记录详细堆栈。

这一节我们先不做完整日志系统，第 8 节会开始加入请求日志。

## 十四、常见 HTTP 状态码

建议先记住这些：

```txt
200 OK
  请求成功，通常用于查询、更新成功。

201 Created
  创建成功，通常用于 POST 创建资源。

400 Bad Request
  请求参数格式错误，或业务输入不合法。

401 Unauthorized
  未认证，比如没登录、token 无效。

403 Forbidden
  已认证，但没有权限。

404 Not Found
  请求的资源不存在。

409 Conflict
  资源冲突，比如唯一字段重复。

500 Internal Server Error
  服务端内部错误。
```

关于重复标题，也可以使用：

```txt
409 Conflict
```

本节使用 `BadRequestException` 是为了先减少概念数量。真实项目里，如果团队约定“唯一冲突统一返回 409”，也完全可以使用 `ConflictException`。

## 十五、错误响应结构建议

本课程后续建议统一使用下面的错误结构：

```ts
type ErrorResponse = {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
};
```

示例：

```json
{
  "success": false,
  "statusCode": 404,
  "message": "课程不存在",
  "error": "Not Found",
  "path": "/courses/999",
  "timestamp": "2026-04-27T10:00:00.000Z"
}
```

每个字段的含义：

```txt
success
  固定为 false，方便客户端判断失败。

statusCode
  HTTP 状态码。

message
  给客户端或开发者看的错误说明。

error
  错误类型。

path
  出错的请求路径。

timestamp
  错误发生时间。
```

## 十六、本节练习任务

### 任务 1：改造课程不存在错误

要求：

- 在 `CoursesService` 中导入 `NotFoundException`。
- 查询不存在课程时抛出 `NotFoundException`。
- 更新、删除不存在课程时也抛出 `NotFoundException`。

记录：

```txt
GET /courses/999 的状态码：
GET /courses/999 的响应体：
```

### 任务 2：改造重复课程标题错误

要求：

- 在 `CoursesService.create()` 中检查课程标题是否重复。
- 标题重复时抛出 `BadRequestException`。

记录：

```txt
重复创建课程时的状态码：
重复创建课程时的响应体：
```

### 任务 3：创建全局 Exception Filter

要求：

- 创建 `src/common/filters/http-exception.filter.ts`。
- 实现统一错误响应格式。
- 未知异常统一返回 500。
- 不向客户端返回错误堆栈。

记录：

```txt
我的错误响应结构：
```

### 任务 4：在 `main.ts` 注册 Filter

要求：

- 使用 `app.useGlobalFilters(new HttpExceptionFilter())` 注册全局 Filter。
- 重新测试 400、404 错误响应。

记录：

```txt
400 错误响应：
404 错误响应：
```

### 任务 5：区分业务错误和系统错误

要求：

写出下面错误应该对应什么状态码：

```txt
课程不存在：
课程标题重复：
用户未登录：
用户已登录但不是管理员：
请求体缺少 title：
数据库连接失败：
```

## 十七、本节知识输出

请在学习笔记中回答：

1. 为什么不推荐用 `return { message: '课程不存在' }` 表达业务失败？
2. `NotFoundException` 和 `BadRequestException` 分别适合什么场景？
3. 401 和 403 有什么区别？
4. Exception Filter 的作用是什么？
5. 为什么不能把系统错误的堆栈直接返回给客户端？
6. 你项目中的统一错误响应结构是什么？

建议结合本节的 `CoursesService` 和 `HttpExceptionFilter` 回答。

## 十八、常见问题

### 1. 为什么我抛出了异常，但响应格式不是我写的格式？

检查是否在 `main.ts` 注册了全局 Filter：

```ts
app.useGlobalFilters(new HttpExceptionFilter());
```

还要检查导入路径是否正确。

### 2. 为什么 TypeScript 提示找不到 `Request` 和 `Response`？

确认项目已经有 Express 类型依赖。

当前 NestJS starter 通常已经包含：

```json
"@types/express": "^5.0.0"
```

如果没有，可以安装：

```bash
pnpm add -D @types/express
```

### 3. DTO 校验错误也会走这个 Filter 吗？

会。

`ValidationPipe` 校验失败时会抛出 `BadRequestException`，全局 Filter 可以捕获并统一响应格式。

### 4. `message` 为什么有时候是数组？

DTO 校验可能一次产生多个字段错误，所以 `message` 可能是字符串数组。

例如：

```json
{
  "message": [
    "title should not be empty",
    "price must not be less than 0"
  ]
}
```

所以本节的 `ErrorResponse` 中允许：

```ts
message: string | string[];
```

### 5. 所有错误都要自己写 Filter 吗？

不一定。

NestJS 默认异常响应已经能工作。写全局 Filter 的原因是为了让项目错误结构更稳定，方便前端、客户端、日志系统统一处理。

## 十九、本节验收标准

完成本节后，请确认：

- 查询不存在课程时返回 404。
- 创建重复课程标题时返回 400。
- DTO 或 Pipe 抛出的错误也会进入统一错误结构。
- 已实现全局 `HttpExceptionFilter`。
- `main.ts` 已注册全局 Filter。
- 错误响应包含 `success`、`statusCode`、`message`、`error`、`path`、`timestamp`。
- 客户端响应中没有暴露系统错误堆栈。
- 你能说清楚业务错误和系统错误的区别。

## 二十、下一节预告

下一节会学习 Interceptor 与统一响应、日志。

这一节我们统一了失败响应：

```txt
throw exception
  -> Exception Filter
  -> error response
```

下一节会统一成功响应：

```txt
return data
  -> Interceptor
  -> success response
```

同时还会给每个请求记录方法、路径和耗时。
