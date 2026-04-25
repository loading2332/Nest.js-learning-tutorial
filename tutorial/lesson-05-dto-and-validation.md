# 第 5 节：DTO 与数据校验

## 本节目标

学完这一节，你要能做到：

- 理解 DTO 是什么，以及它和普通 TypeScript 类型的区别。
- 理解为什么后端不能相信前端传参。
- 使用 `class-validator` 给请求体字段添加校验规则。
- 使用 `class-transformer` 配合 NestJS 做类型转换。
- 在 `main.ts` 中配置全局 `ValidationPipe`。
- 为创建课程接口添加 `CreateCourseDto`。
- 为更新课程接口添加 `UpdateCourseDto`。
- 理解 `whitelist`、`forbidNonWhitelisted`、`transform` 的作用。
- 让非法请求在进入 Service 之前被拦截。

前面几节我们已经有了课程模块：

```txt
src/
  courses/
    courses.controller.ts
    courses.module.ts
    courses.service.ts
```

现在 `CoursesController` 中创建课程的代码大概是这样：

```ts
@Post()
create(@Body() body: CreateCourseBody) {
  return this.coursesService.create({
    title: body.title,
    description: body.description,
    price: body.price,
  });
}
```

这里虽然写了 `CreateCourseBody` 类型，但它只能帮助 TypeScript 在开发阶段提示错误，不能阻止运行时的非法请求。

比如客户端仍然可以传：

```json
{
  "title": "",
  "description": 123,
  "price": "abc",
  "unknown": "extra field"
}
```

这一节要解决的问题是：

> 在请求进入业务逻辑之前，先把请求数据的结构、类型和规则校验清楚。

## 一、为什么需要数据校验

后端接口不能假设前端一定会传正确数据。

原因很简单：

- 前端页面可能有 bug。
- 用户可以绕过页面，直接用 Postman、curl 请求接口。
- 第三方系统调用接口时可能传错字段。
- 恶意请求可能故意传入异常数据。
- TypeScript 类型在运行时不存在，不能保护接口。

比如你希望创建课程时传入：

```json
{
  "title": "NestJS 入门",
  "description": "学习 NestJS 基础",
  "price": 99
}
```

但真实请求可能是：

```json
{
  "title": "",
  "description": "x",
  "price": -100,
  "admin": true
}
```

如果后端不校验，这些错误数据就可能进入 Service，甚至进入数据库。

所以真实项目里要把校验放在请求边界处：

```txt
客户端请求
  -> Controller 参数接收
  -> DTO + ValidationPipe 校验
  -> Service 业务逻辑
```

这一节先处理请求体校验。第 6 节会继续学习路径参数、查询参数和自定义 Pipe。

## 二、DTO 是什么

DTO 是 Data Transfer Object 的缩写，意思是“数据传输对象”。

在接口开发中，DTO 通常用来描述：

```txt
客户端传给后端的数据长什么样。
```

例如创建课程需要这些字段：

```ts
export class CreateCourseDto {
  title: string;
  description: string;
  price: number;
}
```

这个 DTO 表示：

```txt
POST /courses 的请求体应该包含：

- title
- description
- price
```

但只有字段声明还不够，因为运行时不会自动检查这些字段。我们还要在字段上添加校验装饰器：

```ts
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  price: number;
}
```

这样 DTO 就不只是类型描述，还包含了运行时校验规则。

## 三、DTO 和 TypeScript type 的区别

前面我们在 `courses.service.ts` 里写过：

```ts
export type CreateCourseBody = {
  title: string;
  description: string;
  price: number;
};
```

这对开发提示有帮助，但不能做运行时校验。

原因是 TypeScript 的 `type` 在编译成 JavaScript 后会被擦除。

也就是说，运行时根本没有 `CreateCourseBody` 这个东西。

而 DTO 通常写成 `class`：

```ts
export class CreateCourseDto {
  title: string;
  description: string;
  price: number;
}
```

`class` 编译后仍然存在于 JavaScript 运行时，NestJS 和 `class-validator` 才能读取它上面的装饰器元数据。

对比一下：

```txt
type / interface
  -> 主要用于 TypeScript 编译阶段
  -> 运行时不存在
  -> 不能直接配合 class-validator 做装饰器校验

class DTO
  -> 运行时存在
  -> 可以挂载装饰器元数据
  -> 可以被 ValidationPipe 校验
```

所以在 NestJS 中，请求体 DTO 通常使用 `class`。

## 四、安装校验依赖

NestJS 的数据校验常用两个库：

```txt
class-validator
class-transformer
```

安装：

```bash
pnpm add class-validator class-transformer
```

它们的分工可以先这样理解：

```txt
class-validator
  -> 负责校验字段是否符合规则

class-transformer
  -> 负责把普通对象转换成 DTO 类实例
  -> 也可以配合类型转换
```

没有这两个依赖，`ValidationPipe` 无法完成这一节的 DTO 校验。

## 五、配置全局 `ValidationPipe`

打开：

```txt
src/main.ts
```

当前代码大概是：

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

修改为：

```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

这段配置表示所有接口都会启用参数校验。

三个配置先这样理解：

```txt
whitelist: true
  -> 自动移除 DTO 中没有声明的字段

forbidNonWhitelisted: true
  -> 如果请求体中出现 DTO 没声明的字段，直接报错

transform: true
  -> 尝试把请求数据转换成 DTO 中声明的类型
```

本课程建议学习阶段同时打开：

```ts
whitelist: true,
forbidNonWhitelisted: true,
transform: true,
```

这样非法字段会暴露得更明显，方便你理解接口边界。

## 六、创建 DTO 目录

在课程模块下创建目录：

```txt
src/courses/dto/
```

目标结构：

```txt
src/
  courses/
    dto/
      create-course.dto.ts
      update-course.dto.ts
    courses.controller.ts
    courses.module.ts
    courses.service.ts
```

DTO 放在 `courses/dto/` 下，是因为这些 DTO 属于课程模块。

后续用户模块也可以有自己的 DTO：

```txt
src/users/dto/
```

这样目录结构能体现业务边界。

## 七、创建 `CreateCourseDto`

创建文件：

```txt
src/courses/dto/create-course.dto.ts
```

写入：

```ts
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;

  @IsInt()
  @Min(0)
  price: number;

  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: 'draft' | 'published';
}
```

这里定义了四个字段：

```txt
title
  -> 必填
  -> 必须是字符串
  -> 不能为空
  -> 最多 50 个字符

description
  -> 可选
  -> 如果传了，必须是字符串
  -> 最多 200 个字符

price
  -> 必填
  -> 必须是整数
  -> 不能小于 0

status
  -> 可选
  -> 只能是 draft 或 published
```

常用装饰器含义：

```txt
@IsString()
  -> 必须是字符串

@IsNotEmpty()
  -> 不能为空字符串、null、undefined

@IsOptional()
  -> 字段可以不传；不传时跳过后续校验

@MaxLength(50)
  -> 字符串最大长度 50

@IsInt()
  -> 必须是整数

@Min(0)
  -> 数值不能小于 0

@IsIn([...])
  -> 值必须在指定数组中
```

注意：`@IsOptional()` 的意思不是“随便传都行”，而是“不传可以；一旦传了，就要满足其他校验规则”。

## 八、创建 `UpdateCourseDto`

更新课程时，通常允许只传部分字段。

例如只改价格：

```json
{
  "price": 199
}
```

所以 `UpdateCourseDto` 可以把创建 DTO 中的字段都变成可选。

创建文件：

```txt
src/courses/dto/update-course.dto.ts
```

写入：

```ts
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateCourseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: 'draft' | 'published';
}
```

你会发现它和 `CreateCourseDto` 有重复。

真实项目中可以使用 `@nestjs/mapped-types` 的 `PartialType` 来减少重复：

```ts
export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
```

但这一节先手写一遍，目的是让你看清楚每个字段的校验规则。后面熟悉后再引入工具类型。

## 九、调整课程类型

现在 DTO 中新增了 `status` 字段，所以课程类型也可以补上。

打开：

```txt
src/courses/courses.service.ts
```

把课程类型改成：

```ts
export type CourseStatus = 'draft' | 'published';

export type Course = {
  id: number;
  title: string;
  description?: string;
  price: number;
  status: CourseStatus;
};
```

创建课程输入可以直接使用 DTO：

```ts
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
```

然后把旧的 `CreateCourseBody`、`UpdateCourseBody` 删除或停止使用。

课程数组也要加上 `status`：

```ts
private courses: Course[] = [
  {
    id: 1,
    title: 'NestJS 入门',
    description: '学习 NestJS 的 Controller、Service 和 Module',
    price: 99,
    status: 'published',
  },
  {
    id: 2,
    title: 'TypeScript 基础',
    description: '学习 TypeScript 常用类型和工程配置',
    price: 59,
    status: 'published',
  },
];
```

`create()` 方法改成：

```ts
create(input: CreateCourseDto) {
  const course: Course = {
    id: this.getNextId(),
    title: input.title,
    description: input.description,
    price: input.price,
    status: input.status ?? 'draft',
  };

  this.courses.push(course);

  return course;
}
```

`update()` 方法改成：

```ts
update(id: number, input: UpdateCourseDto) {
  const course = this.courses.find((item) => item.id === id);

  if (!course) {
    return {
      message: '课程不存在',
    };
  }

  Object.assign(course, input);

  return course;
}
```

这里用：

```ts
status: input.status ?? 'draft'
```

表示如果创建课程时没有传 `status`，默认就是草稿状态。

## 十、调整 `CoursesController`

打开：

```txt
src/courses/courses.controller.ts
```

导入 DTO：

```ts
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
```

移除旧的类型导入：

```ts
import type { CreateCourseBody, UpdateCourseBody } from './courses.service';
```

把创建接口改成：

```ts
@Post()
create(@Body() body: CreateCourseDto) {
  return this.coursesService.create(body);
}
```

把更新接口改成：

```ts
@Patch(':id')
update(@Param('id') id: string, @Body() body: UpdateCourseDto) {
  return this.coursesService.update(Number(id), body);
}
```

完整 Controller 类似这样：

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
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

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
  create(@Body() body: CreateCourseDto) {
    return this.coursesService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateCourseDto) {
    return this.coursesService.update(Number(id), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.coursesService.remove(Number(id));
  }
}
```

现在 Controller 更干净了：

```txt
Controller 不再手动从 body 中一个个取字段。
DTO 负责声明请求体结构和校验规则。
ValidationPipe 负责执行校验。
Service 负责业务处理。
```

## 十一、理解 `transform: true`

HTTP 请求传过来的数据本质上是普通 JSON 对象。

如果没有 `transform: true`，`ValidationPipe` 不会把请求体转换成 DTO 类实例。

开启后，NestJS 会尝试把请求体转换成你声明的 DTO 类型：

```ts
create(@Body() body: CreateCourseDto) {}
```

这对 `class-validator` 的装饰器校验很重要。

不过要注意：`transform: true` 不是万能的。对于复杂转换或隐式转换，仍然要谨慎处理。

当前这一节主要用它配合 DTO 校验请求体。第 6 节会继续学习参数转换，比如把路径参数 `id` 转成数字。

## 十二、测试合法请求

启动项目：

```bash
pnpm run start:dev
```

发送合法创建请求：

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "NestJS DTO 入门",
    "description": "学习 DTO 和 ValidationPipe",
    "price": 99,
    "status": "published"
  }'
```

预期返回类似：

```json
{
  "id": 3,
  "title": "NestJS DTO 入门",
  "description": "学习 DTO 和 ValidationPipe",
  "price": 99,
  "status": "published"
}
```

如果不传 `status`：

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "NestJS Pipe 基础",
    "description": "下一节会继续学习 Pipe",
    "price": 88
  }'
```

预期 `status` 默认是：

```json
"status": "draft"
```

## 十三、测试非法请求

### 1. 标题为空

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "",
    "description": "标题不能为空",
    "price": 99
  }'
```

预期返回 400，错误信息中会提示 `title` 不符合规则。

### 2. 价格为负数

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "错误价格",
    "description": "价格不能小于 0",
    "price": -1
  }'
```

预期返回 400，错误信息中会提示 `price must not be less than 0` 或类似信息。

### 3. 状态不在允许范围内

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "错误状态",
    "description": "status 只能是 draft 或 published",
    "price": 99,
    "status": "deleted"
  }'
```

预期返回 400，错误信息中会提示 `status` 必须是允许值之一。

### 4. 多传未知字段

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "多余字段测试",
    "description": "测试 forbidNonWhitelisted",
    "price": 99,
    "isAdmin": true
  }'
```

因为我们配置了：

```ts
forbidNonWhitelisted: true
```

所以预期返回 400，并提示 `isAdmin` 不应该存在。

这能防止客户端偷偷传入 DTO 没有声明的字段。

## 十四、测试更新接口

合法更新价格：

```bash
curl -X PATCH http://localhost:3000/courses/1 \
  -H "Content-Type: application/json" \
  -d '{
    "price": 199
  }'
```

预期返回更新后的课程。

非法更新状态：

```bash
curl -X PATCH http://localhost:3000/courses/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "offline"
  }'
```

预期返回 400。

非法更新标题为空：

```bash
curl -X PATCH http://localhost:3000/courses/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": ""
  }'
```

预期返回 400。

因为 `UpdateCourseDto` 中虽然 `title` 是可选的，但只要传了，就必须满足：

```ts
@IsString()
@IsNotEmpty()
@MaxLength(50)
```

## 十五、常见问题

### 1. 为什么我写了 DTO，但是非法请求没有被拦截？

优先检查是否在 `main.ts` 中启用了全局 `ValidationPipe`：

```ts
app.useGlobalPipes(new ValidationPipe());
```

如果没有 Pipe，DTO 上的装饰器不会自动执行。

### 2. 为什么 `class-validator` 装饰器不生效？

检查三点：

- 是否安装了 `class-validator` 和 `class-transformer`。
- DTO 是否写成了 `class`，而不是 `type` 或 `interface`。
- Controller 参数是否使用了 DTO class：

```ts
create(@Body() body: CreateCourseDto) {}
```

### 3. `@IsOptional()` 是不是表示字段可以传任何值？

不是。

`@IsOptional()` 只表示字段可以不传。

如果传了，仍然要满足其他校验规则。

例如：

```ts
@IsString()
@IsOptional()
description?: string;
```

表示：

```txt
description 可以不传。
如果传了，必须是字符串。
```

### 4. 为什么 `price` 传 `"99"` 可能校验失败？

因为 JSON 中：

```json
{
  "price": "99"
}
```

这里的 `price` 是字符串，不是数字。

如果你使用 `@IsInt()`，它要求值是整数。

学习阶段建议客户端传真正的数字：

```json
{
  "price": 99
}
```

后续如果需要把字符串自动转成数字，可以结合 `@Type(() => Number)` 或 Pipe 做转换。第 6 节会继续讲参数转换。

### 5. DTO 是不是实体 Entity？

不是。

DTO 描述接口输入或输出的数据结构。

Entity 描述数据库中的业务实体或数据表结构。

比如：

```txt
CreateCourseDto
  -> 客户端创建课程时允许传什么

Course Entity
  -> 数据库中课程表有什么字段
```

它们可能有相同字段，但职责不同，不建议简单混为一个东西。

## 十六、DTO 与实体对象的区别

可以用课程为例：

```txt
CreateCourseDto
  - title
  - description
  - price
  - status
```

这是创建课程时客户端可以传入的数据。

但真实数据库里的课程实体以后可能是：

```txt
Course
  - id
  - title
  - description
  - price
  - status
  - createdAt
  - updatedAt
  - teacherId
```

对比：

```txt
DTO
  -> 面向接口边界
  -> 描述请求或响应数据
  -> 关注客户端可以传什么
  -> 常用于校验

Entity
  -> 面向数据模型
  -> 描述业务对象或数据库表
  -> 关注系统内部如何保存数据
  -> 常用于 ORM 或数据库映射
```

例如客户端创建课程时不应该传 `id`：

```json
{
  "id": 999,
  "title": "伪造 ID",
  "price": 99
}
```

因为 `id` 应该由系统生成。

这就是 DTO 的价值：限制接口边界，明确客户端能传什么、不能传什么。

## 十七、本节练习任务

### 任务 1：安装校验依赖

要求：

- 安装 `class-validator`。
- 安装 `class-transformer`。
- 确认 `package.json` 中出现这两个依赖。

记录：

```txt
我执行的安装命令：
package.json 中新增的依赖：
```

### 任务 2：配置全局 `ValidationPipe`

要求：

- 修改 `src/main.ts`。
- 启用全局 `ValidationPipe`。
- 配置 `whitelist`、`forbidNonWhitelisted`、`transform`。

记录：

```txt
main.ts 中新增的代码：
三个配置项分别是什么意思：
```

### 任务 3：创建课程 DTO

要求：

- 创建 `src/courses/dto/create-course.dto.ts`。
- 创建 `src/courses/dto/update-course.dto.ts`。
- 给 `title`、`description`、`price`、`status` 添加校验规则。

记录：

```txt
CreateCourseDto 字段：
UpdateCourseDto 字段：
我使用的校验装饰器：
```

### 任务 4：改造课程接口

要求：

- `POST /courses` 使用 `CreateCourseDto`。
- `PATCH /courses/:id` 使用 `UpdateCourseDto`。
- `CoursesService` 使用 DTO 作为输入类型。
- 创建课程时没有传 `status`，默认设置为 `draft`。

记录：

```txt
Controller 修改的位置：
Service 修改的位置：
```

### 任务 5：测试非法请求

要求：

至少测试下面四种非法请求：

- `title` 为空。
- `price` 小于 0。
- `status` 不在 `draft`、`published` 中。
- 请求体包含 DTO 中不存在的字段。

记录：

```txt
非法请求 1 的响应：
非法请求 2 的响应：
非法请求 3 的响应：
非法请求 4 的响应：
```

## 十八、本节知识输出

请在学习笔记中回答下面问题：

1. DTO 的作用是什么？
2. 为什么 NestJS 中 DTO 通常写成 `class`，而不是 `type` 或 `interface`？
3. `class-validator` 和 `class-transformer` 分别负责什么？
4. `ValidationPipe` 的作用是什么？
5. `whitelist`、`forbidNonWhitelisted`、`transform` 分别解决什么问题？
6. DTO 和 Entity 有什么区别？
7. 为什么后端不能相信前端传参？

建议每个问题结合你本节改造 `POST /courses` 和 `PATCH /courses/:id` 的过程回答。

## 十九、本节验收标准

完成本节后，请确认：

- 已安装 `class-validator` 和 `class-transformer`。
- `main.ts` 已配置全局 `ValidationPipe`。
- `src/courses/dto/create-course.dto.ts` 已创建。
- `src/courses/dto/update-course.dto.ts` 已创建。
- `POST /courses` 使用 `CreateCourseDto`。
- `PATCH /courses/:id` 使用 `UpdateCourseDto`。
- 非法请求会返回 400。
- DTO 外的未知字段会被拒绝。
- 创建课程时不传 `status` 会默认设置为 `draft`。
- 你能解释 DTO、ValidationPipe、class-validator 的关系。

## 二十、下一节预告

下一节会学习 Pipe、参数转换与请求边界。

这一节我们主要校验了请求体：

```txt
POST /courses body
PATCH /courses/:id body
```

但现在还有一个问题：

```ts
@Get(':id')
findOne(@Param('id') id: string) {
  return this.coursesService.findOne(Number(id));
}
```

我们还在 Controller 里手动写：

```ts
Number(id)
```

如果用户访问：

```txt
GET /courses/abc
```

当前代码仍然可能把 `abc` 转成 `NaN` 后交给 Service。

下一节会学习：

```txt
ParseIntPipe
DefaultValuePipe
ParseBoolPipe
自定义 Pipe
```

让路径参数和查询参数也能在请求边界处被可靠处理。
