# 第 1 节：课程导入与 NestJS 项目初识

## 本节目标

学完这一节，你要能做到：

- 说清楚 NestJS 是什么，以及它和 Node.js、Express 的关系。
- 启动当前 NestJS 项目，并访问默认接口。
- 看懂当前项目中 `main.ts`、`AppModule`、`AppController`、`AppService` 的基本职责。
- 修改默认接口返回内容。
- 新增一个 `/health` 健康检查接口。
- 画出一次 HTTP 请求在当前项目中的流转路径。

本节不追求把 NestJS 所有概念一次讲完，而是先把项目跑起来，再建立第一张“地图”。

## 一、先理解 NestJS 是什么

NestJS 是一个基于 Node.js 的服务端框架，主要用于开发后端 API、微服务、实时通信服务等应用。

你可以先用一句话理解它：

> NestJS 帮你用模块化、面向对象、依赖注入的方式组织 Node.js 后端项目。

如果之前写过 Express，你可能会写出这样的代码：

```ts
app.get('/hello', (req, res) => {
  res.send('Hello World!');
});
```

这种方式简单直接，但项目变大后，路由、业务逻辑、数据库操作、权限校验、错误处理容易混在一起。

NestJS 的思路是把这些职责拆开：

- Controller：接收 HTTP 请求，定义路由入口。
- Service：处理业务逻辑。
- Module：组织一组相关功能。
- Provider：可被 NestJS 创建和注入的对象，Service 就是一种常见 Provider。

现在你不需要完全掌握这些词，只要先记住：

> NestJS 不是让你少写代码，而是让你的后端项目在变大后依然有结构。

## 二、认识当前项目结构

当前项目是一个 NestJS 初始化项目，主要文件如下：

```txt
src/
  main.ts
  app.module.ts
  app.controller.ts
  app.service.ts
  app.controller.spec.ts
test/
  app.e2e-spec.ts
package.json
nest-cli.json
tsconfig.json
```

这一节重点看 `src` 下面的 4 个文件。

### 1. `src/main.ts`

当前代码：

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

它是整个应用的启动入口。

你可以把它理解成：

- `NestFactory.create(AppModule)`：用 `AppModule` 创建一个 Nest 应用。
- `app.listen(process.env.PORT ?? 3000)`：监听端口，默认是 `3000`。
- `bootstrap()`：启动应用。

也就是说，项目启动时会先进入 `main.ts`，然后从 `AppModule` 开始加载整个应用。

### 2. `src/app.module.ts`

当前代码：

```ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

`AppModule` 是当前项目的根模块。

`@Module()` 里面有几个常见配置：

- `imports`：导入其他模块。
- `controllers`：注册当前模块里的 Controller。
- `providers`：注册当前模块里的 Provider，比如 Service。

当前项目只有一个控制器 `AppController` 和一个服务 `AppService`。

你可以把 Module 想象成一个功能包：

```txt
AppModule
  - AppController
  - AppService
```

现在项目很小，所以只有根模块。后面课程会创建 `CoursesModule`、`UsersModule` 等业务模块。

### 3. `src/app.controller.ts`

当前代码：

```ts
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
```

Controller 负责定义接口。

这里有两个装饰器：

- `@Controller()`：声明这是一个控制器。
- `@Get()`：声明这是一个 GET 接口。

因为 `@Controller()` 和 `@Get()` 里都没有写路径，所以这个接口对应根路径：

```txt
GET /
```

当你访问 `http://localhost:3000/` 时，会执行：

```ts
getHello(): string {
  return this.appService.getHello();
}
```

注意这里没有直接返回字符串，而是调用了 `AppService`。

这一点很重要：

> Controller 主要负责接请求，不应该堆太多业务逻辑。

### 4. `src/app.service.ts`

当前代码：

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
```

Service 负责处理业务逻辑。

`@Injectable()` 表示这个类可以交给 NestJS 管理，并且可以被注入到其他类中。

在 `AppController` 里，这行代码就是依赖注入：

```ts
constructor(private readonly appService: AppService) {}
```

你暂时可以这样理解：

> AppController 需要 AppService，NestJS 会自动创建 AppService，并把它交给 AppController。

后面第 3 节会专门讲 Provider、Service 和依赖注入。

## 三、启动项目

先安装依赖：

```bash
pnpm install
```

启动开发模式：

```bash
pnpm run start:dev
```

看到类似下面的信息，说明服务启动成功：

```txt
Nest application successfully started
```

打开另一个终端，请求默认接口：

```bash
curl http://localhost:3000/
```

你应该看到：

```txt
Hello World!
```

如果你更喜欢浏览器，也可以访问：

```txt
http://localhost:3000/
```

## 四、第一次修改：改变默认返回内容

打开 `src/app.service.ts`，把：

```ts
return 'Hello World!';
```

改成：

```ts
return 'Hello NestJS!';
```

保存后，由于你使用的是 `start:dev`，NestJS 会自动重新编译。

再次请求：

```bash
curl http://localhost:3000/
```

预期返回：

```txt
Hello NestJS!
```

### 思考

这次修改发生在 Service 中，而不是 Controller 中。

原因是：

- Controller 定义“哪个接口接收请求”。
- Service 定义“这个请求要做什么业务处理”。

当前例子非常简单，但这个职责划分会在真实项目中不断出现。

## 五、第二次修改：新增 `/health` 接口

健康检查接口通常用于判断服务是否还活着。比如部署平台、负载均衡器、监控系统会定期请求它。

这一节先实现一个简单版本：

```txt
GET /health
```

预期返回：

```json
{
  "status": "ok",
  "timestamp": "2026-04-24T10:00:00.000Z"
}
```

### 第一步：修改 `AppService`

在 `src/app.service.ts` 中新增一个方法：

```ts
getHealth() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}
```

修改后文件类似这样：

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello NestJS!';
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
```

### 第二步：修改 `AppController`

在 `src/app.controller.ts` 中新增一个接口：

```ts
@Get('health')
getHealth() {
  return this.appService.getHealth();
}
```

修改后文件类似这样：

```ts
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
```

### 第三步：请求新接口

```bash
curl http://localhost:3000/health
```

预期返回类似：

```json
{"status":"ok","timestamp":"2026-04-24T10:00:00.000Z"}
```

时间不需要和示例完全一样，只要是当前请求时生成的 ISO 时间字符串即可。

## 六、理解一次请求的流转路径

当你访问：

```txt
GET http://localhost:3000/health
```

当前项目中的大致流程是：

```txt
浏览器或 curl
  -> main.ts 启动的 Nest 应用
  -> AppModule 中注册的 AppController
  -> AppController.getHealth()
  -> AppService.getHealth()
  -> 返回 JSON 响应
```

换成文件视角：

```txt
src/main.ts
  -> src/app.module.ts
  -> src/app.controller.ts
  -> src/app.service.ts
```

注意：`main.ts` 不是每次请求都重新执行。它是在应用启动时执行，负责把服务跑起来。请求进来以后，NestJS 根据路由找到对应的 Controller 方法。

## 七、常见问题

### 1. 为什么访问 `/health` 返回 404？

优先检查：

- `AppController` 里是否添加了 `@Get('health')`。
- 方法是否写在 `AppController` 类里面。
- 服务是否重新编译成功。
- 请求路径是否写成了 `http://localhost:3000/health`。

### 2. 为什么端口不是 3000？

`main.ts` 中有这行：

```ts
await app.listen(process.env.PORT ?? 3000);
```

意思是：

- 如果环境变量 `PORT` 有值，就使用 `PORT`。
- 如果没有，就使用 `3000`。

所以如果你设置了 `PORT=4000`，服务就会跑在 `4000`。

### 3. 为什么 Controller 能直接用 AppService？

因为 `AppService` 被注册到了 `AppModule` 的 `providers`：

```ts
providers: [AppService],
```

同时 `AppController` 通过构造函数声明了自己需要它：

```ts
constructor(private readonly appService: AppService) {}
```

NestJS 会自动处理创建和传递对象的过程。这就是依赖注入的第一印象。

## 八、本节练习任务

### 任务 1：启动并访问默认接口

要求：

- 执行 `pnpm run start:dev`。
- 访问 `GET /`。
- 确认返回内容。

记录：

```txt
我访问的地址：
我看到的返回：
```

### 任务 2：修改默认返回内容

要求：

- 把默认返回从 `Hello World!` 改为 `Hello NestJS!`。
- 使用 `curl` 或浏览器确认结果。

记录：

```txt
我修改的文件：
我修改的方法：
修改后的返回：
```

### 任务 3：新增 `/health` 接口

要求：

- 新增 `AppService.getHealth()`。
- 新增 `AppController.getHealth()`。
- 访问 `GET /health`。
- 返回对象至少包含 `status` 和 `timestamp`。

记录：

```txt
GET /health 的返回结果：
```

### 任务 4：画出请求流转路径

要求：

用文字或图画说明：

```txt
GET /health
```

从请求进入，到响应返回，经过哪些文件和方法。

你可以参考这个模板：

```txt
请求：GET /health

1. 应用由 src/main.ts 启动。
2. 根模块 src/app.module.ts 注册了 AppController 和 AppService。
3. 请求命中 src/app.controller.ts 中的 getHealth 方法。
4. getHealth 方法调用 src/app.service.ts 中的 getHealth 方法。
5. AppService 返回健康状态对象。
6. NestJS 把对象序列化为 JSON 响应给客户端。
```

## 九、本节知识输出

请在自己的学习笔记中回答下面 4 个问题：

1. NestJS 主要帮后端项目解决什么问题？
2. `main.ts` 的职责是什么？
3. `AppModule` 的 `controllers` 和 `providers` 分别注册什么？
4. 为什么业务逻辑更适合放到 Service，而不是都写在 Controller？

建议每个问题用 3-5 句话回答。不要只抄定义，要结合你刚才新增 `/health` 接口的过程说明。

## 十、本节验收标准

完成本节后，请确认：

- `pnpm run start:dev` 可以启动项目。
- `GET /` 可以返回你修改后的字符串。
- `GET /health` 可以返回 JSON 对象。
- 你能说出 `main.ts`、`AppModule`、`AppController`、`AppService` 分别负责什么。
- 你能画出 `GET /health` 的请求流转路径。

## 十一、下一节预告

下一节会进入 Controller 与路由设计。

你将学习：

- 如何设计 RESTful API。
- 如何使用 `@Controller()`、`@Get()`、`@Post()`。
- 如何读取路径参数、查询参数和请求体。
- 如何创建一个简单的 `courses` 课程资源接口。

从下一节开始，我们会逐步从默认示例项目过渡到真正的课程管理 API。
