# 第 2 节：Controller 与路由设计

## 本节目标

学完这一节，你要能做到：

- 理解 Controller 在 NestJS 中负责什么。
- 使用 `@Controller()` 给一组接口设置统一路由前缀。
- 使用 `@Get()`、`@Post()` 定义 GET 和 POST 接口。
- 使用 `@Param()` 读取路径参数。
- 使用 `@Query()` 读取查询参数。
- 使用 `@Body()` 读取请求体。
- 按 RESTful 思路设计一个简单的课程资源接口。
- 使用内存数组临时保存课程数据。

第一节我们只在默认的 `AppController` 里新增了 `/health`。这一节开始，你会真正设计一个业务资源：课程 `courses`。

## 一、Controller 的职责

Controller 是 HTTP 请求进入业务代码的入口。

它主要负责三件事：

- 定义接口路径。
- 接收请求参数。
- 调用后续业务逻辑并返回结果。

在当前阶段，我们还没有专门拆 Service，所以会先把简单数据逻辑写在 Controller 中。第 3 节会把这些逻辑移动到 Service，让职责更清晰。

一个 Controller 大概长这样：

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('courses')
export class CoursesController {
  @Get()
  findAll() {
    return [];
  }
}
```

这里定义了一个接口：

```txt
GET /courses
```

拆开看：

- `@Controller('courses')`：给这个控制器下的接口增加统一前缀 `/courses`。
- `@Get()`：定义一个 GET 请求。
- `findAll()`：请求命中后实际执行的方法。

## 二、理解路由组合规则

NestJS 的接口路径通常由两部分组成：

```txt
Controller 前缀 + 方法路径
```

例如：

```ts
@Controller('courses')
export class CoursesController {
  @Get()
  findAll() {}

  @Get(':id')
  findOne() {}
}
```

最终得到：

```txt
GET /courses
GET /courses/:id
```

再看一个例子：

```ts
@Controller('users')
export class UsersController {
  @Get('profile')
  getProfile() {}
}
```

最终得到：

```txt
GET /users/profile
```

你可以把 `@Controller()` 看成“大目录”，把 `@Get()`、`@Post()` 看成“目录里的具体文件或动作”。

## 三、RESTful API 的第一印象

RESTful 是一种常见的接口设计风格。它强调围绕“资源”设计接口，而不是围绕“动作”随意命名接口。

比如我们要管理课程，资源名是：

```txt
courses
```

常见接口可以这样设计：

```txt
GET    /courses       查询课程列表
GET    /courses/:id   查询课程详情
POST   /courses       创建课程
PATCH  /courses/:id   更新课程
DELETE /courses/:id   删除课程
```

这一节先实现前三个：

```txt
GET  /courses
GET  /courses/:id
POST /courses
```

后面课程会继续补充更新、删除、分页、校验、数据库等能力。

## 四、常用装饰器

这一节会用到 5 个装饰器。

### 1. `@Controller()`

声明一个类是 Controller，并设置统一路由前缀。

```ts
@Controller('courses')
export class CoursesController {}
```

### 2. `@Get()`

声明一个 GET 接口。

```ts
@Get()
findAll() {}
```

也可以带路径：

```ts
@Get(':id')
findOne() {}
```

### 3. `@Post()`

声明一个 POST 接口。

```ts
@Post()
create() {}
```

### 4. `@Param()`

读取路径参数。

```ts
@Get(':id')
findOne(@Param('id') id: string) {
  return id;
}
```

请求：

```txt
GET /courses/1
```

此时 `id` 的值是字符串 `'1'`。

注意：HTTP 请求里的参数默认大多是字符串。后面第 6 节会学习如何用 Pipe 转换成数字。

### 5. `@Query()`

读取查询参数。

```ts
@Get()
findAll(@Query('keyword') keyword?: string) {
  return keyword;
}
```

请求：

```txt
GET /courses?keyword=nest
```

此时 `keyword` 的值是 `'nest'`。

### 6. `@Body()`

读取请求体。

```ts
@Post()
create(@Body() body: any) {
  return body;
}
```

请求体示例：

```json
{
  "title": "NestJS 入门",
  "description": "学习 NestJS 基础",
  "price": 99
}
```

这一节先用 `any`，因为我们还没学 DTO。第 5 节会把请求体改造成类型明确、可校验的 DTO。

## 五、本节要实现的接口

我们要创建一个课程资源 Controller。

接口清单：

```txt
GET  /courses
GET  /courses?keyword=nest
GET  /courses/:id
POST /courses
```

返回数据先保存在内存数组中。

课程对象暂时设计成：

```ts
{
  id: number;
  title: string;
  description: string;
  price: number;
}
```

注意：内存数组只适合学习阶段。服务重启后，数据会丢失。第 10 节会接入数据库。

## 六、创建 `CoursesController`

在 `src` 目录下创建文件：

```txt
src/courses.controller.ts
```

写入下面代码：

```ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

type Course = {
  id: number;
  title: string;
  description: string;
  price: number;
};

@Controller('courses')
export class CoursesController {
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

  @Get()
  findAll(@Query('keyword') keyword?: string) {
    if (!keyword) {
      return this.courses;
    }

    return this.courses.filter((course) =>
      course.title.toLowerCase().includes(keyword.toLowerCase()),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const courseId = Number(id);
    const course = this.courses.find((item) => item.id === courseId);

    if (!course) {
      return {
        message: '课程不存在',
      };
    }

    return course;
  }

  @Post()
  create(@Body() body: any) {
    const course: Course = {
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

这里先有几个“不完美”的地方：

- `@Body() body: any` 类型不够严格。
- `Number(id)` 转换失败时没有处理。
- 课程不存在时没有返回真正的 404 状态码。
- `id: this.courses.length + 1` 在真实项目里不可靠。
- 业务逻辑暂时写在 Controller 中。

这些问题不是疏忽，而是后续课程要逐个解决的工程问题。现在先把路由和参数读取跑通。

## 七、注册 `CoursesController`

创建 Controller 后，NestJS 还不知道它的存在。

打开：

```txt
src/app.module.ts
```

引入 `CoursesController`：

```ts
import { CoursesController } from './courses.controller';
```

然后把它加入 `controllers`：

```ts
@Module({
  imports: [],
  controllers: [AppController, CoursesController],
  providers: [AppService],
})
export class AppModule {}
```

完整文件类似这样：

```ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoursesController } from './courses.controller';

@Module({
  imports: [],
  controllers: [AppController, CoursesController],
  providers: [AppService],
})
export class AppModule {}
```

如果忘记注册 Controller，请求 `/courses` 时通常会得到 404。

## 八、启动并测试接口

启动项目：

```bash
pnpm run start:dev
```

### 1. 查询课程列表

```bash
curl http://localhost:3000/courses
```

预期返回两个默认课程。

### 2. 按关键词查询

```bash
curl "http://localhost:3000/courses?keyword=nest"
```

预期只返回标题中包含 `nest` 的课程。

注意这里 URL 加了双引号，因为有些终端会对 `?` 和 `&` 做特殊处理。

### 3. 查询课程详情

```bash
curl http://localhost:3000/courses/1
```

预期返回 ID 为 `1` 的课程。

再试一个不存在的 ID：

```bash
curl http://localhost:3000/courses/999
```

预期返回：

```json
{
  "message": "课程不存在"
}
```

### 4. 创建课程

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Node.js 工程实践",
    "description": "学习 Node.js 后端项目开发",
    "price": 129
  }'
```

预期返回新创建的课程：

```json
{
  "id": 3,
  "title": "Node.js 工程实践",
  "description": "学习 Node.js 后端项目开发",
  "price": 129
}
```

再次查询列表：

```bash
curl http://localhost:3000/courses
```

你应该能看到新课程。

如果重启服务，新创建的课程会消失，因为数据只存在内存里。

## 九、理解参数来源

以这三个请求为例：

```txt
GET /courses?keyword=nest
GET /courses/1
POST /courses
```

它们的数据来源不同。

### 查询参数 Query

请求：

```txt
GET /courses?keyword=nest
```

读取方式：

```ts
@Query('keyword') keyword?: string
```

适合用于：

- 搜索关键词。
- 分页参数。
- 排序参数。
- 筛选条件。

### 路径参数 Param

请求：

```txt
GET /courses/1
```

读取方式：

```ts
@Param('id') id: string
```

适合用于：

- 资源 ID。
- 明确定位某个资源的参数。

### 请求体 Body

请求：

```txt
POST /courses
```

读取方式：

```ts
@Body() body: any
```

适合用于：

- 创建资源的数据。
- 修改资源的数据。
- 结构较复杂的提交内容。

## 十、HTTP 方法怎么选

常见选择：

```txt
GET     查询资源
POST    创建资源
PATCH   局部更新资源
PUT     整体替换资源
DELETE  删除资源
```

课程资源示例：

```txt
GET    /courses          查询课程列表
GET    /courses/1        查询 ID 为 1 的课程
POST   /courses          创建课程
PATCH  /courses/1        修改 ID 为 1 的课程
DELETE /courses/1        删除 ID 为 1 的课程
```

一个常见误区是把动作放进路径里：

```txt
POST /createCourse
POST /deleteCourse
GET  /getCourseList
```

学习阶段能跑就行，但真实项目中更建议围绕资源设计路径，用 HTTP 方法表达动作。

更推荐：

```txt
POST   /courses
DELETE /courses/:id
GET    /courses
```

## 十一、本节练习任务

### 任务 1：创建课程 Controller

要求：

- 创建 `src/courses.controller.ts`。
- 使用 `@Controller('courses')` 设置路由前缀。
- 在 `AppModule` 中注册 `CoursesController`。

记录：

```txt
我创建的文件：
我修改的模块文件：
```

### 任务 2：实现课程列表接口

要求：

- 实现 `GET /courses`。
- 返回一个课程数组。
- 每个课程至少包含 `id`、`title`、`description`、`price`。

记录：

```txt
GET /courses 的返回：
```

### 任务 3：实现课程详情接口

要求：

- 实现 `GET /courses/:id`。
- 使用 `@Param('id')` 获取课程 ID。
- 根据 ID 查询课程。
- 不存在时返回 `{ message: '课程不存在' }`。

记录：

```txt
GET /courses/1 的返回：
GET /courses/999 的返回：
```

### 任务 4：实现课程创建接口

要求：

- 实现 `POST /courses`。
- 使用 `@Body()` 获取请求体。
- 将新课程加入内存数组。
- 返回创建后的课程。

记录：

```txt
POST /courses 的请求体：
POST /courses 的返回：
再次 GET /courses 的返回：
```

### 任务 5：实现关键词筛选

要求：

- 让 `GET /courses?keyword=xxx` 支持按课程标题筛选。
- 使用 `@Query('keyword')` 获取关键词。
- 不传 `keyword` 时返回全部课程。

记录：

```txt
GET /courses?keyword=nest 的返回：
GET /courses 的返回：
```

## 十二、本节知识输出

请在学习笔记中回答下面问题：

1. `@Controller('courses')` 中的 `courses` 会影响什么？
2. `@Get(':id')` 中的 `:id` 是什么含义？
3. `@Param()`、`@Query()`、`@Body()` 分别从请求的哪里取数据？
4. 为什么 `GET /courses` 比 `GET /getCourseList` 更符合 RESTful 风格？
5. 当前把课程数组写在 Controller 中有什么问题？下一节应该如何改进？

建议每个问题都结合你写的 `CoursesController` 回答。

## 十三、课程章节 RESTful 路由设计练习

现在不需要写代码，只做接口设计。

假设一个课程下面有多个章节，资源关系是：

```txt
课程 Course
  -> 章节 Lesson
```

请设计下面接口：

```txt
查询某个课程的章节列表
查询某个课程的某个章节详情
给某个课程创建章节
修改某个课程的某个章节
删除某个课程的某个章节
```

参考答案：

```txt
GET    /courses/:courseId/lessons
GET    /courses/:courseId/lessons/:lessonId
POST   /courses/:courseId/lessons
PATCH  /courses/:courseId/lessons/:lessonId
DELETE /courses/:courseId/lessons/:lessonId
```

思考：

- 为什么章节接口前面要带 `courseId`？
- 如果章节本身也有全局唯一 ID，是否还需要把它放在课程下面？
- 嵌套路由太深时，会不会影响接口可读性？

这些问题没有唯一答案，真实项目里需要结合业务和团队约定。

## 十四、常见问题

### 1. 为什么 `/courses` 返回 404？

检查：

- 是否创建了 `src/courses.controller.ts`。
- 是否写了 `@Controller('courses')`。
- 是否在 `AppModule` 的 `controllers` 中注册了 `CoursesController`。
- 文件导入路径是否正确。
- 服务是否重新编译成功。

### 2. 为什么 `POST /courses` 拿不到请求体？

检查：

- 请求头是否包含 `Content-Type: application/json`。
- `curl` 是否使用了 `-d` 传 JSON。
- JSON 格式是否正确，比如字符串要用双引号。

正确示例：

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{"title":"NestJS 进阶","description":"学习路由设计","price":199}'
```

### 3. 为什么 `id` 明明是数字，却要写成 string？

HTTP 请求中的路径参数本质上是字符串。

例如：

```txt
GET /courses/1
```

这里的 `1` 进入 Controller 后默认是 `'1'`。所以示例中使用：

```ts
const courseId = Number(id);
```

后面我们会学习 `ParseIntPipe`，让 NestJS 自动帮我们转换。

### 4. 为什么创建课程后重启服务数据消失了？

因为课程数据保存在 Controller 的内存数组中。

服务重启后，内存会重新初始化。第 10 节接入数据库后，数据才会真正持久化。

## 十五、本节验收标准

完成本节后，请确认：

- `GET /courses` 可以返回课程数组。
- `GET /courses?keyword=nest` 可以按标题筛选。
- `GET /courses/:id` 可以读取路径参数并返回对应课程。
- `POST /courses` 可以读取 JSON 请求体并创建课程。
- 你能解释 `@Controller()`、`@Get()`、`@Post()`、`@Param()`、`@Query()`、`@Body()` 的用途。
- 你能为课程章节设计一组基本 RESTful 路由。

## 十六、下一节预告

下一节会学习 Provider、Service 与依赖注入。

你会把这一节写在 `CoursesController` 里的课程数组和业务逻辑移动到 `CoursesService` 中，让 Controller 只负责处理 HTTP 请求。

这会让代码结构更接近真实工程：

```txt
CoursesController
  -> 接收请求、读取参数、返回响应

CoursesService
  -> 管理课程数据、处理业务逻辑
```
