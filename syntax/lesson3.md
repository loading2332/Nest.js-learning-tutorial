## Object.assign

### 解释

`Object.assign(target, source1, source2, ...)` 的作用是：把后面一个或多个对象的属性，复制到第一个对象 `target` 上。

它会直接修改 `target` 本身，并且最后返回这个 `target`。

在当前课程代码中：

```ts
Object.assign(course, input);
```

意思是：把 `input` 里面传进来的字段，更新到已经找到的 `course` 对象上。

如果 `input` 是：

```ts
{
  title: '新的课程标题',
  price: 199,
}
```

那么 `course` 里的 `title` 和 `price` 会被替换，其他字段保持不变。

注意：`Object.assign` 是浅拷贝。也就是说，如果属性值是对象，它只复制对象引用，不会递归复制里面的每一层。

### 示例代码

```ts
const course = {
  id: 1,
  title: 'NestJS 入门',
  description: '学习 Controller、Service 和 Module',
  price: 99,
};

const input = {
  title: 'NestJS 基础入门',
  price: 129,
};

Object.assign(course, input);

console.log(course);
// 输出：
// {
//   id: 1,
//   title: 'NestJS 基础入门',
//   description: '学习 Controller、Service 和 Module',
//   price: 129
// }
```

也可以接收多个来源对象：

```ts
const target = { a: 1 };
const source1 = { b: 2 };
const source2 = { c: 3 };

Object.assign(target, source1, source2);

console.log(target);
// 输出：{ a: 1, b: 2, c: 3 }
```

## Partial

### 解释

`Partial<T>` 是 TypeScript 提供的工具类型。

它的作用是：把某个类型 `T` 中的所有属性都变成可选属性。

比如原始类型是：

```ts
type CreateCourseBody = {
  title: string;
  description: string;
  price: number;
};
```

如果写成：

```ts
type UpdateCourseBody = Partial<CreateCourseBody>;
```

就相当于：

```ts
type UpdateCourseBody = {
  title?: string;
  description?: string;
  price?: number;
};
```

这很适合用在“更新数据”的场景。

创建课程时，通常需要传完整字段：

```txt
title、description、price 都要有
```

更新课程时，用户可能只想改一个字段：

```txt
只改 title，或者只改 price
```

所以 `UpdateCourseBody` 用 `Partial<CreateCourseBody>` 很合理。

### 示例代码

```ts
type CreateCourseBody = {
  title: string;
  description: string;
  price: number;
};

type UpdateCourseBody = Partial<CreateCourseBody>;

const createBody: CreateCourseBody = {
  title: 'NestJS 入门',
  description: '学习 NestJS 基础',
  price: 99,
};

const updateBody: UpdateCourseBody = {
  price: 129,
};

// updateBody 可以只写 price，因为 Partial 让所有字段都变成了可选字段
```

## splice

### 解释

`splice` 是数组方法，用来直接修改原数组。

常见语法是：

```ts
array.splice(start, deleteCount, item1, item2, ...)
```

参数含义：

```txt
start        从哪个下标开始操作
deleteCount  删除几个元素
item1...     可选，要插入的新元素
```

在当前课程代码中：

```ts
const [removedCourse] = this.courses.splice(index, 1);
```

意思是：

```txt
从 this.courses 的 index 位置开始，删除 1 个元素。
splice 会返回被删除的元素数组。
用 [removedCourse] 把被删除数组里的第一个元素取出来。
```

注意：`splice` 会改变原数组。如果只是想得到新数组而不修改原数组，可以考虑用 `filter`。

### 示例代码

```ts
const courses = ['NestJS', 'TypeScript', 'Vue'];

const removed = courses.splice(1, 1);

console.log(removed);
// 输出：['TypeScript']

console.log(courses);
// 输出：['NestJS', 'Vue']
```

结合解构使用：

```ts
const courses = ['NestJS', 'TypeScript', 'Vue'];

const [removedCourse] = courses.splice(1, 1);

console.log(removedCourse);
// 输出：'TypeScript'

console.log(courses);
// 输出：['NestJS', 'Vue']
```

也可以插入元素：

```ts
const courses = ['NestJS', 'Vue'];

courses.splice(1, 0, 'TypeScript');

console.log(courses);
// 输出：['NestJS', 'TypeScript', 'Vue']
```

## reduce

### 解释

`reduce` 是数组方法，用来把一个数组“归纳”为一个结果。

常见语法是：

```ts
array.reduce((accumulator, currentItem) => {
  return 新的 accumulator;
}, initialValue);
```

参数含义：

```txt
accumulator   上一次计算留下来的结果
currentItem   当前正在遍历的数组元素
initialValue  accumulator 的初始值
```

在当前课程代码中：

```ts
const maxId = this.courses.reduce((max, course) => {
  return course.id > max ? course.id : max;
}, 0);
```

意思是：从 `0` 开始，依次比较每个课程的 `id`，最后得到最大的 `id`。

然后：

```ts
return maxId + 1;
```

意思是：新课程的 id 等于当前最大 id 加 1。

### 示例代码

计算数组总和：

```ts
const numbers = [10, 20, 30];

const total = numbers.reduce((sum, current) => {
  return sum + current;
}, 0);

console.log(total);
// 输出：60
```

找出最大的课程 id：

```ts
const courses = [
  { id: 1, title: 'NestJS 入门' },
  { id: 2, title: 'TypeScript 基础' },
  { id: 5, title: 'Node.js 基础' },
];

const maxId = courses.reduce((max, course) => {
  if (course.id > max) {
    return course.id;
  }

  return max;
}, 0);

console.log(maxId);
// 输出：5
```

使用三元表达式写法：

```ts
const maxId = courses.reduce((max, course) => {
  return course.id > max ? course.id : max;
}, 0);
```

这里：

```txt
course.id > max ? course.id : max
```

意思是：

```txt
如果 course.id > max，就返回 course.id。
否则返回 max。
```

## constructor

### 解释

`constructor` 是类的构造函数。

当你使用 `new` 创建一个类的实例时，`constructor` 会自动执行。

基本结构是：

```ts
class 类名 {
  constructor(参数) {
    // 创建实例时要执行的代码
  }
}
```

你问的“括号”和“最后的 `{}`”可以这样理解：

```ts
constructor(private readonly coursesService: CoursesService) {}
```

括号 `()` 里面放的是构造函数参数：

```ts
private readonly coursesService: CoursesService
```

这表示创建 `CoursesController` 时，需要传入一个 `CoursesService`。

最后的 `{}` 是构造函数体，也就是构造函数真正执行代码的地方。

这里 `{}` 是空的，是因为 TypeScript 的参数属性语法已经帮我们自动完成了赋值。

也就是说，下面这段代码：

```ts
constructor(private readonly coursesService: CoursesService) {}
```

大致等价于：

```ts
private readonly coursesService: CoursesService;

constructor(coursesService: CoursesService) {
  this.coursesService = coursesService;
}
```

所以虽然 `{}` 里面没有写代码，但是 `private readonly coursesService: CoursesService` 这部分已经让 TypeScript 自动创建并赋值了类属性。

### 示例代码

普通 constructor：

```ts
class User {
  name: string;

  constructor(name: string) {
    this.name = name;
  }
}

const user = new User('Tom');

console.log(user.name);
// 输出：'Tom'
```

TypeScript 参数属性简写：

```ts
class User {
  constructor(private readonly name: string) {}

  getName() {
    return this.name;
  }
}

const user = new User('Tom');

console.log(user.getName());
// 输出：'Tom'
```

NestJS 中的 constructor：

```ts
import { Controller, Get } from '@nestjs/common';
import { CoursesService } from './courses.service';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  findAll() {
    return this.coursesService.findAll();
  }
}
```

这段代码的意思是：

```txt
CoursesController 需要 CoursesService。
NestJS 创建 CoursesController 时，会把 CoursesService 实例传进 constructor。
private readonly coursesService 会把这个实例保存成当前类的私有只读属性。
后面就可以通过 this.coursesService 使用它。
```
