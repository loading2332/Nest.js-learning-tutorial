# Lesson 11 Syntax Notes

# Q

1. extends是什么	
2. super({ adapter });什么意思
3. async onModuleInit() 为什么要async，什么时候用async
4. promise.all是什么？为什么要用上promise
5. Skip,where,data是约定好的变量名吗？都要传入对象吗？course属性就是course列吗？
6. ??和||的区别是什么

# A

## 1. `extends` 是什么？

## 解释

`extends` 表示“继承”。

一个 class 可以继承另一个 class，获得父类的方法和能力。

第 11 课里：

```ts
export class PrismaService extends PrismaClient {}
```

意思是：

```txt
PrismaService 继承 PrismaClient。
PrismaService 拥有 PrismaClient 的能力。
```

所以 `PrismaService` 里可以使用：

```ts
this.course.findMany();
this.course.create();
this.$connect();
this.$disconnect();
```

因为这些能力来自 `PrismaClient`。

## 示例代码

```ts
class Animal {
  eat() {
    console.log('eating');
  }
}

class Dog extends Animal {
  bark() {
    console.log('wang');
  }
}

const dog = new Dog();

dog.eat(); // 来自 Animal
dog.bark(); // Dog 自己的方法
```

当前项目中的用法：

```ts
import { PrismaClient } from '../generated/client';

export class PrismaService extends PrismaClient {
  // PrismaService 继承 PrismaClient 后，就能作为 Nest Provider 注入
}
```

一句话：

```txt
extends 让一个类继承另一个类的能力。
```

## 2. `super({ adapter });` 是什么意思？

## 解释

`super()` 用在继承关系中，表示调用父类的构造函数。

第 11 课里：

```ts
export class PrismaService extends PrismaClient {
  constructor(configService: ConfigService) {
    const adapter = new PrismaPg({ connectionString });

    super({
      adapter,
    });
  }
}
```

因为 `PrismaService` 继承了 `PrismaClient`：

```ts
PrismaService extends PrismaClient
```

所以创建 `PrismaService` 时，必须先调用父类 `PrismaClient` 的构造函数。

`super({ adapter })` 的意思是：

```txt
创建父类 PrismaClient 时，把 adapter 配置传进去。
```

## 示例代码

```ts
class Parent {
  constructor(public name: string) {}
}

class Child extends Parent {
  constructor(name: string, public age: number) {
    super(name); // 调用 Parent 的 constructor
  }
}

const child = new Child('Tom', 18);

console.log(child.name); // Tom
console.log(child.age); // 18
```

当前项目中的用法：

```ts
super({
  adapter,
});
```

等价理解：

```txt
请用这个 adapter 初始化 PrismaClient。
```

注意：在子类 constructor 中，使用 `this` 之前必须先调用 `super()`。

## 3. `async onModuleInit()` 为什么要 `async`？什么时候用 `async`？

## 解释

`async` 表示这个函数里面可以使用 `await`，并且这个函数会返回一个 Promise。

第 11 课里：

```ts
async onModuleInit() {
  await this.$connect();
}
```

`this.$connect()` 是异步操作，因为连接数据库需要时间。

所以要写：

```ts
await this.$connect();
```

只要函数里用了 `await`，外层函数就必须加 `async`：

```ts
async function fn() {
  await somePromise();
}
```

## 示例代码

```ts
function waitOneSecond() {
  return new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });
}

async function run() {
  console.log('start');
  await waitOneSecond();
  console.log('end');
}

run();
```

当前项目中的用法：

```ts
async onModuleInit() {
  await this.$connect();
}

async onModuleDestroy() {
  await this.$disconnect();
}
```

什么时候用 `async`？

```txt
函数里要 await 异步操作时。
函数要返回 Promise 时。
比如数据库查询、HTTP 请求、文件读写、定时等待。
```

## 4. `Promise.all` 是什么？为什么要用 Promise？

## 解释

`Promise` 表示一个未来才会完成的异步结果。

数据库查询就是异步的：

```ts
const courses = await this.prisma.course.findMany();
```

`Promise.all()` 可以同时等待多个 Promise 完成。

第 11 课里：

```ts
const [items, total] = await Promise.all([
  this.prisma.course.findMany({ where, skip, take: limit }),
  this.prisma.course.count({ where }),
]);
```

这里有两个数据库查询：

```txt
findMany
  查询当前页数据。

count
  查询总数。
```

它们互不依赖，可以并行执行。

如果不用 `Promise.all`：

```ts
const items = await this.prisma.course.findMany(...);
const total = await this.prisma.course.count(...);
```

这是串行：

```txt
先等 findMany 完成
再开始 count
```

使用 `Promise.all`：

```txt
findMany 和 count 同时开始
两个都完成后继续执行
```

## 示例代码

```ts
function wait(ms: number, value: string) {
  return new Promise<string>((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

async function run() {
  const [a, b] = await Promise.all([
    wait(1000, 'A'),
    wait(1000, 'B'),
  ]);

  console.log(a, b); // A B
}
```

如果串行，约 2 秒。

如果 `Promise.all` 并行，约 1 秒。

当前项目中适合并行，是因为：

```txt
items 查询和 total 查询互不依赖。
```

## 5. `skip`、`where`、`data` 是约定好的变量名吗？都要传入对象吗？`course` 属性就是 course 列吗？

## 解释

这里要分清楚两种名字：

```txt
Prisma API 规定的参数名
你自己定义的变量名
```

### `where`、`data`、`skip`、`take`

这些是 Prisma API 规定的参数名。

比如：

```ts
this.prisma.course.findMany({
  where: {
    status: 'published',
  },
  skip: 0,
  take: 10,
});
```

这里：

```txt
where
  查询条件。

skip
  跳过多少条。

take
  取多少条。
```

创建数据时：

```ts
this.prisma.course.create({
  data: {
    title: 'NestJS 入门',
    price: 99,
  },
});
```

这里：

```txt
data
  要写入数据库的数据。
```

这些名字不能随便改成：

```ts
this.prisma.course.create({
  body: { title: 'NestJS 入门' },
});
```

因为 Prisma 不认识 `body`。

### 都要传对象吗？

多数 Prisma 方法接收一个配置对象。

例如：

```ts
findMany({ where, skip, take })
findUnique({ where: { id } })
create({ data })
update({ where, data })
delete({ where })
```

所以是的，通常会传一个对象进去。

### `prisma.course` 是 course 列吗？

不是。

```ts
this.prisma.course.findMany()
```

这里的 `course` 不是某一列。

它对应的是 Prisma schema 里的模型：

```prisma
model Course {
  id    Int
  title String
}
```

Prisma 会把 `model Course` 生成成客户端上的 `course` 属性。

所以：

```txt
prisma.course
  -> 操作 Course 模型/表的入口

course.title
  -> Course 表里的 title 字段
```

## 示例代码

```ts
// 查询 Course 表
const list = await prisma.course.findMany({
  where: {
    status: 'published',
  },
  skip: 0,
  take: 10,
});

// 创建 Course 表的一行数据
const course = await prisma.course.create({
  data: {
    title: 'NestJS 入门',
    price: 99,
    status: 'draft',
  },
});
```

一句话：

```txt
where/data/skip/take 是 Prisma API 规定的参数名；prisma.course 是 Course 模型的数据访问入口，不是 course 列。
```

## 6. `??` 和 `||` 的区别是什么？

## 解释

`??` 叫空值合并运算符。

它只在左边是 `null` 或 `undefined` 时，才使用右边的值。

```ts
const result = value ?? defaultValue;
```

`||` 是逻辑或。

它在左边是“假值”时，就使用右边的值。

JavaScript 里的假值包括：

```txt
false
0
''
null
undefined
NaN
```

所以区别是：

```txt
??
  只把 null 和 undefined 当成“没有值”。

||
  把 false、0、空字符串也当成“没有值”。
```

## 示例代码

```ts
const a = 0 || 10;
console.log(a); // 10

const b = 0 ?? 10;
console.log(b); // 0
```

```ts
const title1 = '' || '默认标题';
console.log(title1); // 默认标题

const title2 = '' ?? '默认标题';
console.log(title2); // ''
```

当前项目中的用法：

```ts
status: input.status ?? 'draft',
```

意思是：

```txt
如果 input.status 是 null 或 undefined，就使用 draft。
如果 input.status 有值，就使用它。
```

这里用 `??` 比 `||` 更准确。

因为我们只是想处理“没传”，不想把所有假值都当成没传。

一句话：

```txt
默认值优先用 ??，因为它只处理 null/undefined；|| 会把 0、false、空字符串也替换掉。
```
