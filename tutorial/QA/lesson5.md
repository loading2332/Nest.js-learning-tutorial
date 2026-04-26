# Q

- zod 和 DTO 是什么关系？
- `class` 编译后仍然存在于 JavaScript 运行时，为什么？结合具体代码讲讲
- validators 和 transformers 是什么关系？为什么要区分开来？
- useGlobalPipes 是啥?感觉dto出现了好多新的语法，我应该怎么理解这些语法？比如 `@IsString()` 和 `@IsNotEmpty()` 这些装饰器是怎么工作的？它们是如何在运行时进行验证的？还有 `@Type(() => Number)` 这个装饰器是做什么用的？它是如何将字符串转换为数字的？这些装饰器背后的原理是什么？我应该如何使用它们来确保我的数据是正确的？
- 你能不能给我讲讲 NestJS 中的管道（pipes）是什么吗？它们是如何工作的？为什么我们需要使用管道来验证和转换数据？还有，管道和中间件有什么区别？我应该在什么情况下使用管道，而不是中间件？最后，你能不能给我举一些实际的例子，说明如何使用管道来验证和转换数据吗？
- 开启后，NestJS 会尝试把请求体转换成你声明的 DTO 类型，那不开启的话我：后面这个类型会报错还是什么？
- @IsString()
  @IsNotEmpty()
  @MaxLength(50)装饰器的前后顺序有什么讲究吗？会影响最终结果吗？
- 为什么现在可以直接传body了？原来还是{xxx:body.xxx}

# A

## 1. Zod 和 DTO 是什么关系？

Zod 和 DTO 不是同一种东西。

DTO 是一种“数据传输对象”的设计概念，用来描述接口输入或输出的数据结构。

Zod 是一个 TypeScript 校验库，用来声明数据结构并在运行时校验数据。

也就是说：

```txt
DTO
  -> 你要描述的目标：接口数据应该长什么样

Zod
  -> 一种实现校验 DTO 思想的工具

class-validator + class DTO
  -> NestJS 官方文档里常见的 DTO 校验方案
```

在 NestJS 里，本课使用的是：

```ts
export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  title: string;
}
```

这是“class DTO + class-validator”的写法。

如果用 Zod，大概会写成：

```ts
import { z } from 'zod';

export const createCourseSchema = z.object({
  title: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  price: z.number().int().min(0),
  status: z.enum(['draft', 'published']).optional(),
});

export type CreateCourseDto = z.infer<typeof createCourseSchema>;
```

这两种方案都能表达“创建课程时请求体应该是什么结构”。

区别是：

```txt
class-validator 方案
  -> 用 class 表达 DTO
  -> 用装饰器写规则
  -> 和 NestJS ValidationPipe 配合很自然

Zod 方案
  -> 用 schema 表达数据结构
  -> 类型可以从 schema 推导出来
  -> 需要自己写 Pipe 或使用第三方封装接入 NestJS
```

学习 NestJS 官方主线时，先掌握 `class-validator + ValidationPipe` 更合适。等你理解 Pipe 之后，再学 Zod 会更顺。

## 2. `class` 编译后仍然存在于 JavaScript 运行时，为什么？

因为 JavaScript 本身就有 `class`。

TypeScript 的 `class` 编译后会变成 JavaScript 中真实存在的构造函数或 class 结构，所以运行时还能访问它。

例如 TypeScript：

```ts
class CreateCourseDto {
  title: string;
  price: number;
}

console.log(CreateCourseDto);
```

编译成 JavaScript 后，类型标注会消失，但 class 本身还在：

```js
class CreateCourseDto {}

console.log(CreateCourseDto);
```

所以运行时可以拿到 `CreateCourseDto` 这个值。

但是 `type` 不一样。

TypeScript：

```ts
type CreateCourseBody = {
  title: string;
  price: number;
};
```

编译成 JavaScript 后，整段类型声明会被删除：

```js
// 什么都没有
```

所以运行时没有 `CreateCourseBody`。

这就是为什么 NestJS 的 DTO 通常写成 class：

```ts
export class CreateCourseDto {
  @IsString()
  title: string;
}
```

`CreateCourseDto` 这个 class 在运行时存在，`@IsString()` 这类装饰器才能把校验规则挂到它上面。

你可以这样理解：

```txt
type/interface
  -> 给 TypeScript 编译器看的
  -> 运行时消失

class
  -> JavaScript 运行时也存在
  -> 可以被 NestJS、class-validator、class-transformer 使用
```

## 3. validators 和 transformers 是什么关系？为什么要区分开来？

Validator 负责“判断对不对”。

Transformer 负责“转换成什么”。

它们处理的是两个不同问题。

例如客户端传来：

```json
{
  "price": "99"
}
```

这里的 `price` 是字符串。

如果你的 DTO 是：

```ts
export class CreateCourseDto {
  @IsInt()
  price: number;
}
```

校验器会问：

```txt
price 是整数吗？
```

但在校验之前，转换器可能会先做：

```txt
"99" -> 99
```

如果转换成功，再校验：

```txt
99 是整数吗？是。
```

所以：

```txt
class-transformer
  -> 把 plain object 转成 class instance
  -> 也可以把字段值转成指定类型

class-validator
  -> 读取 DTO 上的校验规则
  -> 判断字段是否符合规则
```

为什么要区分？

因为“转换”和“校验”的职责不同。

举例：

```txt
输入："99"

转换阶段：
  "99" 能不能变成数字 99？

校验阶段：
  99 是不是整数？
  99 是否 >= 0？
```

再比如：

```txt
输入："abc"

转换阶段：
  "abc" 转 Number 会得到 NaN

校验阶段：
  NaN 不是合法整数，校验失败
```

区分开来以后，代码职责更清楚，也更容易定位问题：

```txt
数据格式不对
  -> validator 处理

数据需要从字符串变成数字、日期、类实例
  -> transformer 处理
```

## 4. `useGlobalPipes` 是什么？DTO 里的装饰器是怎么工作的？

`useGlobalPipes` 是 NestJS 应用级配置，用来给所有接口统一挂载 Pipe。

例如：

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

意思是：

```txt
所有 Controller 的参数，在进入方法之前，都先经过 ValidationPipe。
```

请求流程可以理解成：

```txt
POST /courses
  -> NestJS 找到 CoursesController.create()
  -> 发现参数是 @Body() body: CreateCourseDto
  -> 请求体先进入 ValidationPipe
  -> ValidationPipe 根据 CreateCourseDto 做转换和校验
  -> 校验通过，才执行 create()
  -> 校验失败，直接返回 400
```

### `@IsString()`、`@IsNotEmpty()` 是怎么工作的？

它们是装饰器。

例如：

```ts
export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  title: string;
}
```

你可以把它理解成：

```txt
给 CreateCourseDto.title 这个字段登记两条规则：

1. 必须是字符串
2. 不能为空
```

装饰器执行时，会把这些规则保存到 class-validator 的元数据存储中。

运行时 `ValidationPipe` 做的大致事情是：

```txt
1. 拿到请求体 plain object
2. 看到 Controller 参数类型是 CreateCourseDto
3. 把请求体转换成 CreateCourseDto 实例
4. 调用 class-validator
5. class-validator 读取 CreateCourseDto 上的装饰器规则
6. 逐个字段校验
7. 有错误就抛出 BadRequestException
```

伪代码可以这样看：

```ts
const body = {
  title: '',
  price: 99,
};

const dto = plainToInstance(CreateCourseDto, body);
const errors = await validate(dto);

if (errors.length > 0) {
  throw new BadRequestException(errors);
}
```

真实实现更复杂，但核心思想就是这样。

### `@Type(() => Number)` 是什么？

`@Type(() => Number)` 来自 `class-transformer`，用于告诉转换器：

```txt
这个字段应该按 Number 类型转换。
```

示例：

```ts
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class QueryCourseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number;
}
```

如果请求是：

```txt
GET /courses?page=2
```

查询参数里的 `page` 默认是字符串：

```ts
{
  page: '2';
}
```

有 `@Type(() => Number)` 后，转换阶段会把它变成：

```ts
{
  page: 2;
}
```

然后 `@IsInt()` 再校验它是不是整数。

注意：`@Type(() => Number)` 不是校验器，它只是转换器。

所以通常要搭配 validator 使用：

```ts
@Type(() => Number)
@IsInt()
@Min(1)
page: number;
```

不要只写：

```ts
@Type(() => Number)
page: number;
```

因为这样只是尝试转换，没有约束合法范围。

### 应该怎么使用这些装饰器？

原则是：

```txt
先想清楚字段规则，再选择装饰器。
```

例如课程标题：

```ts
@IsString()
@IsNotEmpty()
@MaxLength(50)
title: string;
```

价格：

```ts
@IsInt()
@Min(0)
price: number;
```

可选描述：

```ts
@IsString()
@MaxLength(200)
@IsOptional()
description?: string;
```

状态枚举：

```ts
@IsIn(['draft', 'published'])
@IsOptional()
status?: 'draft' | 'published';
```

查询页码：

```ts
@Type(() => Number)
@IsInt()
@Min(1)
page: number;
```

不要把 DTO 当成“类型声明文件”，而要把它当成接口边界的规则表。

## 5. NestJS 中的 Pipe 是什么？为什么用 Pipe 做验证和转换？

Pipe 是 NestJS 中专门处理“参数”的机制。

它会在 Controller 方法执行之前运行。

例如：

```ts
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.coursesService.findOne(id);
}
```

请求：

```txt
GET /courses/1
```

执行流程：

```txt
原始参数 id = '1'
  -> ParseIntPipe
  -> 转成数字 1
  -> 进入 findOne(id: number)
```

如果请求：

```txt
GET /courses/abc
```

`ParseIntPipe` 转换失败，会直接返回 400，不会进入 Controller 方法。

### Pipe 的主要职责

Pipe 常做两类事：

```txt
1. 转换
   -> 把字符串参数转换成 number、boolean、DTO 实例等

2. 校验
   -> 判断参数是否合法，不合法直接抛错
```

本课的 `ValidationPipe` 就是一个 Pipe：

```ts
app.useGlobalPipes(new ValidationPipe());
```

它负责根据 DTO 校验 `@Body()`、`@Query()`、`@Param()` 等参数。

### Pipe 和中间件有什么区别？

中间件 Middleware 更靠前，处理的是原始请求和响应对象。

Pipe 更靠近 Controller，处理的是 Controller 方法参数。

对比：

```txt
Middleware
  -> 位置更早
  -> 面向 request / response
  -> 适合日志、请求 ID、跨域、粗粒度预处理
  -> 通常不知道具体 Controller 参数类型

Pipe
  -> 位置更接近 Controller
  -> 面向 @Param、@Query、@Body 等参数
  -> 适合参数转换和参数校验
  -> 能结合 DTO 类型和装饰器规则
```

比如记录每个请求的路径和耗时，适合 Middleware 或 Interceptor。

比如校验 `price` 必须大于 0，适合 Pipe。

### 什么时候用 Pipe，而不是 Middleware？

当你的逻辑和“某个接口参数”有关时，用 Pipe。

例如：

```txt
路径参数 id 必须是整数
查询参数 page 必须 >= 1
请求体 title 不能为空
请求体 status 只能是 draft / published
```

这些都应该用 Pipe。

当你的逻辑和“整个请求”有关，且不依赖具体 Controller 参数时，可以考虑 Middleware。

例如：

```txt
给请求添加 requestId
记录原始请求日志
处理某些通用请求头
```

### Pipe 实际例子 1：转换路径 ID

```ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';

@Controller('courses')
export class CoursesController {
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.findOne(id);
  }
}
```

效果：

```txt
GET /courses/1
  -> id 是 number 1

GET /courses/abc
  -> 返回 400
```

### Pipe 实际例子 2：给查询参数设置默认值

```ts
import { DefaultValuePipe, ParseIntPipe, Query } from '@nestjs/common';

@Get()
findAll(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
) {
  return { page, limit };
}
```

请求：

```txt
GET /courses
```

得到：

```json
{
  "page": 1,
  "limit": 10
}
```

请求：

```txt
GET /courses?page=2&limit=20
```

得到：

```json
{
  "page": 2,
  "limit": 20
}
```

### Pipe 实际例子 3：使用 DTO 校验请求体

```ts
export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsInt()
  @Min(0)
  price: number;
}
```

```ts
@Post()
create(@Body() body: CreateCourseDto) {
  return this.coursesService.create(body);
}
```

配合全局：

```ts
app.useGlobalPipes(new ValidationPipe());
```

效果：

```txt
title 为空
  -> 400

price 小于 0
  -> 400

校验通过
  -> 执行 Controller 方法
```

## 6. `transform: true` 不开启的话，类型会报错吗？

一般不会因为这行类型标注本身报错。

例如：

```ts
@Post()
create(@Body() body: CreateCourseDto) {
  console.log(body instanceof CreateCourseDto);
  return this.coursesService.create(body);
}
```

如果没有开启：

```ts
transform: true;
```

运行时的 `body` 通常仍然是普通 JavaScript 对象：

```ts
{
  title: 'NestJS',
  price: 99
}
```

它不是 `CreateCourseDto` 的实例。

所以：

```ts
body instanceof CreateCourseDto;
```

通常会是：

```ts
false;
```

但 TypeScript 在编译阶段看到：

```ts
body: CreateCourseDto;
```

仍然会把它当成 `CreateCourseDto` 类型来做类型提示。

这就是关键区别：

```txt
TypeScript 类型标注
  -> 编译阶段提示
  -> 不等于运行时真的转换成这个类

transform: true
  -> 运行时尝试把 plain object 转成 DTO class instance
```

不开启 `transform` 时，可能出现的问题是：

```txt
1. body 不是 DTO 实例
2. 部分依赖 class instance 的转换能力不可用
3. 查询参数、路径参数不会自动按目标类型转换
4. @Type(() => Number) 这类转换装饰器不会按预期发挥作用
```

不过要注意：`class-validator` 在 NestJS 的 `ValidationPipe` 中仍然可以基于 DTO metatype 做校验。也就是说，很多基础校验即使没有 `transform: true` 也可能生效。

但是本课程建议开启：

```ts
transform: true;
```

原因是学习阶段你需要明确理解：

```txt
请求来的普通对象
  -> 转成 DTO 实例
  -> 再校验
  -> 校验通过后进入 Controller
```

再看一个查询参数例子：

```ts
export class ListCourseQueryDto {
  @Type(() => Number)
  @IsInt()
  page: number;
}
```

```ts
@Get()
findAll(@Query() query: ListCourseQueryDto) {
  console.log(typeof query.page);
}
```

请求：

```txt
GET /courses?page=2
```

如果开启 `transform: true`，并且使用 `@Type(() => Number)`，`query.page` 更可能是数字：

```txt
number
```

如果不开启，`query.page` 通常还是字符串：

```txt
string
```

所以不开启 `transform` 不一定会直接报错，但会让“你写的 DTO 类型”和“运行时拿到的数据”更容易不一致。

## 7. `@IsString()`、`@IsNotEmpty()`、`@MaxLength(50)` 的顺序有讲究吗？

短答案：大多数情况下，顺序不影响最终“是否通过校验”的结果。

例如下面两种写法，表达的约束基本一样：

```ts
export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  title: string;
}
```

```ts
export class CreateCourseDto {
  @MaxLength(50)
  @IsNotEmpty()
  @IsString()
  title: string;
}
```

它们都会给 `title` 注册三条校验规则：

```txt
1. 必须是字符串
2. 不能为空
3. 长度不能超过 50
```

`class-validator` 在运行时会读取这些规则，并对同一个字段执行校验。只要 `title` 不满足其中任意一条规则，整体校验就会失败，`ValidationPipe` 就会返回 400。

所以你可以先把装饰器理解成：

```txt
不是一行一行立即执行校验，
而是先把规则登记到 DTO 字段上，
等请求进来时再统一校验。
```

### 为什么代码里通常还是会按某种顺序写？

虽然最终校验结果通常不受影响，但为了可读性，建议按照“从基础类型到业务限制”的顺序写：

```ts
export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  title: string;
}
```

这个顺序读起来像一句话：

```txt
title 必须是字符串，不能为空，最长 50 个字符。
```

对数字字段也可以这样写：

```ts
export class CreateCourseDto {
  @IsInt()
  @Min(0)
  price: number;
}
```

读起来就是：

```txt
price 必须是整数，并且不能小于 0。
```

### `@IsOptional()` 要特别注意

`@IsOptional()` 的语义比较特殊。它表示：

```txt
如果这个字段是 null 或 undefined，就跳过这个字段后面的校验。
如果这个字段传了值，就继续检查其他规则。
```

所以在写可选字段时，推荐把它放在同一组装饰器里，并保持团队统一风格：

```ts
export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  title?: string;
}
```

或者像本课示例那样写成：

```ts
export class UpdateCourseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @IsOptional()
  title?: string;
}
```

对 `class-validator` 来说，常见场景下这两种都能表达“可以不传；传了就必须是非空字符串且最多 50 个字符”。学习阶段你更需要记住它的含义，而不是纠结它一定要放第几行。

### 当前项目里的建议写法

本课完整 DTO 建议写成这样：

```ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  title: string;
}
```

这样排序的好处是：

```txt
@IsString()
  -> 先说明基础类型

@IsNotEmpty()
  -> 再说明必填且不能为空

@MaxLength(50)
  -> 最后说明字符串长度限制
```

常见误区是以为：

```txt
装饰器写在上面，就一定先校验；
写在下面，就一定后校验。
```

学习 NestJS DTO 时，不要先把重点放在“执行顺序”上，而要先看这个字段最终有哪些规则。对 `title` 来说，你真正关心的是：

```txt
title 是否是字符串？
title 是否非空？
title 是否没有超过 50 个字符？
```

只要这些规则都写上了，`ValidationPipe` 就能在请求进入 Controller 前帮你拦截错误数据。

## 8. 为什么现在可以直接传 `body` 了？原来还是 `{ xxx: body.xxx }`

短答案：因为现在 `body` 的结构已经被 DTO 明确约束了，而且 `CoursesService.create()` 的参数也改成接收 `CreateCourseDto` 了。

原来可能是这种写法：

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

这样写的原因是：Controller 不完全信任外部传来的 `body`，所以手动挑出 Service 需要的字段。

现在改成：

```ts
@Post()
create(@Body() body: CreateCourseDto) {
  return this.coursesService.create(body);
}
```

能这样写，是因为做了三件事：

```txt
1. DTO 声明了创建课程允许有哪些字段
2. ValidationPipe 会在进入 Controller 前校验 body
3. CoursesService.create(input: CreateCourseDto) 本身就接收这个结构
```

也就是说，现在 `body` 已经不再是“随便来的一个对象”，而是经过请求边界处理后的输入对象。

当前项目中的 Service 是这样接收的：

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

所以 Controller 可以直接转交：

```ts
return this.coursesService.create(body);
```

### 这是不是 NestJS 自动帮 Service 映射了？

不是。

NestJS 只负责把请求体注入到 Controller 参数：

```ts
@Body() body: CreateCourseDto
```

至于你把 `body` 原样传给 Service，还是手动挑字段传给 Service，是你自己的代码决定的。

例如你仍然可以这样写：

```ts
@Post()
create(@Body() body: CreateCourseDto) {
  return this.coursesService.create({
    title: body.title,
    description: body.description,
    price: body.price,
    status: body.status,
  });
}
```

这也可以。

只是当前 `CreateCourseDto` 和 `create()` 方法需要的输入结构一致，所以直接传 `body` 更简洁。

### 什么时候不能直接传 `body`？

如果 Service 需要的结构和接口请求体不一样，就不要直接传。

例如请求体是：

```json
{
  "title": "NestJS 入门",
  "price": 99
}
```

但 Service 需要额外字段：

```ts
{
  title: string;
  price: number;
  teacherId: number;
}
```

那 Controller 或更合适的业务层就需要组装：

```ts
@Post()
create(@Body() body: CreateCourseDto) {
  return this.coursesService.create({
    ...body,
    teacherId: 1,
  });
}
```

再比如你不希望某些请求字段直接进入 Service，也可以手动挑字段：

```ts
@Post()
create(@Body() body: CreateCourseDto) {
  return this.coursesService.create({
    title: body.title,
    price: body.price,
    status: body.status ?? 'draft',
  });
}
```

### 怎么判断该不该直接传？

可以用这个标准：

```txt
如果 Controller 接收到的 DTO
和 Service 方法需要的 input
语义一致、字段一致
  -> 可以直接传 body

如果 Service 需要额外字段、隐藏字段、当前用户信息、数据库派生字段
或者需要重新组织数据
  -> 不要直接传，应该先组装 input
```

当前 lesson5 里直接传 `body` 的目的，是让你看到职责分工：

```txt
DTO
  -> 描述和校验请求体

Controller
  -> 接收请求，把合法输入交给 Service

Service
  -> 创建课程对象，处理默认值和业务逻辑
```

这里的关键不是“以后都要直接传 body”，而是：

```txt
当 DTO 已经清楚表达输入结构，并且 Service 接收的就是这个输入结构时，Controller 不需要重复拆字段。
```

## 小结

这一课可以用一条主线串起来：

```txt
DTO class
  -> 描述接口参数结构

装饰器
  -> 把校验规则挂到 DTO class 上

class-transformer
  -> 把普通请求对象转换成 DTO 实例，也能做字段类型转换

class-validator
  -> 读取 DTO 上的规则并校验

ValidationPipe
  -> 把 transformer 和 validator 接入 NestJS 请求流程

useGlobalPipes
  -> 让所有接口统一使用这些 Pipe
```

你现在不需要一次记住所有装饰器。更重要的是先形成判断：

```txt
只要是客户端传进来的参数，都要在请求边界做转换和校验。
```
