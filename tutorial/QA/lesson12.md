# Q

1. await this.findOne(id); 这个写了的作用是什么？我看也没有赋值给变量啊
2. 事务是什么东西？
3. 为啥是return里面再return，enrollment.create为啥要return，create不就得了
4. 查找 userId 和 courseId 同时匹配的报名记录。啥意思，我看数据库好像没这个userId_courseId字段？另外，这个includes在这里是干什么的？
5. 数据库的schema改动是不是会影响很大？数据库是否可以说明一个人的架构能力？

# A

## 1. `await this.findOne(id);` 这个写了的作用是什么？为什么没有赋值给变量？

这行代码的作用不是为了拿返回值，而是为了“检查这条数据是否存在”。

比如第 11 课里的更新课程：

```ts
async update(id: number, input: UpdateCourseDto) {
  await this.findOne(id);

  return this.prisma.course.update({
    where: {
      id,
    },
    data: {
      title: input.title,
      description: input.description,
      price: input.price,
      status: input.status,
    },
  });
}
```

你注意得很对：

```ts
await this.findOne(id);
```

没有写成：

```ts
const course = await this.findOne(id);
```

原因是这里不需要使用 `course` 的数据。

它真正需要的是 `findOne()` 里面的副作用：

```ts
async findOne(id: number) {
  const course = await this.prisma.course.findUnique({
    where: {
      id,
    },
  });

  if (!course) {
    throw new NotFoundException('course not found');
  }

  return course;
}
```

也就是说：

```txt
如果课程存在：
  findOne 正常返回，update 继续执行。

如果课程不存在：
  findOne 抛出 NotFoundException，update 后面的代码不会执行。
```

所以：

```ts
await this.findOne(id);
```

可以理解为：

```txt
先确认这个课程存在。
不存在就直接抛 404。
存在才继续更新。
```

## 为什么不直接 update？

你也可以直接写：

```ts
return this.prisma.course.update({
  where: {
    id,
  },
  data: input,
});
```

如果数据不存在，Prisma 也会报错。

但那个错误是 Prisma 的数据库层错误，不是我们自己定义的业务错误。

我们希望接口返回更清晰的业务响应：

```txt
404 course not found
```

所以先调用 `findOne()`，把“不存在”转换成业务异常。

## 为什么要 `await`？

因为 `findOne()` 是异步的数据库查询。

如果不写 `await`：

```ts
this.findOne(id);

return this.prisma.course.update(...);
```

那么 `update` 不会等 `findOne` 查完，就继续执行了。

这样就失去了“先检查是否存在”的意义。

## 什么时候可以这样写？

当你只关心一个异步函数“是否成功完成”，不关心它的返回值时，就可以这样写：

```ts
await this.findOne(id);
```

常见场景：

```txt
确认资源存在
确认用户有权限
确认某个前置操作成功
确认某个校验没有抛异常
```

示例：

```ts
await this.ensureUserExists(userId);
await this.ensureCourseExists(courseId);
await this.ensureUserCanEnroll(userId, courseId);
```

这些函数可能都不需要返回值，只要它们不抛异常，就表示检查通过。

一句话总结：

```txt
await this.findOne(id) 没有赋值，是因为它的目的不是拿数据，而是借用 findOne 的“不存在就抛 404”这个检查逻辑。
```

## 2. 事务是什么东西？

事务可以先理解成：

```txt
把多个数据库操作打包成一个整体。
这个整体要么全部成功，要么全部失败。
```

它解决的是“多步操作中途失败，数据会不会变得不一致”的问题。

## 先看一个没有事务的问题

假设用户报名课程时，要做三件事：

```txt
1. 创建订单
2. 扣减库存
3. 创建报名记录
```

如果没有事务，可能出现：

```txt
订单创建成功了
库存也扣了
但是创建报名记录失败了
```

这时候数据就乱了：

```txt
用户没有报名成功
但库存已经少了
订单也存在
```

这就是事务要解决的问题。

## 有事务会怎样？

如果这三步放在一个事务里：

```txt
开始事务
  1. 创建订单
  2. 扣减库存
  3. 创建报名记录
提交事务
```

只要中间任何一步失败：

```txt
回滚事务
```

回滚的意思是：

```txt
把已经做过的数据库修改撤回。
恢复到事务开始之前的状态。
```

所以事务能保证：

```txt
要么三步都成功。
要么三步都不生效。
```

## 本课程里的报名事务

第 12 课报名课程可能会写：

```ts
async enroll(courseId: number, userId: number) {
  return this.prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('user not found');
    }

    const course = await tx.course.findUnique({
      where: {
        id: courseId,
      },
    });

    if (!course) {
      throw new NotFoundException('course not found');
    }

    const existingEnrollment = await tx.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (existingEnrollment) {
      throw new BadRequestException('already enrolled');
    }

    return tx.enrollment.create({
      data: {
        userId,
        courseId,
      },
    });
  });
}
```

这段代码的核心不是“语法看起来复杂”，而是业务流程：

```txt
在一个事务里：
  1. 查用户是否存在
  2. 查课程是否存在
  3. 查是否已经报名
  4. 创建报名记录
```

如果中途发现：

```txt
用户不存在
课程不存在
已经报名过
```

就会抛异常，事务不会提交。

## `tx` 是什么？

```ts
this.prisma.$transaction(async (tx) => {
  // ...
});
```

这里的 `tx` 可以理解成：

```txt
事务版本的 Prisma Client。
```

在这个函数里面，数据库操作要用：

```ts
tx.user.findUnique();
tx.course.findUnique();
tx.enrollment.create();
```

而不是：

```ts
this.prisma.user.findUnique();
```

因为：

```txt
tx 里的操作属于同一个事务。
this.prisma 的操作可能跑到事务外面。
```

## 什么时候需要事务？

不是所有数据库操作都要事务。

需要事务的典型场景：

```txt
多个写操作必须同时成功
后一步依赖前一步结果
中途失败时需要撤销前面的修改
涉及钱、库存、报名、订单、余额这类一致性要求高的业务
```

比如：

```txt
创建订单 + 扣库存
转账：A 扣钱 + B 加钱
报名课程 + 生成学习记录
支付成功 + 开通课程权限
```

不一定需要事务的场景：

```txt
单纯查询课程列表
查询课程详情
只创建一条简单记录
```

## 一句话总结

```txt
事务就是数据库里的“整体操作保护机制”：多个操作要么一起成功，要么一起失败回滚，避免数据只成功一半。
```

## 3. 为什么是 `return` 里面再 `return`？`enrollment.create` 为什么要 `return`，只写 `create` 不行吗？

你看到的结构大概是：

```ts
async enroll(courseId: number, userId: number) {
  return this.prisma.$transaction(async (tx) => {
    // 前面做各种检查

    return tx.enrollment.create({
      data: {
        userId,
        courseId,
      },
    });
  });
}
```

这里确实有两个 `return`。

它们分别负责不同层级。

### 外层 `return`

外层是：

```ts
return this.prisma.$transaction(...);
```

它的意思是：

```txt
把整个事务最终的结果，作为 enroll() 方法的返回值。
```

也就是说，Controller 调用：

```ts
return this.coursesService.enroll(courseId, userId);
```

最后拿到的就是事务成功后的结果。

### 内层 `return`

内层是：

```ts
return tx.enrollment.create(...);
```

它的意思是：

```txt
把创建出来的报名记录，作为这个事务回调函数的结果。
```

Prisma 的 `$transaction(async (tx) => { ... })` 会把回调函数里 `return` 的东西，当成整个事务的成功结果。

所以这两层连起来就是：

```txt
tx.enrollment.create 返回报名记录
  -> 作为事务结果
  -> this.prisma.$transaction 返回这个结果
  -> enroll() 返回这个结果
  -> Controller 返回给客户端
```

### 如果不写内层 `return` 会怎样？

比如：

```ts
async enroll(courseId: number, userId: number) {
  return this.prisma.$transaction(async (tx) => {
    await tx.enrollment.create({
      data: {
        userId,
        courseId,
      },
    });
  });
}
```

这里创建动作会执行，但是事务回调没有返回值。

所以客户端可能拿到：

```txt
undefined
```

也就是说：

```txt
数据库里创建成功了，
但是接口没有把创建后的报名记录返回出去。
```

### 如果不写外层 `return` 会怎样？

比如：

```ts
async enroll(courseId: number, userId: number) {
  this.prisma.$transaction(async (tx) => {
    return tx.enrollment.create({
      data: {
        userId,
        courseId,
      },
    });
  });
}
```

这里更糟。

`enroll()` 没有等待事务，也没有把事务结果返回给 Controller。

所以 Controller 拿不到正确结果，异常处理也可能变得混乱。

正确写法是：

```ts
return this.prisma.$transaction(async (tx) => {
  return tx.enrollment.create(...);
});
```

一句话总结：

```txt
内层 return：把创建出的报名记录交给事务。
外层 return：把事务结果交给 enroll() 的调用方，也就是 Controller。
```

## 4. `userId_courseId` 是什么？数据库里没有这个字段啊？另外这里的 `include` 是干什么的？

你问得对：数据库里通常没有一个真的字段叫：

```txt
userId_courseId
```

它不是数据库字段。

它是 Prisma 根据组合唯一约束生成出来的“查询条件名字”。

### 先看 schema

在 `Enrollment` 模型里有：

```prisma
model Enrollment {
  id       Int @id @default(autoincrement())
  userId   Int
  courseId Int

  @@unique([userId, courseId])
}
```

这句：

```prisma
@@unique([userId, courseId])
```

意思是：

```txt
userId + courseId 这个组合不能重复。
```

比如：

```txt
userId = 1, courseId = 2
```

这组组合只能出现一次。

数据库真实约束大概类似：

```sql
UNIQUE ("userId", "courseId")
```

### Prisma 为什么有 `userId_courseId`

因为你要按这个“组合唯一约束”查一条报名记录。

Prisma 需要给这个组合查询起一个名字。

默认会把字段名拼起来：

```txt
userId_courseId
```

所以代码里写：

```ts
const existingEnrollment = await tx.enrollment.findUnique({
  where: {
    userId_courseId: {
      userId,
      courseId,
    },
  },
});
```

它的意思不是查一个叫 `userId_courseId` 的字段。

它的意思是：

```txt
用 userId 和 courseId 这两个字段组成的唯一约束来查。
```

换成 SQL，大概是：

```sql
SELECT *
FROM "Enrollment"
WHERE "userId" = 1
  AND "courseId" = 2
LIMIT 1;
```

### `include` 是干什么的？

`include` 是 Prisma 用来“顺便查关联数据”的。

比如：

```ts
return tx.enrollment.create({
  data: {
    userId,
    courseId,
  },
  include: {
    user: {
      select: {
        id: true,
        email: true,
        name: true,
      },
    },
    course: {
      select: {
        id: true,
        title: true,
      },
    },
  },
});
```

如果没有 `include`，创建报名后可能只返回报名记录本身：

```json
{
  "id": 1,
  "userId": 1,
  "courseId": 2,
  "createAt": "..."
}
```

加了 `include` 后，会把关联的用户和课程也带回来：

```json
{
  "id": 1,
  "userId": 1,
  "courseId": 2,
  "user": {
    "id": 1,
    "email": "test@example.com",
    "name": "Test User"
  },
  "course": {
    "id": 2,
    "title": "NestJS 入门"
  }
}
```

其中：

```ts
select: {
  id: true,
  email: true,
  name: true,
}
```

表示只返回这些字段。

一句话总结：

```txt
userId_courseId 不是数据库字段，而是 Prisma 为组合唯一约束生成的查询条件名。
include 是让 Prisma 在返回主数据时，把关联的 user/course 一起查出来。
```

## 5. 数据库的 schema 改动是不是影响很大？数据库是否可以说明一个人的架构能力？

是的，数据库 schema 改动通常影响很大。

因为数据库 schema 不只是“几个字段”。

它定义的是系统里最核心的数据结构：

```txt
有哪些业务对象
对象之间是什么关系
哪些字段必须有
哪些字段唯一
哪些关系可以删除
哪些查询需要索引
哪些数据规则由数据库兜底
```

代码可以重构，接口可以调整，但数据库一旦有了真实数据，改起来就要非常小心。

## 为什么 schema 改动影响大？

比如你把字段改名：

```txt
createAt -> createdAt
```

这不只是改 Prisma schema。

它可能影响：

```txt
数据库表字段
后端查询代码
前端展示字段
测试数据
迁移脚本
历史数据兼容
报表和统计
```

再比如你把关系改了：

```txt
Course 1 -> n Lesson
```

改成：

```txt
Lesson 可以属于多个 Course
```

那就不是简单改字段，而是要引入中间表，已有数据也要迁移。

## 数据库 schema 能不能体现架构能力？

能，而且很明显。

一个人的数据库设计能力通常能反映出他的架构思考能力。

因为好的 schema 要考虑：

```txt
业务概念是否清晰
边界是否合理
关系是否稳定
未来扩展是否留有空间
约束是否放在正确层级
查询性能是否能支撑业务
数据一致性是否有保障
迁移成本是否可控
```

比如中间表 `Enrollment` 就是一个架构判断：

```txt
用户和课程是多对多。
报名本身未来可能有状态、进度、支付信息。
所以应该把报名关系显式建成一张表。
```

这比简单把课程 ID 塞到用户表里更有扩展性。

## 但也不要神化数据库设计

数据库设计很重要，但不是一开始就能完美。

真实项目里更常见的是：

```txt
先根据当前业务做合理建模
关键约束先放好
为明显会扩展的关系留空间
随着业务变化逐步迁移
```

不要过度设计：

```txt
还没用到的复杂继承关系
还没确定的多态表
过早拆太多表
为了“架构感”加很多抽象字段
```

## 一个好的 schema 通常长什么样？

它应该：

```txt
表名表达业务对象
字段名清晰稳定
主键明确
外键关系明确
唯一约束保护业务规则
必要查询字段有索引
时间字段统一
删除策略清楚
中间表表达重要关系
```

比如课程系统：

```txt
User
Course
Lesson
Enrollment
```

这四个模型就比一个大表 `data` 更有架构感，因为它们表达了真实业务边界。

一句话总结：

```txt
数据库 schema 是系统架构的骨架。它会影响代码、接口、性能、数据一致性和未来扩展，所以确实很能体现一个人的工程和架构能力。
```
