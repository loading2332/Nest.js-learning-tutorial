# Lesson 6 Syntax Notes

# Q

1. 为什么要 new DefaultValuePipe(10) 呢？直接写 DefaultValuePipe(10) 不行吗？
2. slice 和 splice 的区别
3. implements 是什么？
4. PipeTransform 和 Transform 的区别是什么？
5. TypeScript 有时候可以不用写类型，有时候要写类型，现在有点搞不清了
6. as 是什么
7. BadRequestException 为什么要 new
8. | 是什么
9. const { keyword, status, page, limit } = query; 为什么成立？不是部分是可选参数吗？万一没有传入怎么办

# A

## 1. 为什么要 `new DefaultValuePipe(10)`

## 解释

`DefaultValuePipe` 是一个 class。

在 JavaScript / TypeScript 中，class 通常要用 `new` 创建实例：

```ts
new DefaultValuePipe(10)
```

这里的意思是：

```txt
创建一个 DefaultValuePipe 实例，并把默认值 10 传进去。
```

不能直接写：

```ts
DefaultValuePipe(10)
```

因为 `DefaultValuePipe` 不是普通函数，而是 class。class 不能像函数一样直接调用。

## 示例代码

```ts
class User {
  constructor(public name: string) {}
}

const user = new User('Tom'); // 正确

// const wrong = User('Tom'); // 错误：class 不能直接当函数调用
```

## 当前项目中的用法

```ts
@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
```

执行顺序可以理解为：

```txt
limit 没传
  -> DefaultValuePipe 给默认值 10
  -> ParseIntPipe 转成 number

limit=20
  -> DefaultValuePipe 不改
  -> ParseIntPipe 把 '20' 转成 20
```

注意：`ParseIntPipe` 这里没有 `new` 也可以，因为 NestJS 支持直接传 Pipe 类，让框架帮你实例化。

```ts
@Query('limit', new DefaultValuePipe(10), ParseIntPipe)
```

这里混合了两种写法：

```txt
new DefaultValuePipe(10)
  -> 我自己创建 Pipe 实例，因为要传默认值 10

ParseIntPipe
  -> 交给 NestJS 创建实例，因为不需要额外参数
```

## 常见错误

```ts
@Query('limit', DefaultValuePipe(10), ParseIntPipe)
```

这是错误写法。`DefaultValuePipe` 是 class，不是普通函数。

## 2. `slice` 和 `splice` 的区别

## 解释

`slice` 和 `splice` 都是数组方法，但区别很大：

```txt
slice
  -> 截取数组的一部分
  -> 不修改原数组
  -> 返回新数组

splice
  -> 删除、替换、插入数组元素
  -> 会修改原数组
  -> 返回被删除的元素数组
```

## 示例代码

```ts
const arr = [1, 2, 3, 4, 5];

const part = arr.slice(1, 3);

console.log(part); // [2, 3]
console.log(arr); // [1, 2, 3, 4, 5]，原数组没变
```

```ts
const arr = [1, 2, 3, 4, 5];

const removed = arr.splice(1, 2);

console.log(removed); // [2, 3]
console.log(arr); // [1, 4, 5]，原数组被修改了
```

## 当前项目中的用法

分页时用 `slice`：

```ts
const start = (page - 1) * limit;
const end = start + limit;

return result.slice(start, end);
```

这里不能用 `splice`，因为分页只是“取一部分课程返回”，不应该删除内存数组里的课程。

删除课程时用 `splice`：

```ts
const [removedCourse] = this.courses.splice(index, 1);

return removedCourse;
```

这里要真的从 `this.courses` 里删除课程，所以用 `splice`。

## 常见错误

```ts
return result.splice(start, limit);
```

这会修改 `result` 指向的数组。如果 `result` 是 `this.courses`，就可能把课程数据删掉。分页应该用 `slice`。

## 3. `implements` 是什么

## 解释

`implements` 表示：

```txt
这个 class 承诺实现某个接口规定的结构。
```

例如：

```ts
class CourseStatusPipe implements PipeTransform {}
```

意思是：

```txt
CourseStatusPipe 这个类要符合 PipeTransform 的要求。
```

`PipeTransform` 要求 class 里有一个 `transform()` 方法，所以你必须写：

```ts
transform(value: string) {
  return value;
}
```

## 示例代码

```ts
interface CanRun {
  run(): void;
}

class Dog implements CanRun {
  run() {
    console.log('running');
  }
}
```

如果漏掉 `run()`：

```ts
class Dog implements CanRun {
  // TypeScript 会报错：缺少 run 方法
}
```

## 当前项目中的用法

```ts
export class CourseStatusPipe implements PipeTransform<
  string | undefined,
  CourseStatus | undefined
> {
  transform(value: string | undefined): CourseStatus | undefined {
    // ...
  }
}
```

这里表示：

```txt
这个 Pipe 输入 string | undefined
输出 CourseStatus | undefined
并且必须实现 transform 方法
```

## 常见错误

`implements` 只在 TypeScript 编译阶段检查结构，不会在运行时自动生成方法。

## 4. `PipeTransform` 和 `Transform` 的区别

## 解释

这两个名字很像，但不是同一个东西。

```txt
PipeTransform
  -> NestJS 里的接口
  -> 用来定义自定义 Pipe 的结构
  -> 需要实现 transform(value) 方法

@Transform()
  -> class-transformer 里的装饰器
  -> 用在 DTO 字段上
  -> 用来转换对象字段的值
```

当前项目用的是：

```ts
import { PipeTransform } from '@nestjs/common';
```

它是 NestJS Pipe 机制的一部分。

## 示例代码

NestJS 自定义 Pipe：

```ts
import { PipeTransform } from '@nestjs/common';

class TrimPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    return value.trim();
  }
}
```

class-transformer 字段转换：

```ts
import { Transform } from 'class-transformer';

class QueryDto {
  @Transform(({ value }) => value.trim())
  keyword: string;
}
```

## 当前项目中的用法

```ts
export class CourseStatusPipe implements PipeTransform<
  string | undefined,
  CourseStatus | undefined
> {
  transform(value: string | undefined): CourseStatus | undefined {
    // 校验 status
  }
}
```

这里的 `transform` 是你实现的普通方法名，不是 `class-transformer` 的 `@Transform()` 装饰器。

## 常见错误

不要把这两个混在一起：

```ts
PipeTransform // NestJS 接口
Transform // class-transformer 装饰器
```

## 5. TypeScript 什么时候可以不写类型，什么时候要写类型

## 解释

TypeScript 有类型推断能力，所以有些地方可以不写类型。

例如：

```ts
const page = 1;
```

TypeScript 能推断：

```txt
page 是 number
```

但有些位置最好明确写类型，尤其是函数参数、公共方法、DTO、Service 输入输出。

## 示例代码

可以不写：

```ts
const limit = 10; // TypeScript 能推断 number

const course = {
  title: 'NestJS',
  price: 99,
}; // TypeScript 能推断对象结构
```

建议写：

```ts
function findOne(id: number) {
  return id;
}
```

DTO 必须写清楚：

```ts
export class CreateCourseDto {
  title!: string;
  price!: number;
}
```

## 当前项目中的用法

Controller 参数要写清楚：

```ts
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

因为这里的 `page` 来自 HTTP 请求，原始值是字符串。写成 `number` 是告诉代码读者和 TypeScript：

```txt
经过 Pipe 后，Controller 里拿到的是 number。
```

Service 输入类型也建议写清楚：

```ts
export type FindCourseQuery = {
  keyword?: string;
  status?: CourseStatus;
  page: number;
  limit: number;
};

findAll(query: FindCourseQuery) {}
```

这样 Controller 调用错时，TypeScript 能发现问题。你刚遇到的错误：

```txt
Expected 1 arguments, but got 4.
```

就是类型帮你发现 Controller 和 Service 参数不一致。

## 常见规则

```txt
局部变量，右边很明显
  -> 可以少写类型

函数参数
  -> 建议写类型

函数返回值
  -> 简单时可省略，公共 API 可写

DTO 字段
  -> 必须写类型

Service 方法入参
  -> 建议写类型

类型不明显或你希望约束别人怎么调用
  -> 写类型
```

## 6. `as` 是什么

## 解释

`as` 是 TypeScript 的类型断言。

它的意思是：

```txt
我告诉 TypeScript：请把这个值当成某个类型看待。
```

例如：

```ts
value as CourseStatus
```

意思是：

```txt
请把 value 当成 CourseStatus 类型。
```

注意：`as` 不会改变运行时的值，也不会自动校验。

## 示例代码

```ts
const value = 'draft';

const status = value as 'draft' | 'published';
```

这里运行时的 `value` 仍然是字符串 `'draft'`。`as` 只是影响 TypeScript 的类型判断。

危险例子：

```ts
const value = 'deleted';

const status = value as 'draft' | 'published';

console.log(status); // 运行时仍然是 'deleted'
```

所以 `as` 不能替代校验。

## 当前项目中的用法

```ts
if (!allowedStatuses.includes(value as CourseStatus)) {
  throw new BadRequestException(allowedStatuses.join(','));
}

return value as CourseStatus;
```

这里先用 `includes` 做运行时校验：

```txt
value 必须是 draft 或 published
```

校验通过后，再用：

```ts
return value as CourseStatus;
```

告诉 TypeScript：

```txt
这个 value 已经检查过了，可以当 CourseStatus 返回。
```

## 常见错误

不要用 `as` 欺骗 TypeScript：

```ts
const status = 'deleted' as CourseStatus;
```

这不会让 `'deleted'` 变合法。运行时它还是 `'deleted'`。

## 7. `BadRequestException` 为什么要 `new`

## 解释

`BadRequestException` 是 NestJS 提供的异常 class。

class 要创建实例，所以要写：

```ts
throw new BadRequestException('错误信息');
```

`new BadRequestException(...)` 会创建一个异常对象。`throw` 把这个异常抛出去，NestJS 会把它转换成 HTTP 400 响应。

## 示例代码

```ts
class MyError extends Error {
  constructor(message: string) {
    super(message);
  }
}

throw new MyError('出错了');
```

NestJS 里：

```ts
import { BadRequestException } from '@nestjs/common';

throw new BadRequestException('status must be draft or published');
```

## 当前项目中的用法

```ts
if (!allowedStatuses.includes(value as CourseStatus)) {
  throw new BadRequestException(allowedStatuses.join(','));
}
```

当用户访问：

```txt
GET /courses?status=deleted
```

`CourseStatusPipe` 会抛出 `BadRequestException`，NestJS 返回 400。

## 常见错误

```ts
throw BadRequestException('error');
```

这是错误写法，因为 `BadRequestException` 是 class，不是普通函数。

## 8. `|` 是什么

## 解释

在 TypeScript 类型里，`|` 表示联合类型。

意思是：

```txt
这个值可以是 A，也可以是 B。
```

例如：

```ts
type CourseStatus = 'draft' | 'published';
```

表示：

```txt
CourseStatus 只能是 'draft' 或 'published'
```

## 示例代码

```ts
let id: string | number;

id = '1'; // 可以
id = 1; // 可以
id = true; // 错误
```

```ts
type CourseStatus = 'draft' | 'published';

let status: CourseStatus;

status = 'draft'; // 可以
status = 'published'; // 可以
status = 'deleted'; // 错误
```

## 当前项目中的用法

```ts
export type CourseStatus = 'draft' | 'published';
```

还有：

```ts
PipeTransform<string | undefined, CourseStatus | undefined>
```

意思是：

```txt
输入可能是 string，也可能是 undefined
输出可能是 CourseStatus，也可能是 undefined
```

为什么要允许 `undefined`？

因为 `status` 是查询参数，用户可以不传：

```txt
GET /courses
```

这时 `status` 就是 `undefined`。

## 常见错误

`|` 在类型里不是“或者执行某段代码”，它只是描述类型范围。

## 9. `const { keyword, status, page, limit } = query;` 为什么成立

## 解释

这是对象解构。

```ts
const { keyword, status, page, limit } = query;
```

等价于：

```ts
const keyword = query.keyword;
const status = query.status;
const page = query.page;
const limit = query.limit;
```

如果某个字段没传，对应变量就是 `undefined`，不会因为解构本身报错。

## 示例代码

```ts
const query = {
  page: 1,
  limit: 10,
};

const { keyword, status, page, limit } = query;

console.log(keyword); // undefined
console.log(status); // undefined
console.log(page); // 1
console.log(limit); // 10
```

这不会报错，因为 `query` 这个对象本身存在。

真正会报错的是：

```ts
const query = undefined;

const { page } = query; // 运行时报错
```

## 当前项目中的用法

类型定义是：

```ts
export type FindCourseQuery = {
  keyword?: string;
  status?: CourseStatus;
  page: number;
  limit: number;
};
```

这里：

```txt
keyword?
  -> 可以没有，解构后可能是 undefined

status?
  -> 可以没有，解构后可能是 undefined

page
  -> 必须有

limit
  -> 必须有
```

Controller 调用时传入：

```ts
return this.coursesService.findAll({
  page,
  limit,
  keyword,
  status,
});
```

因为 `page` 和 `limit` 有 `DefaultValuePipe`：

```ts
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
```

所以它们总会有默认数字。

`keyword` 和 `status` 没传时就是 `undefined`，Service 里用 `if` 判断：

```ts
if (keyword) {
  result = result.filter((course) =>
    course.title.toLowerCase().includes(keyword.toLowerCase()),
  );
}

if (status) {
  result = result.filter((course) => course.status === status);
}
```

没传就不筛选。

## 常见错误

对象解构没问题，但前提是被解构的对象本身不是 `undefined`。

安全写法示例：

```ts
function findAll(query: FindCourseQuery) {
  const { keyword, status, page, limit } = query;
}
```

这里 `query` 是必填参数，所以可以直接解构。
