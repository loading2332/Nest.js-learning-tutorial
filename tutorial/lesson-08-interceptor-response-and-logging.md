# 第 8 课：Interceptor 与统一响应、日志

## 本节目标

学完这一节，你要能做到：

- 理解 Interceptor 在 NestJS 请求生命周期中的位置。
- 区分 Pipe、Filter、Interceptor 的职责。
- 使用 `NestInterceptor` 编写全局拦截器。
- 使用 RxJS 的 `map` 包装成功响应。
- 使用 RxJS 的 `tap` 记录请求耗时日志。
- 让成功响应和第 7 课的错误响应形成统一风格。
- 给课程列表接口增加分页响应结构。
- 知道统一响应的优点和代价。

上一节我们处理的是失败响应：

```txt
throw exception
  -> Exception Filter
  -> error response
```

这一节处理的是成功响应：

```txt
return data
  -> Interceptor
  -> success response
```

## 一、Interceptor 解决什么问题

现在项目里的接口成功响应可能长这样：

```json
[
  {
    "id": 1,
    "title": "NestJS 入门",
    "price": 99,
    "status": "published"
  }
]
```

也可能长这样：

```json
{
  "id": 1,
  "title": "NestJS 入门",
  "price": 99,
  "status": "published"
}
```

这些响应本身没有错，但真实项目里通常希望成功响应也稳定一些，比如：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "NestJS 入门",
    "price": 99,
    "status": "published"
  },
  "path": "/courses/1",
  "timestamp": "2026-04-28T10:00:00.000Z"
}
```

这样前端就可以形成统一判断：

```txt
success === true   成功，读取 data
success === false  失败，读取 message/error
```

Interceptor 的价值就在这里：它可以在 Controller 返回数据之后、响应真正发给客户端之前，对响应做统一处理。

## 二、请求生命周期中的位置

先把第 5 到第 8 课串起来看：

```txt
HTTP 请求
  -> Controller 路由匹配
  -> Pipe 参数转换和校验
  -> Controller 方法
  -> Service 业务逻辑
  -> Interceptor 包装成功响应
  -> HTTP 响应
```

如果中间抛出了异常：

```txt
HTTP 请求
  -> Pipe / Controller / Service 抛出异常
  -> Exception Filter 包装错误响应
  -> HTTP 错误响应
```

记忆方式：

```txt
Pipe：处理请求进来时的参数
Service：处理业务规则
Filter：处理失败
Interceptor：处理成功响应和横切逻辑
```

“横切逻辑”指的是很多接口都需要，但不属于某一个具体业务的方法，比如：

- 统一响应结构。
- 请求耗时日志。
- 响应数据转换。
- 缓存。
- 超时处理。

## 三、`NestInterceptor` 的基本写法

Interceptor 通常实现 `NestInterceptor` 接口。

最小结构如下：

```ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class DemoInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle();
  }
}
```

这里有两个陌生对象：

```txt
context
  当前执行上下文，可以拿到 request、response、handler、class 等信息。

next
  表示后续处理流程。调用 next.handle() 才会继续执行 Controller 方法。
```

如果你不调用 `next.handle()`，请求就不会继续往后走。

## 四、`next.handle()` 和响应流

`next.handle()` 返回的不是普通数据，而是一个 RxJS `Observable`。

你可以先把它理解成：

```txt
Controller 返回值外面包了一层“数据流”
```

比如 Controller 返回：

```ts
return {
  id: 1,
  title: 'NestJS 入门',
};
```

Interceptor 里拿到的是：

```ts
next.handle()
```

要修改最终响应，需要对这个响应流使用 RxJS 操作符：

```ts
return next.handle().pipe(
  map((data) => {
    return {
      success: true,
      data,
    };
  }),
);
```

`map` 的作用是：

```txt
把 Controller 原本返回的数据，转换成另一个数据结构。
```

## 五、创建统一成功响应 Interceptor

建议创建目录：

```txt
src/common/interceptors/
```

创建文件：

```txt
src/common/interceptors/response.interceptor.ts
```

写入：

```ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type SuccessResponse<T> = {
  success: true;
  data: T;
  path: string;
  timestamp: string;
};

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((data) => {
        return {
          success: true,
          data,
          path: request.url,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
```

这段代码做了几件事：

- `context.switchToHttp()`：切换到 HTTP 上下文。
- `getRequest<Request>()`：拿到当前请求对象。
- `next.handle()`：继续执行 Controller。
- `map()`：把 Controller 返回值包装成统一成功响应。
- `data`：保留原本业务数据，不直接打散到响应最外层。

## 六、在 `main.ts` 注册全局 Interceptor

打开：

```txt
src/main.ts
```

导入：

```ts
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
```

在 `bootstrap()` 中注册：

```ts
app.useGlobalInterceptors(new ResponseInterceptor());
```

完整位置类似：

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
```

注册后，请求：

```bash
curl http://localhost:3000/courses/1
```

预期成功响应类似：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "NestJS 入门",
    "description": "学习 NestJS 的 Controller、Service 和 Module",
    "price": 99,
    "status": "published"
  },
  "path": "/courses/1",
  "timestamp": "2026-04-28T10:00:00.000Z"
}
```

## 七、错误响应会不会也被 ResponseInterceptor 包装

正常情况下不会。

因为错误流程是：

```txt
Service / Pipe 抛出异常
  -> 进入异常通道
  -> Exception Filter 处理
```

成功流程是：

```txt
Controller return data
  -> 进入成功通道
  -> ResponseInterceptor map(data)
```

所以可以形成两套稳定结构：

成功：

```json
{
  "success": true,
  "data": {},
  "path": "/courses/1",
  "timestamp": "2026-04-28T10:00:00.000Z"
}
```

失败：

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Not Exists",
  "error": "Not Found",
  "path": "/courses/999",
  "timestamp": "2026-04-28T10:00:00.000Z"
}
```

## 八、创建请求日志 Interceptor

统一响应解决的是“客户端看到什么”。

请求日志解决的是“服务端如何排查问题”。

建议创建文件：

```txt
src/common/interceptors/logging.interceptor.ts
```

写入：

```ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const url = request.url;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(`${method} ${url} ${duration}ms`);
        },
        error: () => {
          const duration = Date.now() - startTime;
          this.logger.warn(`${method} ${url} failed ${duration}ms`);
        },
      }),
    );
  }
}
```

这里的 `tap` 和 `map` 不一样：

```txt
map
  用来改变响应数据。

tap
  用来做副作用，比如打印日志，不改变原始响应数据。
```

请求成功时打印：

```txt
GET /courses 12ms
```

请求失败时打印：

```txt
GET /courses/999 failed 8ms
```

## 九、注册多个全局 Interceptor

在 `main.ts` 中导入：

```ts
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
```

注册：

```ts
app.useGlobalInterceptors(
  new LoggingInterceptor(),
  new ResponseInterceptor(),
);
```

这样每个请求都会经过日志拦截器和响应拦截器。

本节暂时使用 `new XxxInterceptor()` 注册，后面学习更复杂的依赖注入时，还可以把全局 Interceptor 放到 Module 的 `providers` 中注册。

## 十、给课程列表增加分页响应结构

当前课程列表接口已经有：

```ts
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
```

但是 `CoursesService.findAll()` 只返回数组：

```ts
return result.slice(start, end);
```

真实项目中，分页列表通常还要告诉客户端总数、当前页、每页数量。

可以把返回值改成：

```ts
findAll(query: FindCourseQuery) {
  const { keyword, status, page, limit } = query;
  let result = this.courses;

  if (keyword) {
    result = result.filter((course) =>
      course.title.toLowerCase().includes(keyword.toLowerCase()),
    );
  }

  if (status) {
    result = result.filter((course) => course.status === status);
  }

  const total = result.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const items = result.slice(start, end);

  return {
    items,
    meta: {
      total,
      page,
      limit,
    },
  };
}
```

经过 `ResponseInterceptor` 包装后，接口会返回：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "title": "NestJS 入门",
        "price": 99,
        "status": "published"
      }
    ],
    "meta": {
      "total": 2,
      "page": 1,
      "limit": 10
    }
  },
  "path": "/courses?page=1&limit=10",
  "timestamp": "2026-04-28T10:00:00.000Z"
}
```

注意这里的结构分工：

```txt
ResponseInterceptor
  负责最外层 success、data、path、timestamp。

CoursesService.findAll()
  负责课程列表自己的 items 和 meta。
```

不要让 Interceptor 猜测所有数组都一定是分页列表。否则以后某些接口只是普通数组，也会被错误包装。

## 十一、Filter、Pipe、Interceptor 的职责区别

可以用下面这张表记忆：

```txt
Pipe
  发生在 Controller 参数进入方法前。
  负责转换和校验输入。
  例子：ParseIntPipe、ValidationPipe、CourseStatusPipe。

Filter
  发生在异常抛出后。
  负责把错误变成稳定的 HTTP 错误响应。
  例子：HttpExceptionFilter。

Interceptor
  包裹 Controller 方法执行过程。
  可以在执行前后做处理。
  例子：ResponseInterceptor、LoggingInterceptor。
```

用一句话总结：

```txt
Pipe 管入口，Filter 管失败，Interceptor 管过程和成功出口。
```

## 十二、统一响应的优点和代价

优点：

- 前端可以稳定判断 `success`。
- 所有成功响应都有统一入口 `data`。
- 所有响应都有 `path` 和 `timestamp`，方便排查问题。
- 成功响应和错误响应风格一致。
- Controller 和 Service 不需要到处手写包装结构。

代价：

- 所有接口都会多一层 `data`，前端要适配。
- 文件下载、图片、流式响应不适合直接套统一 JSON。
- 如果某些接口需要特殊响应格式，需要在 Interceptor 中跳过。
- 过度统一可能掩盖不同业务响应的语义差异。

本课程阶段先统一普通 JSON API。文件下载、上传、流式响应后面再单独处理。

## 十三、常见问题

### 1. 为什么我写了 Interceptor，但响应没有变化？

检查是否注册了全局 Interceptor：

```ts
app.useGlobalInterceptors(new ResponseInterceptor());
```

也要确认导入路径正确：

```ts
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
```

### 2. 为什么错误响应没有被 `success: true` 包起来？

这是正常的。

错误响应应该交给第 7 课的 `HttpExceptionFilter`，不应该被成功响应 Interceptor 包成 `success: true`。

### 3. `map` 和 `tap` 到底有什么区别？

`map` 改数据：

```ts
map((data) => {
  return {
    success: true,
    data,
  };
});
```

`tap` 不改数据，只做额外动作：

```ts
tap(() => {
  console.log('request finished');
});
```

### 4. 为什么日志不写在 Controller 里？

因为日志是所有接口都需要的横切逻辑。

如果写在 Controller 里，每个方法都要重复写：

```ts
console.log('GET /courses start');
console.log('GET /courses end');
```

用 Interceptor 可以统一处理，不污染业务代码。

### 5. Interceptor 能不能修改请求参数？

可以，但不建议在本阶段这样做。

请求参数转换和校验优先交给 Pipe。Interceptor 更适合处理执行前后的通用逻辑，比如日志、响应包装、缓存。

## 十四、本节练习任务

### 任务 1：创建统一成功响应 Interceptor

要求：

- 创建 `src/common/interceptors/response.interceptor.ts`。
- 实现 `ResponseInterceptor`。
- 使用 `map` 包装成功响应。
- 响应包含 `success`、`data`、`path`、`timestamp`。

记录：

```txt
GET /courses/1 的成功响应：
```

### 任务 2：注册全局 ResponseInterceptor

要求：

- 在 `src/main.ts` 中导入 `ResponseInterceptor`。
- 使用 `app.useGlobalInterceptors(new ResponseInterceptor())` 注册。
- 测试 `GET /courses` 和 `GET /courses/1`。

记录：

```txt
GET /courses 的响应结构：
GET /courses/1 的响应结构：
```

### 任务 3：创建请求日志 Interceptor

要求：

- 创建 `src/common/interceptors/logging.interceptor.ts`。
- 使用 `Logger` 打印请求方法、路径、耗时。
- 成功请求和失败请求都能打印日志。

记录：

```txt
一次成功请求日志：
一次失败请求日志：
```

### 任务 4：给课程列表增加分页响应

要求：

- 修改 `CoursesService.findAll()`。
- 返回 `items` 和 `meta`。
- `meta` 至少包含 `total`、`page`、`limit`。

记录：

```txt
GET /courses?page=1&limit=10 的响应：
```

### 任务 5：对比成功响应和失败响应

要求：

分别请求：

```bash
curl http://localhost:3000/courses/1
curl http://localhost:3000/courses/999
```

写出两者结构差异：

```txt
成功响应字段：
失败响应字段：
共同字段：
不同字段：
```

## 十五、本节知识输出

请在学习笔记中回答：

1. Interceptor 在 NestJS 请求生命周期中处于什么位置？
2. `next.handle()` 的作用是什么？
3. `map` 和 `tap` 的区别是什么？
4. 为什么统一成功响应适合放在 Interceptor 中？
5. 为什么错误响应不应该由 ResponseInterceptor 处理？
6. Pipe、Filter、Interceptor 的职责分别是什么？
7. 统一响应结构有什么优点？有什么代价？
8. 为什么分页信息应该由列表业务自己返回，而不是让 Interceptor 猜测？

建议结合本节的 `ResponseInterceptor`、`LoggingInterceptor` 和 `CoursesService.findAll()` 回答。

## 十六、本节最小验收

- 新增文件：`src/common/interceptors/response.interceptor.ts`
- 新增文件：`src/common/interceptors/logging.interceptor.ts`
- 修改文件：`src/main.ts`
- 修改文件：`src/courses/courses.service.ts`
- 必须能访问的接口：
  - `GET /courses`
  - `GET /courses/1`
  - `GET /courses/999`
- 必须通过的命令：
  - `pnpm run build`
  - `pnpm run lint`
- 本课暂不要求解决的问题：
  - 文件下载响应的特殊处理。
  - 日志写入文件或日志系统。
  - 请求链路追踪 ID。
  - 使用依赖注入方式注册全局 Interceptor。

## 十七、本节验收标准

完成本节后，请确认：

- 成功响应统一包含 `success: true`。
- 成功响应原始数据被放在 `data` 字段中。
- 成功响应包含 `path` 和 `timestamp`。
- 错误响应仍然由 `HttpExceptionFilter` 处理。
- `GET /courses/999` 不会被包装成 `success: true`。
- 请求日志能打印 method、url、耗时。
- 失败请求也能打印失败日志。
- 课程列表响应包含 `items` 和 `meta`。
- `pnpm run build` 可以通过。
- `pnpm run lint` 可以通过。
- 你能说清楚 Pipe、Filter、Interceptor 的职责边界。

## 十八、下一节预告

下一节会学习配置管理与环境变量。

到目前为止，我们已经把普通请求处理链路梳理成：

```txt
请求参数
  -> Pipe 校验和转换
  -> Controller 接收请求
  -> Service 执行业务
  -> Interceptor 包装成功响应和记录日志
  -> Filter 包装错误响应
```

下一节开始，项目会从“写死配置”走向“可按环境变化的配置”：

```txt
PORT
DATABASE_URL
JWT_SECRET
NODE_ENV
```

这会为后续数据库、JWT 和部署打基础。
