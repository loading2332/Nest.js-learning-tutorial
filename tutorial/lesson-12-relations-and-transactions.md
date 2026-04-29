# 第 12 课：关系查询与事务

## 本节目标

学完这一节，你要能做到：

- 理解一对多关系在接口中的使用方式。
- 使用 Prisma 创建课程章节。
- 查询课程详情时返回章节列表。
- 理解多对多关系为什么需要中间表。
- 实现用户报名课程。
- 使用数据库唯一约束防止重复报名。
- 理解事务解决什么问题。
- 使用 Prisma `$transaction` 保证多步操作的一致性。
- 能描述一次“用户报名课程”的完整数据变化。

第 10 课我们建了模型：

```txt
User
Course
Lesson
Enrollment
```

第 11 课我们把课程 CRUD 改成了数据库读写。

第 12 课要真正使用这些关系：

```txt
Course 1 -> n Lesson
User n -> n Course，通过 Enrollment 连接
```

## 一、为什么要学习关系查询

真实业务数据通常不是孤立的。

课程不是只有一张 `courses` 表。

它还会关联：

```txt
章节 lessons
报名记录 enrollments
老师 users
评论 comments
订单 orders
```

如果只会单表 CRUD，很多真实功能都做不了。

比如：

```txt
查询课程详情时，需要显示章节列表。
用户报名课程时，需要写入报名记录。
删除课程时，需要处理章节和报名关系。
```

所以这一课开始处理“表和表之间的关系”。

## 二、本课要实现的接口

建议新增这些接口：

```txt
POST /courses/:courseId/lessons
  给课程创建章节

GET /courses/:id
  查询课程详情，同时返回章节列表

POST /courses/:courseId/enrollments
  用户报名课程
```

为了先聚焦关系和事务，本课的报名接口可以临时从请求体里传 `userId`：

```json
{
  "userId": 1
}
```

后面第 14 课学 JWT 后，再改成从登录用户中获取当前用户：

```ts
@CurrentUser() user
```

## 三、一对多关系：课程和章节

在 `schema.prisma` 中，课程和章节关系大概是：

```prisma
model Course {
  id      Int      @id @default(autoincrement())
  title   String   @unique
  lessons Lesson[]
}

model Lesson {
  id       Int    @id @default(autoincrement())
  title    String
  courseId Int
  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
}
```

含义：

```txt
Course.lessons
  一个课程有多个章节。

Lesson.courseId
  章节表中真实保存的外键字段。

Lesson.course
  Prisma 关系字段，用于关联 Course。
```

关系是：

```txt
Course 1 -> n Lesson
Lesson n -> 1 Course
```

## 四、创建章节 DTO

创建文件：

```txt
src/courses/dto/create-lesson.dto.ts
```

写入：

```ts
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateLessonDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
```

如果你希望请求体里的字符串数字也能转换成 number，可以配合：

```ts
import { Type } from 'class-transformer';

@Type(() => Number)
@IsInt()
@Min(0)
@IsOptional()
sortOrder?: number;
```

不过本课可以先要求客户端传真正的数字。

## 五、创建章节接口

在 `CoursesController` 中新增：

```ts
@Post(':courseId/lessons')
createLesson(
  @Param('courseId', ParseIntPipe) courseId: number,
  @Body() body: CreateLessonDto,
) {
  return this.coursesService.createLesson(courseId, body);
}
```

需要导入：

```ts
import { CreateLessonDto } from './dto/create-lesson.dto';
```

接口含义：

```txt
POST /courses/1/lessons
  给 id = 1 的课程创建章节。
```

请求示例：

```bash
curl -X POST http://localhost:3000/courses/1/lessons \
  -H "Content-Type: application/json" \
  -d '{
    "title": "第 1 章：NestJS 项目结构",
    "content": "理解 main.ts、module、controller、service",
    "sortOrder": 1
  }'
```

## 六、在 Service 中创建章节

在 `CoursesService` 中新增：

```ts
async createLesson(courseId: number, input: CreateLessonDto) {
  await this.findOne(courseId);

  return this.prisma.lesson.create({
    data: {
      title: input.title,
      content: input.content,
      sortOrder: input.sortOrder ?? 0,
      courseId,
    },
  });
}
```

为什么先执行：

```ts
await this.findOne(courseId);
```

因为要确认课程存在。

如果课程不存在，返回：

```txt
404 Not Found
```

否则直接创建章节。

也可以用 Prisma 的关系写法：

```ts
return this.prisma.lesson.create({
  data: {
    title: input.title,
    content: input.content,
    sortOrder: input.sortOrder ?? 0,
    course: {
      connect: {
        id: courseId,
      },
    },
  },
});
```

两种写法都可以。

本课先使用：

```ts
courseId
```

因为它更直观，能看出真实外键字段。

## 七、查询课程详情时返回章节

第 11 课的 `findOne()` 可能是：

```ts
const course = await this.prisma.course.findUnique({
  where: {
    id,
  },
});
```

如果要带章节，可以改成：

```ts
const course = await this.prisma.course.findUnique({
  where: {
    id,
  },
  include: {
    lessons: {
      orderBy: {
        sortOrder: 'asc',
      },
    },
  },
});
```

`include` 的作用是：

```txt
把关联数据一起查出来。
```

这里：

```txt
include lessons
  查询课程时，同时返回课程章节。
```

响应大概是：

```json
{
  "id": 1,
  "title": "NestJS 入门",
  "lessons": [
    {
      "id": 1,
      "title": "第 1 章：NestJS 项目结构",
      "sortOrder": 1,
      "courseId": 1
    }
  ]
}
```

## 八、`include` 和 `select` 的区别

Prisma 常用两个字段控制返回数据：

```txt
include
  在返回主模型字段的基础上，额外带上关联数据。

select
  精确选择要返回哪些字段。
```

`include` 示例：

```ts
this.prisma.course.findUnique({
  where: { id },
  include: {
    lessons: true,
  },
});
```

返回：

```txt
课程所有字段 + lessons
```

`select` 示例：

```ts
this.prisma.course.findUnique({
  where: { id },
  select: {
    id: true,
    title: true,
    lessons: {
      select: {
        id: true,
        title: true,
      },
    },
  },
});
```

返回：

```txt
只返回 id、title，以及 lessons 的 id、title。
```

本课先用 `include`，更容易理解。

## 九、多对多关系：用户报名课程

用户和课程是多对多：

```txt
一个用户可以报名多门课程。
一门课程可以被多个用户报名。
```

我们用中间表 `Enrollment` 表示：

```prisma
model Enrollment {
  id       Int @id @default(autoincrement())
  userId   Int
  courseId Int
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([userId, courseId])
}
```

`@@unique([userId, courseId])` 表示：

```txt
同一个用户不能重复报名同一门课程。
```

这个约束非常重要。

业务代码可以检查重复，但数据库约束才是最终兜底。

## 十、创建报名 DTO

创建文件：

```txt
src/courses/dto/enroll-course.dto.ts
```

写入：

```ts
import { IsInt } from 'class-validator';

export class EnrollCourseDto {
  @IsInt()
  userId: number;
}
```

如果你通过 JSON 请求传：

```json
{
  "userId": 1
}
```

通常是 number。

如果你希望兼容字符串：

```json
{
  "userId": "1"
}
```

可以加：

```ts
import { Type } from 'class-transformer';

@Type(() => Number)
@IsInt()
userId: number;
```

## 十一、创建报名接口

在 `CoursesController` 中新增：

```ts
@Post(':courseId/enrollments')
enroll(
  @Param('courseId', ParseIntPipe) courseId: number,
  @Body() body: EnrollCourseDto,
) {
  return this.coursesService.enroll(courseId, body.userId);
}
```

导入：

```ts
import { EnrollCourseDto } from './dto/enroll-course.dto';
```

请求示例：

```bash
curl -X POST http://localhost:3000/courses/1/enrollments \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1
  }'
```

## 十二、为什么报名需要事务

报名课程看起来只是创建一条 `Enrollment`。

但真实逻辑通常不止一步：

```txt
1. 检查用户是否存在
2. 检查课程是否存在
3. 检查是否已经报名
4. 创建报名记录
```

这些步骤之间有一致性要求。

尤其是：

```txt
检查是否已经报名
创建报名记录
```

如果两个请求同时进来，可能都判断“还没报名”，然后都尝试创建。

数据库的唯一约束会阻止重复数据，但业务上还希望把错误变成清晰的提示。

事务的作用是：

```txt
把多个数据库操作作为一个整体。
要么全部成功。
要么失败时全部回滚。
```

## 十三、使用 `$transaction` 实现报名

在 `CoursesService` 中新增：

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
  });
}
```

这里的 `tx` 是事务里的 Prisma Client。

在事务里，尽量用：

```ts
tx.user.findUnique()
tx.course.findUnique()
tx.enrollment.create()
```

不要混用：

```ts
this.prisma.user.findUnique()
```

因为要保证这些操作属于同一个事务。

## 十四、理解 `userId_courseId`

在 `schema.prisma` 里：

```prisma
@@unique([userId, courseId])
```

Prisma 会生成一个组合唯一查询条件，默认名字通常是：

```ts
userId_courseId
```

所以可以写：

```ts
where: {
  userId_courseId: {
    userId,
    courseId,
  },
}
```

含义是：

```txt
查找 userId 和 courseId 同时匹配的报名记录。
```

如果你觉得默认名字不够清晰，也可以在 Prisma schema 里给唯一约束命名：

```prisma
@@unique([userId, courseId], name: "enrollment_user_course_unique")
```

本课先使用默认名字。

## 十五、准备测试用户

报名接口需要用户存在。

如果你还没有用户创建接口，可以先用 Prisma Studio 或 SQL 插入一个用户。

启动 Prisma Studio：

```bash
pnpm exec prisma studio
```

在 `User` 表里创建：

```txt
email: test@example.com
name: Test User
role: student
```

注意：你当前 schema 如果还没有 `passwordHash` 字段，就不用填。

如果你保留了 `passwordHash`，需要填一个临时值：

```txt
passwordHash: dev-password-hash
```

也可以用 SQL：

```sql
INSERT INTO "User" ("email", "name", "role", "createAt", "updateAt")
VALUES ('test@example.com', 'Test User', 'student', NOW(), NOW());
```

字段名要按你的实际 schema 来。

你现在项目里用的是：

```txt
createAt
updateAt
```

不是常见的：

```txt
createdAt
updatedAt
```

这能用，只是命名不太标准。

## 十六、测试完整流程

### 1. 创建课程

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "NestJS 关系查询",
    "description": "学习 Prisma include 和 transaction",
    "price": 199,
    "status": "published"
  }'
```

记下返回的课程 `id`。

### 2. 创建章节

```bash
curl -X POST http://localhost:3000/courses/1/lessons \
  -H "Content-Type: application/json" \
  -d '{
    "title": "第 1 章：关系查询",
    "content": "学习 include",
    "sortOrder": 1
  }'
```

### 3. 查询课程详情

```bash
curl http://localhost:3000/courses/1
```

预期课程详情里出现：

```json
{
  "lessons": []
}
```

或包含刚创建的章节。

### 4. 报名课程

```bash
curl -X POST http://localhost:3000/courses/1/enrollments \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1
  }'
```

预期返回报名记录。

### 5. 重复报名

再次执行同一个请求。

预期返回：

```txt
400 Bad Request
already enrolled
```

## 十七、事务失败时会发生什么

在 `$transaction` 中：

```ts
return this.prisma.$transaction(async (tx) => {
  // step 1
  // step 2
  // step 3
});
```

如果中间抛出异常：

```ts
throw new BadRequestException('already enrolled');
```

Prisma 会回滚这个事务中已经执行但尚未提交的操作。

这保证：

```txt
不会出现一半成功、一半失败的数据状态。
```

例如真实购买课程可能有：

```txt
扣减库存
创建订单
创建报名记录
记录支付流水
```

如果创建报名失败，前面的库存扣减也应该回滚。

这就是事务的价值。

## 十八、`$transaction([])` 和交互式事务

Prisma 常见两种事务写法。

### 数组事务

```ts
await this.prisma.$transaction([
  this.prisma.course.count(),
  this.prisma.user.count(),
]);
```

适合多个互不依赖的操作。

### 交互式事务

```ts
await this.prisma.$transaction(async (tx) => {
  const user = await tx.user.findUnique(...);
  if (!user) {
    throw new Error('not found');
  }
  return tx.enrollment.create(...);
});
```

适合后一步依赖前一步结果，或者中间要写业务判断。

本课报名逻辑更适合交互式事务，因为需要：

```txt
查用户
查课程
查重复
根据结果决定是否创建
```

## 十九、常见问题

### 1. 为什么创建章节不用事务？

当前创建章节只有一步写入：

```ts
lesson.create()
```

虽然前面有 `findOne(courseId)`，但即使课程不存在，也不会产生部分写入。

所以事务不是必须。

如果以后创建章节时还要同时：

```txt
更新课程章节数
写审计日志
生成学习任务
```

那就可以考虑事务。

### 2. 为什么重复报名要靠唯一约束？

因为应用层检查可能遇到并发问题。

数据库唯一约束是最终防线。

```prisma
@@unique([userId, courseId])
```

能保证数据库里不会出现两条相同报名关系。

### 3. `include` 会不会查太多数据？

会有这个风险。

所以真实项目里要谨慎使用：

```ts
include: {
  lessons: true,
}
```

如果关联数据很多，应该分页或用 `select` 精确选择字段。

### 4. 事务是不是越多越好？

不是。

事务会占用数据库连接和锁，事务时间越长，影响越大。

建议：

```txt
需要保证多步写入一致性时用事务。
单步操作不要为了“看起来专业”强行加事务。
事务里不要做很慢的外部 HTTP 请求。
```

## 二十、本节练习任务

### 任务 1：实现课程章节创建

要求：

- 创建 `CreateLessonDto`。
- 新增 `POST /courses/:courseId/lessons`。
- 在 `CoursesService` 中实现 `createLesson()`。
- 课程不存在时返回 404。

记录：

```txt
创建章节请求：
创建章节响应：
```

### 任务 2：课程详情返回章节

要求：

- 修改 `findOne()`。
- 使用 `include` 返回 `lessons`。
- 按 `sortOrder` 升序排序。

记录：

```txt
GET /courses/:id 响应中的 lessons：
```

### 任务 3：实现报名接口

要求：

- 创建 `EnrollCourseDto`。
- 新增 `POST /courses/:courseId/enrollments`。
- 在 `CoursesService` 中实现 `enroll()`。
- 用户不存在返回 404。
- 课程不存在返回 404。
- 已报名返回 400。

记录：

```txt
报名成功响应：
重复报名响应：
```

### 任务 4：使用事务保护报名流程

要求：

- 使用 `this.prisma.$transaction(async (tx) => {})`。
- 事务内部统一使用 `tx`。
- 不在事务中混用 `this.prisma`。

记录：

```txt
事务中包含哪些步骤：
```

### 任务 5：描述数据变化

要求：

用文字描述一次报名课程的数据变化：

```txt
用户：
课程：
报名记录：
重复报名如何被拦截：
```

## 二十一、本节知识输出

请在学习笔记中回答：

1. 一对多关系在 `Course` 和 `Lesson` 中分别怎么表示？
2. `include` 和 `select` 有什么区别？
3. 为什么用户和课程之间需要 `Enrollment`？
4. `@@unique([userId, courseId])` 解决什么问题？
5. 什么情况下需要事务？
6. Prisma `$transaction(async tx => {})` 中的 `tx` 是什么？
7. 为什么事务里不要混用 `this.prisma`？
8. 描述一次用户报名课程的数据变化。

## 二十二、本节最小验收

- 已创建 `CreateLessonDto`。
- 已创建 `EnrollCourseDto`。
- 已实现 `POST /courses/:courseId/lessons`。
- 已实现 `POST /courses/:courseId/enrollments`。
- `GET /courses/:id` 会返回章节列表。
- 报名接口使用 `$transaction`。
- 重复报名会被拦截。
- 数据库中不会产生重复报名记录。
- `pnpm run build` 可以通过。
- `pnpm run lint` 可以通过。
- `pnpm run test:e2e` 可以通过。

## 二十三、下一节预告

下一节会进入认证与授权阶段。

第 12 课临时用：

```json
{
  "userId": 1
}
```

表示当前报名用户。

但真实系统里，用户 ID 不应该由客户端随便传。

第 13、14 课会学习：

```txt
注册
登录
密码哈希
JWT
Guard
CurrentUser
```

到时候报名接口会从登录态里拿用户：

```ts
@CurrentUser() user
```

而不是信任请求体里的 `userId`。

## 参考资料

- [Prisma relation queries](https://www.prisma.io/docs/v6/orm/prisma-client/queries/relation-queries)
- [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
