# 第 6 节：Pipe、参数转换与请求边界

## 本节目标

学完这一节，你要能做到：

- 理解 Pipe 在 NestJS 请求生命周期中的位置。
- 区分 Pipe、DTO、ValidationPipe、Middleware 的职责。
- 使用 `ParseIntPipe` 把路径参数转换成数字。
- 使用 `DefaultValuePipe` 给查询参数设置默认值。
- 使用 `ParseBoolPipe` 处理布尔查询参数。
- 使用 DTO + `class-transformer` 处理复杂查询参数。
- 实现一个简单的自定义 Pipe。
- 理解“请求边界校验”和“业务逻辑校验”的区别。

上一节我们已经用 DTO 和 `ValidationPipe` 校验了请求体：

```txt
POST /courses body
PATCH /courses/:id body
```

但当前课程接口里还有一个明显问题：

```ts
@Get(':id')
findOne(@Param('id') id: string) {
  return this.coursesService.findOne(Number(id));
}
```

这里在 Controller 中手动写了：

```ts
Number(id)
```

如果用户访问：

```txt
GET /courses/abc
```

`Number('abc')` 会得到：

```ts
NaN
```

然后 `NaN` 会继续进入 Service。

这一节要解决的问题是：

> 让路径参数、查询参数也在进入 Controller 方法前完成转换和校验。

## 一、Pipe 是什么

Pipe 是 NestJS 中专门处理“参数”的机制。

它会在 Controller 方法真正执行之前运行。

例如：

```ts
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.coursesService.findOne(id);
}
```

请求流程可以理解成：

```txt
GET /courses/1
  -> 原始路径参数 id = '1'
  -> ParseIntPipe 尝试转换
  -> 转换成功，得到 number 1
  -> 进入 findOne(id: number)
```

如果请求是：

```txt
GET /courses/abc
```

流程会变成：

```txt
GET /courses/abc
  -> 原始路径参数 id = 'abc'
  -> ParseIntPipe 尝试转换
  -> 转换失败
  -> NestJS 直接返回 400
  -> Controller 方法不会执行
```

Pipe 的核心价值是：

```txt
把错误参数挡在 Controller 方法之外。
```

## 二、Pipe 的执行时机

一个简化版请求流程是：

```txt
客户端请求
  -> Middleware
  -> Guard
  -> Interceptor 前置逻辑
  -> Pipe
  -> Controller 方法
  -> Service
  -> Interceptor 后置逻辑
  -> 响应
```

这一节你只需要先记住：

```txt
Pipe 发生在 Controller 方法执行之前；
Pipe 处理的是 Controller 方法参数。
```

例如：

```ts
findOne(@Param('id', ParseIntPipe) id: number) {}
```

`ParseIntPipe` 只处理这个 `id` 参数。

再比如：

```ts
create(@Body() body: CreateCourseDto) {}
```

全局 `ValidationPipe` 会处理这个 `body` 参数。

## 三、Pipe 和 Middleware 的区别

Middleware 更早执行，它面对的是原始请求对象。

Pipe 更靠近 Controller，它面对的是某个具体参数。

对比：

```txt
Middleware
  -> 面向整个 request / response
  -> 适合处理日志、请求 ID、跨域、通用请求头
  -> 一般不知道 Controller 参数的具体类型

Pipe
  -> 面向 @Param、@Query、@Body 等参数
  -> 适合做参数转换和参数校验
  -> 可以结合 DTO、metatype、装饰器规则
```

举例：

```txt
记录每次请求的 method、url、耗时
  -> 更适合 Middleware 或 Interceptor

要求 /courses/:id 的 id 必须是整数
  -> 更适合 Pipe

要求 page 默认是 1，并且必须是数字
  -> 更适合 Pipe

要求 POST /courses 的 title 不能为空
  -> 更适合 DTO + ValidationPipe
```

## 四、使用 `ParseIntPipe` 转换课程 ID

当前 Controller 里可能是这样：

```ts
@Get(':id')
findOne(@Param('id') id: string) {
  return this.coursesService.findOne(Number(id));
}
```

现在改成：

```ts
import { ParseIntPipe } from '@nestjs/common';
```

然后：

```ts
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.coursesService.findOne(id);
}
```

更新接口也可以改：

```ts
@Patch(':id')
update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCourseDto) {
  return this.coursesService.update(id, body);
}
```

删除接口也可以改：

```ts
@Delete(':id')
remove(@Param('id', ParseIntPipe) id: number) {
  return this.coursesService.remove(id);
}
```

这样 Controller 中就不需要手动写：

```ts
Number(id)
```

新的完整片段大概是：

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCourseDto) {
    return this.coursesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.remove(id);
  }
}
```

测试：

```bash
curl http://localhost:3000/courses/1
```

预期可以正常返回课程。

再测试：

```bash
curl http://localhost:3000/courses/abc
```

预期返回 400。

这说明非法路径参数没有进入 Service。

## 五、使用 `DefaultValuePipe` 设置分页默认值

列表接口通常需要分页：

```txt
GET /courses?page=1&limit=10
```

HTTP 查询参数默认都是字符串。

如果你写：

```ts
@Get()
findAll(@Query('page') page: string, @Query('limit') limit: string) {
  return { page, limit };
}
```

请求：

```txt
GET /courses?page=2&limit=20
```

拿到的是：

```ts
page === '2';
limit === '20';
```

注意这里是字符串，不是数字。

我们可以使用 `DefaultValuePipe` 和 `ParseIntPipe`：

```ts
import { DefaultValuePipe, ParseIntPipe, Query } from '@nestjs/common';
```

然后：

```ts
@Get()
findAll(
  @Query('keyword') keyword?: string,
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
) {
  return this.coursesService.findAll(keyword, page, limit);
}
```

这里的执行顺序可以理解成：

```txt
page 没传
  -> DefaultValuePipe 给默认值 1
  -> ParseIntPipe 转成 number

page=2
  -> DefaultValuePipe 不改值
  -> ParseIntPipe 把 '2' 转成 number 2

page=abc
  -> ParseIntPipe 转换失败
  -> 返回 400
```

此时 Service 也要接收分页参数：

```ts
findAll(keyword?: string, page = 1, limit = 10) {
  let result = this.courses;

  if (keyword) {
    result = result.filter((course) =>
      course.title.toLowerCase().includes(keyword.toLowerCase()),
    );
  }

  const start = (page - 1) * limit;
  const end = start + limit;

  return result.slice(start, end);
}
```

学习阶段先返回数组即可。后面学习统一响应时，再返回：

```ts
{
  data: [],
  page: 1,
  limit: 10,
  total: 100
}
```

## 六、使用 `ParseBoolPipe` 转换布尔参数

有时查询参数是布尔值，例如：

```txt
GET /courses?includeDraft=true
```

但 HTTP 查询参数里拿到的是字符串：

```ts
includeDraft === 'true';
```

可以使用 `ParseBoolPipe`：

```ts
import { ParseBoolPipe } from '@nestjs/common';
```

示例：

```ts
@Get()
findAll(
  @Query('includeDraft', new DefaultValuePipe(false), ParseBoolPipe)
  includeDraft: boolean,
) {
  return {
    includeDraft,
  };
}
```

效果：

```txt
GET /courses?includeDraft=true
  -> includeDraft 是 boolean true

GET /courses?includeDraft=false
  -> includeDraft 是 boolean false

GET /courses?includeDraft=yes
  -> 返回 400
```

注意：这一节不一定要把 `includeDraft` 加进项目，只需要理解这个转换场景。

## 七、使用查询 DTO 组织复杂查询参数

如果查询参数越来越多：

```txt
keyword
page
limit
status
includeDraft
```

Controller 里就会变得很长：

```ts
findAll(
  @Query('keyword') keyword?: string,
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  @Query('status') status?: string,
) {}
```

这时可以创建查询 DTO：

```txt
src/courses/dto/list-courses-query.dto.ts
```

示例：

```ts
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListCoursesQueryDto {
  @IsString()
  @IsOptional()
  keyword?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: 'draft' | 'published';
}
```

Controller 中：

```ts
@Get()
findAll(@Query() query: ListCoursesQueryDto) {
  return this.coursesService.findAll(query);
}
```

这种写法适合参数较多的列表接口。

不过本节练习可以先使用内置 Pipe 的写法，因为它更直观：

```ts
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

等你熟悉 Pipe 后，再把复杂查询抽成 DTO 会更自然。

## 八、请求边界和业务边界

请求边界处理的是：

```txt
客户端传来的东西格式对不对。
```

例如：

```txt
id 是不是整数
page 是不是整数
status 是不是 draft / published
title 是不是字符串
price 是不是非负整数
```

业务边界处理的是：

```txt
这个操作在业务上能不能做。
```

例如：

```txt
课程是否存在
课程标题是否重复
当前用户是否有权限修改课程
课程已经发布后是否还能删除
```

Pipe 更适合处理请求边界问题。

Service 更适合处理业务边界问题。

对比：

```txt
GET /courses/abc
  -> id 格式不对
  -> Pipe 直接返回 400

GET /courses/999
  -> id 格式是对的，但课程不存在
  -> Service 或后续异常处理返回 404
```

这就是请求边界和业务边界的区别。

## 九、自定义 Pipe 的基本写法

NestJS 内置 Pipe 能解决很多常见问题。

但有时你需要写自己的规则。

例如我们希望单独写一个课程状态校验 Pipe，只允许：

```txt
draft
published
```

可以创建：

```txt
src/courses/pipes/course-status.pipe.ts
```

写入：

```ts
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { CourseStatus } from '../courses.service';

@Injectable()
export class CourseStatusPipe implements PipeTransform<string, CourseStatus> {
  transform(value: string): CourseStatus {
    const allowedStatuses: CourseStatus[] = ['draft', 'published'];

    if (!allowedStatuses.includes(value as CourseStatus)) {
      throw new BadRequestException(
        `status must be one of: ${allowedStatuses.join(', ')}`,
      );
    }

    return value as CourseStatus;
  }
}
```

这里有几个关键点：

```txt
@Injectable()
  -> 让这个 Pipe 可以被 NestJS 管理

PipeTransform<string, CourseStatus>
  -> 输入是 string，输出是 CourseStatus

transform(value: string)
  -> Pipe 的核心方法

throw new BadRequestException()
  -> 参数非法时返回 400
```

然后可以在 Controller 中使用：

```ts
import { CourseStatusPipe } from './pipes/course-status.pipe';
import type { CourseStatus } from './courses.service';
```

示例接口：

```ts
@Get()
findAll(
  @Query('status', CourseStatusPipe) status?: CourseStatus,
) {
  return this.coursesService.findAllByStatus(status);
}
```

不过这个写法有一个小问题：如果 `status` 不传，Pipe 可能收到 `undefined`。

所以自定义 Pipe 可以支持可选值：

```ts
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { CourseStatus } from '../courses.service';

@Injectable()
export class CourseStatusPipe
  implements PipeTransform<string | undefined, CourseStatus | undefined>
{
  transform(value: string | undefined): CourseStatus | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }

    const allowedStatuses: CourseStatus[] = ['draft', 'published'];

    if (!allowedStatuses.includes(value as CourseStatus)) {
      throw new BadRequestException(
        `status must be one of: ${allowedStatuses.join(', ')}`,
      );
    }

    return value as CourseStatus;
  }
}
```

这样：

```txt
GET /courses
  -> status 是 undefined，可以通过

GET /courses?status=draft
  -> status 是 'draft'，可以通过

GET /courses?status=deleted
  -> 返回 400
```

## 十、把状态筛选接入课程列表

为了让自定义 Pipe 有实际使用场景，可以给课程列表增加状态筛选。

Controller：

```ts
@Get()
findAll(
  @Query('keyword') keyword?: string,
  @Query('status', CourseStatusPipe) status?: CourseStatus,
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
) {
  return this.coursesService.findAll({
    keyword,
    status,
    page,
    limit,
  });
}
```

这时 Service 的 `findAll` 可以改成接收对象：

```ts
export type FindCoursesQuery = {
  keyword?: string;
  status?: CourseStatus;
  page: number;
  limit: number;
};
```

然后：

```ts
findAll(query: FindCoursesQuery) {
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

  const start = (page - 1) * limit;
  const end = start + limit;

  return result.slice(start, end);
}
```

这样 Controller 负责请求参数转换，Service 负责课程查询逻辑。

职责更清楚：

```txt
Controller + Pipe
  -> keyword、status、page、limit 是不是合法

Service
  -> 根据合法参数筛选课程
```

## 十一、常见问题

### 1. 为什么不继续在 Controller 里写 `Number(id)`？

因为 `Number(id)` 不会自动处理错误。

```ts
Number('abc'); // NaN
```

`NaN` 仍然可能进入 Service。

`ParseIntPipe` 的好处是：

```txt
转换失败直接返回 400；
Controller 方法不会执行；
Service 不会收到错误格式的数据。
```

### 2. `ParseIntPipe` 和 `ValidationPipe` 是同一种东西吗？

它们都是 Pipe。

但职责不同：

```txt
ParseIntPipe
  -> 处理单个参数
  -> 常用于 @Param('id')、@Query('page')

ValidationPipe
  -> 常配合 DTO
  -> 校验一个对象里的多个字段
```

例如：

```ts
@Param('id', ParseIntPipe) id: number
```

处理的是一个 `id`。

```ts
@Body() body: CreateCourseDto
```

全局 `ValidationPipe` 处理的是整个请求体对象。

### 3. 有 DTO 了，还需要 `ParseIntPipe` 吗？

需要看参数复杂度。

路径参数这种简单场景：

```ts
@Param('id', ParseIntPipe) id: number
```

更直接。

复杂查询参数可以用查询 DTO：

```ts
@Query() query: ListCoursesQueryDto
```

不要死记一种写法。判断标准是：

```txt
单个简单参数
  -> 内置 Pipe 通常更清楚

多个相关参数
  -> DTO 更容易组织
```

### 4. 自定义 Pipe 和自定义装饰器有什么区别？

Pipe 处理参数值。

装饰器主要用来声明元数据或取参数。

例如：

```ts
@Query('status', CourseStatusPipe) status: CourseStatus
```

`@Query('status')` 负责从请求中取值。

`CourseStatusPipe` 负责校验和转换这个值。

### 5. 状态校验已经能用 `@IsIn()` 了，为什么还要学自定义 Pipe？

`@IsIn()` 很适合 DTO 字段，例如请求体：

```ts
@IsIn(['draft', 'published'])
status?: 'draft' | 'published';
```

自定义 Pipe 适合你想对某个参数单独封装规则时使用，例如：

```ts
@Query('status', CourseStatusPipe) status?: CourseStatus
```

学习自定义 Pipe 的目的不是替代 DTO，而是理解 NestJS 参数处理机制。

## 十二、本节练习任务

### 任务 1：使用 `ParseIntPipe` 处理课程 ID

要求：

- 修改 `src/courses/courses.controller.ts`。
- 给 `findOne`、`update`、`remove` 的 `id` 参数加上 `ParseIntPipe`。
- 删除这些方法里的 `Number(id)`。

记录：

```txt
修改的方法：
测试的合法 id：
测试的非法 id：
```

### 任务 2：给列表接口增加分页参数

要求：

- 给 `GET /courses` 增加 `page` 和 `limit`。
- 使用 `DefaultValuePipe` 设置默认值。
- 使用 `ParseIntPipe` 转换为数字。
- 在 Service 中根据 `page` 和 `limit` 返回分页后的数组。

记录：

```txt
默认 page：
默认 limit：
我测试的请求 URL：
```

### 任务 3：实现课程状态筛选

要求：

- 支持 `GET /courses?status=draft`。
- 支持 `GET /courses?status=published`。
- 非法状态返回 400。

可以选择两种方式之一：

```txt
方式 A：自定义 CourseStatusPipe
方式 B：查询 DTO + @IsIn()
```

本节建议先做方式 A，因为这一节主题是 Pipe。

记录：

```txt
我创建的 Pipe 文件：
合法 status 测试结果：
非法 status 测试结果：
```

### 任务 4：整理请求边界和业务边界

要求：

写一段笔记，区分下面两类错误：

```txt
GET /courses/abc
GET /courses/999
```

记录：

```txt
abc 为什么应该是 400：
999 为什么以后应该是 404：
```

## 十三、本节知识输出

请在学习笔记中回答：

1. Pipe 在什么时候执行？
2. Pipe 和 Middleware 有什么区别？
3. `ParseIntPipe` 解决了什么问题？
4. `DefaultValuePipe` 和 `ParseIntPipe` 连用时，各自负责什么？
5. 为什么 `Number(id)` 不如 `ParseIntPipe` 可靠？
6. 什么是请求边界？什么是业务边界？
7. 自定义 Pipe 的 `transform()` 方法负责什么？

建议结合你改造 `GET /courses/:id` 和 `GET /courses` 的过程回答。

## 十四、本节最小验收

- 新增文件：
  - `src/courses/pipes/course-status.pipe.ts`
- 修改文件：
  - `src/courses/courses.controller.ts`
  - `src/courses/courses.service.ts`
- 必须能访问的接口：
  - `GET /courses/1`
  - `GET /courses?page=1&limit=10`
  - `GET /courses?status=draft`
  - `GET /courses?status=deleted`
- 必须通过的命令：
  - `pnpm run build`
- 本课暂不要求解决的问题：
  - 查询不存在课程时返回 404。
  - 统一错误响应格式。
  - 复杂分页响应结构。

## 十五、本节验收标准

完成本节后，请确认：

- `GET /courses/1` 能正常返回课程。
- `GET /courses/abc` 返回 400。
- `PATCH /courses/1` 中的 `id` 在 Controller 中已经是 number。
- `DELETE /courses/1` 中的 `id` 在 Controller 中已经是 number。
- `GET /courses?page=1&limit=10` 可以正常返回分页后的课程数组。
- `GET /courses?page=abc` 返回 400。
- `GET /courses?status=draft` 可以筛选草稿课程。
- `GET /courses?status=published` 可以筛选已发布课程。
- `GET /courses?status=deleted` 返回 400。
- 你能解释 Pipe、DTO、ValidationPipe、Middleware 的职责区别。

## 十六、下一节预告

下一节会学习异常处理与统一错误响应。

本节解决的是：

```txt
参数格式不对
  -> 400 Bad Request
```

下一节会继续解决：

```txt
参数格式是对的，但业务对象不存在
  -> 404 Not Found
```

例如现在：

```txt
GET /courses/999
```

`999` 是合法数字，所以不应该由 `ParseIntPipe` 拦截。

但如果课程不存在，就应该返回更明确的 404。

下一节会学习：

```txt
NotFoundException
BadRequestException
Exception Filter
统一错误响应结构
```

这样接口错误会更符合真实项目习惯。
