# 第 4 节：Module 与工程结构

## 本节目标

学完这一节，你要能做到：

- 理解 `@Module()` 的作用。
- 说清楚 `imports`、`controllers`、`providers`、`exports` 分别负责什么。
- 理解根模块和业务模块的区别。
- 将课程相关的 Controller 和 Service 移动到 `CoursesModule` 中管理。
- 创建 `UsersModule`、`UsersController`、`UsersService`。
- 让 `AppModule` 只负责组装业务模块，而不是直接管理所有 Controller 和 Service。
- 根据业务边界整理项目目录结构。

前三节我们已经创建了课程接口，并把业务逻辑从 `CoursesController` 拆到了 `CoursesService`。但现在 `AppModule` 里已经开始堆东西了：

```ts
@Module({
  imports: [],
  controllers: [AppController, CoursesController],
  providers: [AppService, CoursesService],
})
export class AppModule {}
```

项目继续变大后，如果课程、用户、认证、订单、报名记录都直接注册到 `AppModule`，根模块会越来越混乱。

这一节要解决的问题是：

> 用 Module 按业务边界组织代码，让每个业务模块管理自己的 Controller 和 Service。

## 一、Module 是什么

Module 是 NestJS 用来组织功能的基本单位。

你可以把 Module 理解成一个功能包。这个包里可以包含：

- Controller：负责接收 HTTP 请求。
- Provider：负责业务逻辑、数据访问、工具能力等。
- imports：导入其他模块。
- exports：把当前模块中的能力暴露给其他模块使用。

一个最小的模块大概长这样：

```ts
import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
```

这段代码的意思是：

```txt
CoursesModule
  - 管理 CoursesController
  - 管理 CoursesService
```

当我们把 `CoursesModule` 导入到 `AppModule` 后，NestJS 就能加载课程相关功能。

## 二、`@Module()` 的四个常见配置

### 1. `controllers`

`controllers` 用来注册当前模块里的 Controller。

```ts
@Module({
  controllers: [CoursesController],
})
export class CoursesModule {}
```

如果一个 Controller 没有被任何模块注册，它的路由就不会生效。

比如 `CoursesController` 里有：

```ts
@Controller('courses')
export class CoursesController {
  @Get()
  findAll() {}
}
```

只有当它被模块注册后，`GET /courses` 才能访问。

### 2. `providers`

`providers` 用来注册当前模块里的 Provider，最常见的是 Service。

```ts
@Module({
  providers: [CoursesService],
})
export class CoursesModule {}
```

注册以后，NestJS 才知道如何创建 `CoursesService`，并把它注入到 `CoursesController`。

如果忘记注册，通常会看到类似错误：

```txt
Nest can't resolve dependencies of the CoursesController
```

### 3. `imports`

`imports` 用来导入其他模块。

```ts
@Module({
  imports: [CoursesModule],
})
export class AppModule {}
```

这表示 `AppModule` 加载 `CoursesModule` 提供的功能。

注意：导入模块不是导入某个文件，而是导入一个被 `@Module()` 装饰的模块类。

### 4. `exports`

`exports` 用来把当前模块里的 Provider 暴露给其他模块使用。

```ts
@Module({
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
```

如果另一个模块想注入 `CoursesService`，光在 `CoursesModule` 里写 `providers` 不够，还需要 `exports`。

当前这一节暂时不需要跨模块使用 `CoursesService`，所以可以先不写 `exports`。但你要先记住这条规则：

> providers 只是让当前模块内部能用；exports 才是允许其他模块使用。

## 三、根模块与业务模块

NestJS 项目通常会有一个根模块：

```txt
AppModule
```

根模块是应用启动时加载的入口模块。`src/main.ts` 里这行代码就是从 `AppModule` 开始创建应用：

```ts
const app = await NestFactory.create(AppModule);
```

但根模块不应该什么都管。

更推荐的结构是：

```txt
AppModule
  -> 导入 CoursesModule
  -> 导入 UsersModule
  -> 后续导入 AuthModule、ConfigModule、DatabaseModule 等
```

业务模块负责自己的业务边界：

```txt
CoursesModule
  -> CoursesController
  -> CoursesService

UsersModule
  -> UsersController
  -> UsersService
```

一句话记忆：

> AppModule 负责组装应用，业务 Module 负责管理自己的业务代码。

## 四、本节要完成的目录结构

这一节结束后，目标目录结构是：

```txt
src/
  app.controller.ts
  app.module.ts
  app.service.ts
  main.ts
  courses/
    courses.controller.ts
    courses.module.ts
    courses.service.ts
  users/
    users.controller.ts
    users.module.ts
    users.service.ts
```

也就是说：

- 课程相关文件放进 `src/courses/`。
- 用户相关文件放进 `src/users/`。
- `AppModule` 不再直接注册 `CoursesController`、`CoursesService`、`UsersController`、`UsersService`。
- `AppModule` 只导入 `CoursesModule` 和 `UsersModule`。

## 五、方式一：手动创建 `CoursesModule`

先创建目录：

```txt
src/courses/
```

然后把已有文件移动进去：

```txt
src/courses.controller.ts -> src/courses/courses.controller.ts
src/courses.service.ts    -> src/courses/courses.service.ts
```

移动后，`courses.controller.ts` 里的导入路径仍然可以保持：

```ts
import { CoursesService } from './courses.service';
import type { CreateCourseBody, UpdateCourseBody } from './courses.service';
```

因为 `courses.controller.ts` 和 `courses.service.ts` 仍然在同一个目录下。

接着创建：

```txt
src/courses/courses.module.ts
```

写入：

```ts
import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
```

现在课程模块自己管理课程 Controller 和课程 Service。

## 六、修改 `AppModule`

打开：

```txt
src/app.module.ts
```

把课程相关的 Controller 和 Service 从根模块中移除，改为导入 `CoursesModule`。

修改前类似这样：

```ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  imports: [],
  controllers: [AppController, CoursesController],
  providers: [AppService, CoursesService],
})
export class AppModule {}
```

修改后：

```ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoursesModule } from './courses/courses.module';

@Module({
  imports: [CoursesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

这一步的变化很关键：

```txt
AppModule 不再直接知道 CoursesController 和 CoursesService。
AppModule 只知道：我要加载 CoursesModule。
```

课程模块内部的细节交给 `CoursesModule` 管理。

## 七、测试课程接口是否还正常

启动项目：

```bash
pnpm run start:dev
```

测试课程列表：

```bash
curl http://localhost:3000/courses
```

测试课程详情：

```bash
curl http://localhost:3000/courses/1
```

测试创建课程：

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "NestJS Module 实战",
    "description": "学习如何拆分业务模块",
    "price": 149
  }'
```

如果这些接口仍然正常，说明 `CoursesModule` 已经正确接管了课程功能。

注意：我们只是调整了文件归属和模块注册方式，对外接口路径没有变化。客户端仍然访问：

```txt
GET  /courses
POST /courses
```

## 八、方式二：使用 Nest CLI 生成模块

Nest CLI 可以帮你生成模块、控制器、服务。

例如生成课程模块：

```bash
pnpm nest generate module courses
```

也可以写成简写：

```bash
pnpm nest g module courses
```

生成 Controller：

```bash
pnpm nest g controller courses
```

生成 Service：

```bash
pnpm nest g service courses
```

如果你的项目里已经有了课程 Controller 和 Service，就不要重复生成同名文件，否则可能覆盖或产生重复结构。当前学习阶段，建议先手动移动一次文件，这样你能更清楚 Module 做了什么。

后续新建业务模块时，可以优先使用 CLI。

## 九、创建 `UsersModule`

现在创建一个新的用户模块，用来练习完整流程。

目标接口：

```txt
GET /users
```

预期返回：

```json
[
  {
    "id": 1,
    "name": "Alice",
    "email": "alice@example.com"
  },
  {
    "id": 2,
    "name": "Bob",
    "email": "bob@example.com"
  }
]
```

先创建目录：

```txt
src/users/
```

## 十、创建 `UsersService`

创建文件：

```txt
src/users/users.service.ts
```

写入：

```ts
import { Injectable } from '@nestjs/common';

export type User = {
  id: number;
  name: string;
  email: string;
};

@Injectable()
export class UsersService {
  private users: User[] = [
    {
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
    },
    {
      id: 2,
      name: 'Bob',
      email: 'bob@example.com',
    },
  ];

  findAll() {
    return this.users;
  }
}
```

这里先只做用户列表查询。后续课程会在认证授权阶段继续扩展用户模块。

## 十一、创建 `UsersController`

创建文件：

```txt
src/users/users.controller.ts
```

写入：

```ts
import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}
```

这里的路由组合结果是：

```txt
@Controller('users') + @Get() = GET /users
```

Controller 只负责定义接口和调用 Service，用户数组仍然放在 `UsersService` 中。

## 十二、创建 `UsersModule`

创建文件：

```txt
src/users/users.module.ts
```

写入：

```ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

现在用户模块内部结构是：

```txt
UsersModule
  -> UsersController
  -> UsersService
```

但此时 `AppModule` 还没有导入 `UsersModule`，所以应用还不会加载用户接口。

## 十三、在 `AppModule` 中导入 `UsersModule`

打开：

```txt
src/app.module.ts
```

导入：

```ts
import { UsersModule } from './users/users.module';
```

然后加入 `imports`：

```ts
@Module({
  imports: [CoursesModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

完整文件类似这样：

```ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoursesModule } from './courses/courses.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [CoursesModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

现在根模块的职责更清楚：

```txt
AppModule
  -> 加载 AppController 和 AppService
  -> 导入 CoursesModule
  -> 导入 UsersModule
```

## 十四、测试用户接口

启动项目：

```bash
pnpm run start:dev
```

请求：

```bash
curl http://localhost:3000/users
```

预期返回用户数组。

如果返回 404，优先检查：

- `UsersController` 是否写了 `@Controller('users')`。
- `UsersModule` 是否注册了 `UsersController`。
- `UsersModule` 是否被 `AppModule.imports` 导入。
- 文件导入路径是否正确。
- 服务是否重新编译成功。

## 十五、模块拆分后的依赖关系

现在项目的模块关系可以画成：

```txt
main.ts
  -> AppModule
       -> CoursesModule
            -> CoursesController
            -> CoursesService
       -> UsersModule
            -> UsersController
            -> UsersService
       -> AppController
       -> AppService
```

从请求角度看：

```txt
GET /courses
  -> CoursesController
  -> CoursesService

GET /users
  -> UsersController
  -> UsersService
```

模块拆分不会改变 HTTP 路径。HTTP 路径仍然由 Controller 装饰器决定：

```ts
@Controller('courses')
@Controller('users')
```

Module 决定的是这些 Controller 和 Provider 属于哪个功能边界，以及它们如何被应用加载。

## 十六、什么时候应该拆模块

模块不是越多越好，也不是所有类都要单独放一个模块。

通常可以用三个标准判断是否要拆模块。

### 1. 是否有清晰的业务边界

课程、用户、认证、订单、报名记录就是不同业务边界。

如果一组 Controller 和 Service 总是在处理同一类业务，就适合放到同一个模块。

### 2. 是否会持续增长

如果某个功能以后会继续增加 Controller、Service、DTO、Repository、测试文件，就应该尽早形成独立目录。

比如课程模块后续可能会有：

```txt
courses/
  courses.controller.ts
  courses.service.ts
  courses.module.ts
  dto/
  entities/
  repositories/
```

### 3. 是否需要被其他模块复用

如果某个模块的 Service 会被其他模块使用，就需要考虑 `exports`。

例如以后报名模块可能需要查询课程信息：

```txt
EnrollmentsModule
  -> 需要使用 CoursesService
```

那时 `CoursesModule` 可能需要这样写：

```ts
@Module({
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
```

然后 `EnrollmentsModule` 导入 `CoursesModule` 后，才能注入 `CoursesService`。

当前阶段先不做跨模块注入，只理解规则即可。

## 十七、常见问题

### 1. 为什么把 Controller 移到 `courses/` 后导入报错？

通常是路径没有改对。

如果 `AppModule` 要导入课程模块，路径应该是：

```ts
import { CoursesModule } from './courses/courses.module';
```

而不是：

```ts
import { CoursesModule } from './courses.module';
```

### 2. 为什么 `GET /courses` 变成 404？

检查链路：

```txt
AppModule imports CoursesModule
CoursesModule controllers 注册 CoursesController
CoursesController 使用 @Controller('courses')
findAll 使用 @Get()
```

这条链路少任何一环，都可能导致路由没有注册成功。

### 3. `CoursesService` 还要不要写到 `AppModule.providers`？

不需要。

如果 `CoursesService` 是课程模块内部使用，就写在 `CoursesModule.providers`。

`AppModule` 只导入 `CoursesModule`：

```ts
imports: [CoursesModule]
```

不要同时在 `AppModule.providers` 和 `CoursesModule.providers` 里重复注册同一个 Service。这样会让依赖边界变混乱，也可能出现多个实例导致状态不一致。

### 4. `exports` 什么时候必须写？

当别的模块需要注入当前模块里的 Provider 时才需要写。

比如：

```txt
UsersModule 内部使用 UsersService
```

这种情况不需要 `exports`。

但如果：

```txt
AuthModule 需要注入 UsersService
```

那 `UsersModule` 就需要：

```ts
exports: [UsersService]
```

同时 `AuthModule` 需要：

```ts
imports: [UsersModule]
```

## 十八、本节练习任务

### 任务 1：创建 `CoursesModule`

要求：

- 创建 `src/courses/` 目录。
- 将 `courses.controller.ts` 和 `courses.service.ts` 移动到该目录。
- 创建 `src/courses/courses.module.ts`。
- 在 `CoursesModule` 中注册 `CoursesController` 和 `CoursesService`。

记录：

```txt
我创建的模块文件：
CoursesModule.controllers：
CoursesModule.providers：
```

### 任务 2：简化 `AppModule`

要求：

- 从 `AppModule` 中移除 `CoursesController` 和 `CoursesService`。
- 在 `AppModule.imports` 中加入 `CoursesModule`。
- 确认课程接口仍然可以访问。

记录：

```txt
AppModule.imports 当前包含：
GET /courses 测试结果：
```

### 任务 3：创建用户模块

要求：

- 创建 `src/users/users.service.ts`。
- 创建 `src/users/users.controller.ts`。
- 创建 `src/users/users.module.ts`。
- 实现 `GET /users` 用户列表接口。
- 在 `AppModule` 中导入 `UsersModule`。

记录：

```txt
我创建的用户模块文件：
GET /users 返回：
```

### 任务 4：画出模块依赖关系

要求：

用文字或图画出当前项目结构：

```txt
AppModule
CoursesModule
UsersModule
```

并说明每个模块管理哪些 Controller 和 Service。

### 任务 5：总结模块拆分标准

要求：

结合课程模块和用户模块，回答：

```txt
什么时候应该创建一个新 Module？
为什么不建议把所有 Controller 和 Service 都放在 AppModule？
exports 和 providers 的区别是什么？
```

## 十九、本节知识输出

请在学习笔记中回答下面问题：

1. `@Module()` 的 `imports`、`controllers`、`providers`、`exports` 分别负责什么？
2. `AppModule` 和 `CoursesModule` 的职责有什么区别？
3. 为什么 `CoursesService` 移到 `CoursesModule.providers` 后，就不应该继续放在 `AppModule.providers`？
4. 如果 `AuthModule` 想使用 `UsersService`，`UsersModule` 需要做什么？
5. 模块拆分的三个判断标准是什么？
6. 画出当前项目中 `AppModule`、`CoursesModule`、`UsersModule` 的依赖关系。

建议每个问题结合你本节实际移动文件和创建用户模块的过程回答。

## 二十、本节验收标准

完成本节后，请确认：

- `src/courses/` 目录已经存在。
- `CoursesController`、`CoursesService`、`CoursesModule` 都在 `src/courses/` 中。
- `AppModule` 通过 `imports` 导入 `CoursesModule`。
- `AppModule` 不再直接注册 `CoursesController` 和 `CoursesService`。
- `src/users/` 目录已经存在。
- `UsersController`、`UsersService`、`UsersModule` 都在 `src/users/` 中。
- `AppModule` 通过 `imports` 导入 `UsersModule`。
- `GET /courses` 可以正常访问。
- `GET /users` 可以正常访问。
- 你能解释 `imports`、`controllers`、`providers`、`exports` 的区别。

## 二十一、下一节预告

下一节会学习 DTO 与数据校验。

目前课程和用户接口虽然已经按模块拆分，但请求体仍然存在明显问题：

```ts
create(@Body() body: CreateCourseBody) {}
```

TypeScript 类型只在开发阶段有提示，不能自动拦截运行时传进来的错误数据。

比如客户端仍然可能传：

```json
{
  "title": "",
  "price": "not-a-number"
}
```

下一节会引入：

```txt
DTO
class-validator
class-transformer
ValidationPipe
```

让接口能够真正校验请求参数，而不是只依赖 TypeScript 类型提示。
