# 第 3 节：Provider、Service 与依赖注入

## 本节目标

学完这一节，你要能做到：

- 理解 Provider 是什么。
- 理解 Service 为什么通常要写成 Provider。
- 使用 `@Injectable()` 声明一个可注入的 Service。
- 在 Module 的 `providers` 中注册 Service。
- 在 Controller 构造函数中注入 Service。
- 将课程数据和业务逻辑从 `CoursesController` 移动到 `CoursesService`。
- 实现课程的创建、查询、更新、删除方法。
- 解释 Controller 与 Service 的职责边界。

第二节我们已经能写 `GET /courses`、`GET /courses/:id`、`POST /courses`。但当时为了先学路由，把课程数组和业务逻辑都放在了 Controller 中。

这一节要做一件很重要的事：

> 把 Controller 中的业务逻辑拆出去，交给 Service 管理。

这一步会让代码更像真实工程。

## 一、为什么不能把业务逻辑都写在 Controller

第二节的 `CoursesController` 里大概有这些内容：

```ts
@Controller('courses')
export class CoursesController {
  private courses: Course[] = [];

  @Get()
  findAll() {
    return this.courses;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const courseId = Number(id);
    return this.courses.find((item) => item.id === courseId);
  }

  @Post()
  create(@Body() body: any) {
    const course = {
      id: this.courses.length + 1,
      title: body.title,
      description: body.description,
      price: body.price,
    };

    this.courses.push(course);
    return course;
  }
}
```

现在代码还不算多，所以看起来问题不大。

但真实项目里，一个接口可能会做这些事：

- 校验用户身份。
- 检查角色权限。
- 查询数据库。
- 判断数据是否存在。
- 处理业务规则。
- 调用第三方服务。
- 写日志。
- 返回统一响应。

如果这些都写在 Controller 中，Controller 会越来越厚，最后变成一个很难维护的大文件。

更好的职责划分是：

```txt
Controller
  -> 负责 HTTP 层
  -> 定义路由
  -> 读取参数
  -> 调用 Service
  -> 返回结果

Service
  -> 负责业务逻辑
  -> 管理数据读写
  -> 执行业务规则
  -> 组织核心流程
```

一句话记忆：

> Controller 管“请求怎么进来”，Service 管“事情怎么完成”。

## 二、Provider 是什么

Provider 是 NestJS 中可以被依赖注入容器管理的对象。

常见 Provider 包括：

- Service。
- Repository。
- Factory。
- Helper。
- Client。

目前你只需要先掌握最常见的一种：

```txt
Service 是一种 Provider。
```

当一个类被注册为 Provider 后，NestJS 可以负责：

- 创建它的实例。
- 管理它的生命周期。
- 把它注入到需要它的类中。

例如：

```ts
@Injectable()
export class CoursesService {}
```

再在模块中注册：

```ts
providers: [CoursesService]
```

然后就可以在 Controller 中使用：

```ts
constructor(private readonly coursesService: CoursesService) {}
```

这就是依赖注入的基本形态。

## 三、`@Injectable()` 的作用

`@Injectable()` 用来声明一个类可以参与 NestJS 的依赖注入系统。

示例：

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class CoursesService {
  findAll() {
    return [];
  }
}
```

注意：只写 `@Injectable()` 还不够，还需要在模块里注册。

也就是说，一般要同时做两件事：

```txt
1. 在类上写 @Injectable()
2. 在 Module 的 providers 中注册这个类
```

比如：

```ts
@Module({
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class AppModule {}
```

## 四、依赖注入是什么

先看不用依赖注入的写法：

```ts
export class CoursesController {
  private coursesService = new CoursesService();
}
```

这种写法的问题是：

- Controller 自己负责创建 Service。
- 如果 Service 以后还依赖数据库、配置、日志，创建过程会越来越复杂。
- 测试时不方便替换成假的 Service。
- 类和类之间耦合更强。

NestJS 更推荐构造函数注入：

```ts
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}
}
```

这里的意思是：

> CoursesController 不自己创建 CoursesService，而是声明“我需要 CoursesService”，由 NestJS 容器负责提供。

用伪代码表示：

```txt
NestJS 启动
  -> 读取 AppModule
  -> 发现 providers 中有 CoursesService
  -> 创建 CoursesService 实例
  -> 发现 CoursesController 构造函数需要 CoursesService
  -> 把 CoursesService 实例传给 CoursesController
```

这就是依赖注入的第一层理解。

## 五、本节要完成的重构

目标结构：

```txt
src/
  courses.controller.ts
  courses.service.ts
  app.module.ts
```

目标职责：

```txt
CoursesController
  - findAll()
  - findOne()
  - create()
  - update()
  - remove()

CoursesService
  - findAll()
  - findOne()
  - create()
  - update()
  - remove()
```

注意：方法名可以一样，但职责不同。

Controller 的 `findAll()` 负责接收请求：

```ts
@Get()
findAll(@Query('keyword') keyword?: string) {
  return this.coursesService.findAll(keyword);
}
```

Service 的 `findAll()` 负责真正查询数据：

```ts
findAll(keyword?: string) {
  if (!keyword) {
    return this.courses;
  }

  return this.courses.filter((course) =>
    course.title.toLowerCase().includes(keyword.toLowerCase()),
  );
}
```

## 六、创建 `CoursesService`

在 `src` 目录下创建文件：

```txt
src/courses.service.ts
```

写入下面代码：

```ts
import { Injectable } from '@nestjs/common';

export type Course = {
  id: number;
  title: string;
  description: string;
  price: number;
};

type CreateCourseInput = {
  title: string;
  description: string;
  price: number;
};

type UpdateCourseInput = Partial<CreateCourseInput>;

@Injectable()
export class CoursesService {
  private courses: Course[] = [
    {
      id: 1,
      title: 'NestJS 入门',
      description: '学习 NestJS 的 Controller、Service 和 Module',
      price: 99,
    },
    {
      id: 2,
      title: 'TypeScript 基础',
      description: '学习 TypeScript 常用类型和工程配置',
      price: 59,
    },
  ];

  findAll(keyword?: string) {
    if (!keyword) {
      return this.courses;
    }

    return this.courses.filter((course) =>
      course.title.toLowerCase().includes(keyword.toLowerCase()),
    );
  }

  findOne(id: number) {
    const course = this.courses.find((item) => item.id === id);

    if (!course) {
      return {
        message: '课程不存在',
      };
    }

    return course;
  }

  create(input: CreateCourseInput) {
    const course: Course = {
      id: this.getNextId(),
      title: input.title,
      description: input.description,
      price: input.price,
    };

    this.courses.push(course);

    return course;
  }

  update(id: number, input: UpdateCourseInput) {
    const course = this.courses.find((item) => item.id === id);

    if (!course) {
      return {
        message: '课程不存在',
      };
    }

    Object.assign(course, input);

    return course;
  }

  remove(id: number) {
    const index = this.courses.findIndex((item) => item.id === id);

    if (index === -1) {
      return {
        message: '课程不存在',
      };
    }

    const [removedCourse] = this.courses.splice(index, 1);

    return removedCourse;
  }

  private getNextId() {
    const maxId = this.courses.reduce((max, course) => {
      return course.id > max ? course.id : max;
    }, 0);

    return maxId + 1;
  }
}
```

这里做了几件事：

- 用 `@Injectable()` 声明 `CoursesService`。
- 把课程数组移动到 Service。
- 把列表查询、详情查询、创建、更新、删除都放进 Service。
- 用 `CreateCourseInput` 描述创建课程需要的数据。
- 用 `UpdateCourseInput` 描述更新课程允许传入部分字段。
- 用 `getNextId()` 生成下一个 ID。

这里的 `getNextId()` 仍然只是学习阶段方案。真实项目里 ID 一般交给数据库生成。

## 七、重构 `CoursesController`

打开：

```txt
src/courses.controller.ts
```

把 Controller 改成下面这样：

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CoursesService } from './courses.service';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  findAll(@Query('keyword') keyword?: string) {
    return this.coursesService.findAll(keyword);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(Number(id));
  }

  @Post()
  create(@Body() body: any) {
    return this.coursesService.create({
      title: body.title,
      description: body.description,
      price: body.price,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.coursesService.update(Number(id), {
      title: body.title,
      description: body.description,
      price: body.price,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.coursesService.remove(Number(id));
  }
}
```

你会发现 Controller 变薄了。

现在它只做这些事：

- 定义路由。
- 读取 `Param`、`Query`、`Body`。
- 调用 `CoursesService`。
- 返回 Service 的结果。

这就是本节最重要的变化。

## 八、在 `AppModule` 中注册 Service

打开：

```txt
src/app.module.ts
```

引入 `CoursesService`：

```ts
import { CoursesService } from './courses.service';
```

然后加入 `providers`：

```ts
@Module({
  imports: [],
  controllers: [AppController, CoursesController],
  providers: [AppService, CoursesService],
})
export class AppModule {}
```

完整文件类似这样：

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

如果忘记把 `CoursesService` 加到 `providers`，启动项目时通常会看到依赖解析错误。

错误信息里可能会出现：

```txt
Nest can't resolve dependencies of the CoursesController
```

这类错误的意思通常是：

> Controller 需要某个依赖，但 NestJS 不知道该怎么创建它。

## 九、启动并测试接口

启动项目：

```bash
pnpm run start:dev
```

### 1. 查询课程列表

```bash
curl http://localhost:3000/courses
```

预期返回课程数组。

### 2. 查询课程详情

```bash
curl http://localhost:3000/courses/1
```

预期返回 ID 为 `1` 的课程。

### 3. 创建课程

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Node.js 工程实践",
    "description": "学习 Node.js 后端项目开发",
    "price": 129
  }'
```

预期返回新课程。

### 4. 更新课程

```bash
curl -X PATCH http://localhost:3000/courses/1 \
  -H "Content-Type: application/json" \
  -d '{
    "price": 199
  }'
```

预期返回更新后的课程。

注意：当前写法里，如果你传入没有定义的字段，暂时不会被严格拦截。第 5 节会用 DTO 和 ValidationPipe 改进这个问题。

### 5. 删除课程

```bash
curl -X DELETE http://localhost:3000/courses/1
```

预期返回被删除的课程。

再次查询：

```bash
curl http://localhost:3000/courses/1
```

预期返回：

```json
{
  "message": "课程不存在"
}
```

## 十、对比重构前后

### 重构前

```txt
CoursesController
  - 定义路由
  - 保存课程数组
  - 查询课程
  - 创建课程
  - 更新课程
  - 删除课程
```

问题：

- Controller 职责太多。
- 业务逻辑不容易单独测试。
- 以后接数据库时 Controller 会继续变复杂。

### 重构后

```txt
CoursesController
  - 定义路由
  - 读取请求参数
  - 调用 CoursesService

CoursesService
  - 保存课程数组
  - 查询课程
  - 创建课程
  - 更新课程
  - 删除课程
```

好处：

- Controller 更薄。
- Service 可以单独阅读和测试。
- 后续接数据库时，主要修改 Service。
- 职责边界更清晰。

## 十一、依赖注入流程图

当前项目里 `CoursesController` 使用 `CoursesService` 的流程可以这样理解：

```txt
src/app.module.ts
  -> providers 注册 CoursesService
  -> controllers 注册 CoursesController

NestJS 启动应用
  -> 创建 CoursesService 实例
  -> 创建 CoursesController 实例
  -> 发现 CoursesController 构造函数需要 CoursesService
  -> 把 CoursesService 注入 CoursesController

请求 GET /courses
  -> 命中 CoursesController.findAll()
  -> 调用 CoursesService.findAll()
  -> 返回课程列表
```

你也可以用伪代码写成：

```ts
const coursesService = new CoursesService();
const coursesController = new CoursesController(coursesService);
```

真实的 NestJS 容器做的事情更复杂，但第一阶段可以先这样理解。

## 十二、常见问题

### 1. 为什么启动时报 `Nest can't resolve dependencies`？

通常是 Service 没有注册到模块的 `providers`。

检查 `src/app.module.ts`：

```ts
providers: [AppService, CoursesService],
```

同时检查是否正确导入：

```ts
import { CoursesService } from './courses.service';
```

### 2. 为什么 Controller 中不用 `new CoursesService()`？

因为 NestJS 推荐由容器管理依赖。

这样做的好处是：

- 依赖创建统一由框架处理。
- 依赖关系更清楚。
- 后续测试时可以替换 Service。
- Service 依赖其他对象时，不需要 Controller 管创建细节。

### 3. `@Injectable()` 是不是写了就能注入？

不是。

一般需要同时满足：

```txt
1. 类上有 @Injectable()
2. 模块 providers 中注册了这个类
3. 使用方在同一个模块范围内能访问到它
```

这一节只有一个 `AppModule`，所以先记住前两点即可。第 4 节会讲模块范围和 `exports`。

### 4. 为什么 `CoursesService` 里的数组还是会在重启后丢失？

因为它仍然只是内存数据。

Service 负责管理数据逻辑，但它不等于数据库。第 10 节会接入真正的数据库持久化。

### 5. 为什么现在还在用 `any`？

因为这一节重点是 Service 和依赖注入。

请求体的类型和校验会在第 5 节学习 DTO 与 ValidationPipe 时解决。

## 十三、本节练习任务

### 任务 1：创建 `CoursesService`

要求：

- 创建 `src/courses.service.ts`。
- 添加 `@Injectable()`。
- 在 Service 中定义课程数组。
- 实现 `findAll()` 和 `findOne()`。

记录：

```txt
我创建的文件：
Service 中已有的方法：
```

### 任务 2：注册 `CoursesService`

要求：

- 在 `AppModule` 中导入 `CoursesService`。
- 将 `CoursesService` 加入 `providers`。

记录：

```txt
我修改的模块文件：
providers 当前包含：
```

### 任务 3：在 Controller 中注入 Service

要求：

- 在 `CoursesController` 构造函数中注入 `CoursesService`。
- 将 `GET /courses` 改为调用 `this.coursesService.findAll()`。
- 将 `GET /courses/:id` 改为调用 `this.coursesService.findOne()`。

记录：

```txt
Controller 构造函数代码：
GET /courses 测试结果：
GET /courses/1 测试结果：
```

### 任务 4：补全创建、更新、删除

要求：

- 在 `CoursesService` 中实现 `create()`、`update()`、`remove()`。
- 在 `CoursesController` 中实现 `POST /courses`、`PATCH /courses/:id`、`DELETE /courses/:id`。
- 使用 curl 测试三个接口。

记录：

```txt
POST /courses 返回：
PATCH /courses/:id 返回：
DELETE /courses/:id 返回：
```

### 任务 5：观察 Controller 是否变薄

要求：

对比重构前后的 `CoursesController`，回答：

```txt
哪些代码从 Controller 移到了 Service？
Controller 现在还剩哪些职责？
Service 现在承担哪些职责？
```

## 十四、本节知识输出

请在学习笔记中回答下面问题：

1. Provider 是什么？Service 和 Provider 是什么关系？
2. `@Injectable()` 的作用是什么？
3. 为什么 `CoursesService` 要写到 `providers` 中？
4. Controller 为什么不应该自己 `new CoursesService()`？
5. 用伪代码描述 NestJS 如何把 `CoursesService` 注入到 `CoursesController`。
6. 为什么业务逻辑更适合放在 Service，而不是 Controller？

建议每个问题结合本节的课程接口重构回答。

## 十五、本节验收标准

完成本节后，请确认：

- 项目能正常启动。
- `CoursesService` 已创建并添加 `@Injectable()`。
- `CoursesService` 已注册到 `AppModule.providers`。
- `CoursesController` 通过构造函数注入 `CoursesService`。
- 课程的查询、创建、更新、删除都由 Service 完成。
- Controller 中没有课程数组。
- Controller 中没有复杂的数据处理逻辑。
- 你能解释 Provider、Service、依赖注入之间的关系。

## 十六、下一节预告

下一节会学习 Module 与工程结构。

这一节我们把业务逻辑拆到了 `CoursesService`，但 `AppModule` 里已经开始同时注册默认控制器、课程控制器、默认服务、课程服务。

随着业务继续增加，如果所有东西都堆在 `AppModule`，它也会越来越乱。

下一节我们会创建：

```txt
CoursesModule
UsersModule
```

让每个业务模块管理自己的 Controller 和 Service。
