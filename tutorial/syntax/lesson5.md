# Lesson 5 Syntax Notes

## `status?: 'draft' | 'published';` 是什么意思

## 解释

这行代码不是在给 `status` 赋值，而是在声明 `status` 的类型。

```ts
status?: 'draft' | 'published';
```

可以拆开理解：

```txt
status
  -> 字段名

?
  -> 这个字段可以不传

'draft' | 'published'
  -> 字符串字面量联合类型
  -> 这个字段如果传了，只能是 'draft' 或 'published'
```

这里的 `'draft'` 和 `'published'` 看起来像具体字符串值，但放在类型位置时，它们表示“只能取这个字符串值的类型”。

普通字符串类型是：

```ts
let status: string;
```

它表示任何字符串都可以：

```ts
status = 'draft';
status = 'published';
status = 'deleted';
status = 'hello';
```

字符串字面量类型是：

```ts
let status: 'draft';
```

它表示这个变量只能是 `'draft'`：

```ts
status = 'draft'; // 正确
status = 'published'; // 错误
```

联合类型是：

```ts
let status: 'draft' | 'published';
```

它表示这个变量只能在两个值中选一个：

```ts
status = 'draft'; // 正确
status = 'published'; // 正确
status = 'deleted'; // 错误
```

所以：

```ts
status?: 'draft' | 'published';
```

意思是：

```txt
status 可以不传；
如果传了，只能是 'draft' 或 'published'。
```

注意：这只是 TypeScript 编译阶段的类型限制。运行时要真正拦截非法请求，还需要配合 `class-validator` 的装饰器，比如 `@IsIn(['draft', 'published'])`。

## 示例代码

### 示例 1：普通字符串类型

```ts
let status: string;

status = 'draft'; // 可以
status = 'published'; // 可以
status = 'deleted'; // 也可以，因为 string 接受任意字符串
```

### 示例 2：字符串字面量联合类型

```ts
let status: 'draft' | 'published';

status = 'draft'; // 可以
status = 'published'; // 可以
status = 'deleted'; // TypeScript 报错：不能赋值给 'draft' | 'published'
```

### 示例 3：用在 DTO 中

```ts
import { IsIn, IsOptional } from 'class-validator';

export class CreateCourseDto {
  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: 'draft' | 'published';
}
```

这段代码有两层限制：

```txt
TypeScript 类型层面：
  status?: 'draft' | 'published'
  -> 写代码时只能把 status 当成 'draft' 或 'published'

运行时校验层面：
  @IsIn(['draft', 'published'])
  -> 客户端请求传入其他值时，ValidationPipe 可以返回 400
```

### 示例 4：和默认值配合

```ts
type CourseStatus = 'draft' | 'published';

type Course = {
  id: number;
  title: string;
  status: CourseStatus;
};

function createCourse(input: { title: string; status?: CourseStatus }): Course {
  return {
    id: 1,
    title: input.title,
    // 如果 input.status 没传，就使用默认值 'draft'
    status: input.status ?? 'draft',
  };
}
```

这里的 `status?: CourseStatus` 仍然表示“可以不传”。但是返回的 `Course` 中 `status: CourseStatus` 没有问号，表示最终课程对象里一定要有状态。

## 当前项目中的用法

在本项目课程 DTO 中，`status` 适合这样写：

```ts
import { IsIn, IsOptional } from 'class-validator';

export class CreateCourseDto {
  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: 'draft' | 'published';
}
```

它表达的是：

```txt
创建课程时，status 可以不传。
如果传了，只允许是 draft 或 published。
其他值，比如 deleted、offline、1，都会被校验拒绝。
```

如果不想重复写 `'draft' | 'published'`，可以先抽成类型：

```ts
export type CourseStatus = 'draft' | 'published';

export class CreateCourseDto {
  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: CourseStatus;
}
```

这样在 Service、DTO、Entity 中都可以复用同一个状态类型。

## 常见错误

### 错误 1：以为 `'draft' | 'published'` 是赋值

```ts
status?: 'draft' | 'published';
```

这不是赋值。真正赋值要用 `=`：

```ts
status = 'draft';
```

在 class 字段声明里，冒号 `:` 后面写的是类型：

```ts
字段名: 类型;
```

### 错误 2：只写 TypeScript 类型，不写运行时校验

```ts
export class CreateCourseDto {
  status?: 'draft' | 'published';
}
```

这只能约束你自己写 TypeScript 代码时的类型，不能阻止客户端发这样的请求：

```json
{
  "status": "deleted"
}
```

要让 NestJS 在运行时拒绝它，需要写：

```ts
@IsIn(['draft', 'published'])
@IsOptional()
status?: 'draft' | 'published';
```

### 错误 3：把 `?` 理解成可以传任何值

```ts
status?: 'draft' | 'published';
```

`?` 只表示“可以不传”，不表示“传什么都行”。

正确理解是：

```txt
不传 status
  -> 可以

传 status: 'draft'
  -> 可以

传 status: 'published'
  -> 可以

传 status: 'deleted'
  -> 不可以
```

## DTO 中的 `title!: string` 是什么

## 解释

当你在 DTO 中写：

```ts
export class CreateCourseDto {
  title: string;
  price: number;
}
```

TypeScript 可能会报错：

```txt
属性“title”没有初始化表达式，且未在构造函数中明确赋值。
```

原因是：`title` 和 `price` 是 class 的必填属性，但 TypeScript 只从静态代码角度看这个 class。

它看到的是：

```ts
export class CreateCourseDto {
  title: string;
  price: number;
}
```

它没有看到：

```ts
constructor() {
  this.title = 'xxx';
  this.price = 99;
}
```

所以 TypeScript 会担心：

```txt
new CreateCourseDto() 之后，title 和 price 会不会还是 undefined？
```

但是在 NestJS DTO 场景里，这些值通常不是你手动在构造函数里赋的，而是请求进来后，由 `ValidationPipe` / `class-transformer` 根据请求体创建并填充的。

因此 DTO 常见写法是：

```ts
export class CreateCourseDto {
  title!: string;
  price!: number;
}
```

这里的 `!` 叫 definite assignment assertion，可以翻译成“明确赋值断言”。

它告诉 TypeScript：

```txt
我知道这个属性现在看起来没有初始化；
但我保证它在真正使用前会被赋值；
请不要在这里报 TS2564。
```

注意：这个 `!` 不是运行时校验。它只影响 TypeScript 编译检查。

## 示例代码

### 示例 1：普通 class 中不推荐乱用 `!`

```ts
class User {
  name!: string;

  sayHello() {
    // 如果运行时 name 实际上没有值，这里仍然可能拿到 undefined
    console.log(this.name.toUpperCase());
  }
}

const user = new User();
user.sayHello(); // 运行时可能报错
```

这个例子说明：`!` 不是给属性赋值，也不是防止 undefined。它只是让 TypeScript 不报“没有初始化”的错误。

### 示例 2：普通 class 更推荐构造函数赋值

```ts
class User {
  name: string;

  constructor(name: string) {
    this.name = name;
  }
}

const user = new User('Tom');
console.log(user.name);
```

普通业务 class 如果你自己创建实例，通常应该用构造函数初始化，而不是随便写 `!`。

### 示例 3：NestJS DTO 中可以使用 `!`

```ts
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  title!: string;

  @IsInt()
  @Min(0)
  price!: number;
}
```

这个场景适合使用 `!`，因为 DTO 的属性来自 HTTP 请求体：

```json
{
  "title": "NestJS 入门",
  "price": 99
}
```

请求进入 NestJS 后，`ValidationPipe` 会根据 `CreateCourseDto` 做转换和校验。

## 当前项目中的用法

当前项目的 `CreateCourseDto` 中，必填字段可以这样写：

```ts
export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  title!: string;

  @IsInt()
  @Min(0)
  price!: number;
}
```

可选字段仍然用 `?`：

```ts
export class CreateCourseDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;

  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: 'draft' | 'published';
}
```

可以这样记：

```txt
必填 DTO 字段
  -> 用 ! 避免 class 属性初始化报错
  -> 例如 title!: string

可选 DTO 字段
  -> 用 ?
  -> 例如 description?: string

运行时是否真的合法
  -> 靠 class-validator 装饰器和 ValidationPipe
```

## 常见错误

### 错误 1：以为 `!` 会自动给默认值

```ts
title!: string;
```

这不会给 `title` 默认值。它不会变成空字符串，也不会自动变成某个请求值。

它只是在类型检查阶段告诉 TypeScript：

```txt
不要检查这个属性是否在构造函数里初始化。
```

### 错误 2：把 `!` 当成运行时安全保证

```ts
class User {
  name!: string;
}
```

如果你真的运行：

```ts
const user = new User();
console.log(user.name);
```

运行时仍然可能得到：

```txt
undefined
```

所以 `!` 要谨慎用。DTO 里可以用，是因为 NestJS 会在请求流程中填充数据，并且我们会用 `ValidationPipe` 校验。

### 错误 3：必填字段写成 `?`

```ts
title?: string;
```

如果 `title` 是创建课程必填字段，就不应该为了消除 TS2564 把它写成 `?`。

因为 `?` 的意思是：

```txt
这个字段可以没有。
```

而 `title!: string` 的意思是：

```txt
这个字段是必填的；
只是它不是在构造函数里初始化，而是由外部请求数据填充。
```
