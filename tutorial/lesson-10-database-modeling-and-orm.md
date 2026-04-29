# 第 10 课：数据库建模与 ORM 入门

## 本节目标

学完这一节，你要能做到：

- 理解为什么需要数据库持久化。
- 理解关系型数据库中的表、字段、主键、外键、唯一约束。
- 理解 ORM 解决什么问题，以及它的代价。
- 使用 Prisma 接入 NestJS 项目。
- 编写 `User`、`Course`、`Lesson` 三个数据模型。
- 理解一对多关系：一个课程有多个章节。
- 理解用户和课程之间的报名关系。
- 使用 Prisma Migrate 完成首次迁移。
- 知道本课和第 11 课的边界：本课建模和迁移，第 11 课再改业务读写。

第 9 课我们已经准备了：

```txt
DATABASE_URL
```

这一课会开始真正使用它。

## 一、为什么内存数组不够用

现在课程数据大概还存在 Service 的内存数组里：

```ts
private courses: Course[] = [
  {
    id: 1,
    title: 'NestJS 入门',
    description: '学习 NestJS 的 Controller、Service 和 Module',
    price: 99,
    status: 'published',
  },
];
```

这种方式适合前几节学习 Controller、Service、DTO、Pipe，因为它简单。

但真实项目中不够用。

原因：

- 服务重启后，内存数据会丢失。
- 多个服务实例之间无法共享内存数据。
- 无法可靠处理并发写入。
- 查询能力弱，比如分页、排序、模糊搜索、关联查询。
- 没有事务，复杂数据变更容易不一致。
- 不能用数据库约束保证唯一性和关系正确性。

比如用户报名课程时，你需要保证：

```txt
用户存在
课程存在
不能重复报名
报名记录要保存
```

这些事情靠内存数组可以模拟，但不适合真实工程。

所以从这一课开始，我们要引入数据库。

## 二、关系型数据库第一印象

关系型数据库可以先理解成很多张“互相关联的表”。

比如课程系统可能有这些表：

```txt
users
courses
lessons
enrollments
```

每张表有字段。

例如 `courses` 表：

```txt
id
title
description
price
status
createdAt
updatedAt
```

一条课程数据就是表里的一行：

```txt
id: 1
title: NestJS 入门
price: 99
status: published
```

常见数据库概念：

```txt
表 table
  一类数据的集合，例如 courses。

字段 column
  数据的属性，例如 title、price。

行 row
  一条具体数据，例如某一门课程。

主键 primary key
  唯一标识一行数据，例如 id。

唯一约束 unique
  保证某个字段不能重复，例如 email。

外键 foreign key
  表示一张表的数据关联另一张表的数据。
```

## 三、这节课为什么选择 Prisma

NestJS 可以搭配很多数据访问方案：

```txt
Prisma
TypeORM
MikroORM
Sequelize
Knex
直接写 SQL
```

本课程默认选择 Prisma。

原因：

- TypeScript 类型体验好。
- 数据模型集中写在 `schema.prisma` 中。
- 迁移文件可以记录数据库结构变化。
- Prisma Client 会根据模型生成类型安全的数据库客户端。
- 对初学者来说，建模和查询的学习路径比较清晰。

但也要知道 ORM 不是银弹。

ORM 的优点：

- 少写很多重复 SQL。
- 查询 API 更类型安全。
- 模型和迁移更集中。
- CRUD 开发效率高。

ORM 的代价：

- 复杂 SQL 可能不如手写直观。
- 需要理解 ORM 自己的抽象和限制。
- 性能问题有时被抽象隐藏。
- 数据库能力太复杂时，仍然需要理解 SQL。

所以这节课的态度是：

```txt
用 Prisma 提高工程效率。
但不要以为用了 ORM 就不用理解数据库。
```

## 四、本课边界

这一课只做三件事：

```txt
1. 安装和初始化 Prisma
2. 建立 User、Course、Lesson、Enrollment 模型
3. 运行首次迁移
```

暂时不做：

```txt
不把 CoursesService 改成数据库读写
不写 PrismaService
不实现关联查询接口
不实现事务
```

这些会放到后续课程：

```txt
第 11 课：Service 和 Prisma Client 的边界，CRUD 改成数据库读写
第 12 课：关系查询、报名记录、事务
```

这样学起来更稳，不会一节课塞太多概念。

## 五、准备数据库

本课程推荐使用 PostgreSQL，因为它更接近真实后端项目。

第 9 课 `.env` 中已经准备了类似配置：

```txt
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

你可以用本地 PostgreSQL，也可以用 Docker。

如果你已经有本地 PostgreSQL，只需要创建一个数据库，比如：

```txt
nest_learn
```

然后把 `.env` 改成真实连接地址：

```txt
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nest_learn?schema=public
```

如果你暂时不想折腾 PostgreSQL，也可以先用 SQLite 学建模：

```txt
DATABASE_URL=file:./dev.db
```

但为了和后续真实项目习惯一致，本课正文使用 PostgreSQL。

## 六、安装 Prisma

安装 Prisma CLI 和 `.env` 加载工具：

```bash
pnpm add -D prisma dotenv
```

安装 Prisma Client：

```bash
pnpm add @prisma/client
```

说明：

```txt
prisma
  开发阶段使用的 CLI，比如 init、migrate、generate。

dotenv
  Prisma 7 的 prisma.config.ts 中用于加载 .env。

@prisma/client
  运行时代码使用的数据库客户端。
```

检查：

```bash
pnpm exec prisma --version
```

能看到版本信息即可。

## 七、初始化 Prisma

执行：

```bash
pnpm exec prisma init --datasource-provider postgresql
```

通常会生成：

```txt
prisma/
  schema.prisma
prisma.config.ts
```

不同 Prisma 版本生成的内容可能略有差异。

如果你的 `prisma/schema.prisma` 中已经有 `datasource` 和 `generator`，先不用紧张，后面会手动整理成课程需要的样子。

## 八、理解 `schema.prisma`

`schema.prisma` 是 Prisma 的核心文件。

在 Prisma 7 中，它通常包含三类内容：

```txt
generator
  决定生成 Prisma Client。

datasource
  决定使用哪种数据库。
  注意：连接 URL 不再写在 schema.prisma 里，而是写在 prisma.config.ts。

model
  描述数据库表结构。
```

示例：

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}

model Course {
  id    Int    @id @default(autoincrement())
  title String
}
```

你可以这样理解：

```txt
schema.prisma 不是 TypeScript 文件。
它是 Prisma 用来描述数据库结构的模型文件。
```

## 九、Prisma 7 中 URL 写在哪里

如果你用的是 Prisma 7，不能再按 Prisma 6 的习惯把数据库 URL 写成：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Prisma 7 会把连接 URL 放到项目根目录的 `prisma.config.ts` 中。

推荐写法：

```ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

然后 `schema.prisma` 中只保留数据库类型：

```prisma
datasource db {
  provider = "postgresql"
}
```

可以这样理解：

```txt
schema.prisma
  描述模型和数据库类型。

prisma.config.ts
  描述 Prisma CLI 怎么找到 schema、migration 和 DATABASE_URL。
```

生成器也建议使用 Prisma 7 风格：

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}
```

这节课重点是理解：

```txt
datasource 负责连接数据库。
Prisma 7 的连接 URL 在 prisma.config.ts 里。
model 负责描述表结构。
migrate 负责把模型变化同步成数据库迁移。
generate 负责生成类型安全客户端。
```

## 十、建立课程系统数据模型

我们先建立四个模型：

```txt
User
Course
Lesson
Enrollment
```

为什么是四个？

```txt
User
  用户，后面登录、报名会用到。

Course
  课程，是当前项目核心资源。

Lesson
  课程章节，一个课程可以有多个章节。

Enrollment
  报名记录，表示某个用户报名了某个课程。
```

关系：

```txt
Course 1 -> n Lesson
User   1 -> n Enrollment
Course 1 -> n Enrollment
User   n -> n Course，通过 Enrollment 间接实现
```

## 十一、编写 `schema.prisma`

打开：

```txt
prisma/schema.prisma
```

整理成下面结构。

这是 Prisma 7 写法，注意 `datasource db` 中没有 `url`：

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}

enum CourseStatus {
  draft
  published
}

enum UserRole {
  student
  teacher
  admin
}

model User {
  id           Int          @id @default(autoincrement())
  email        String       @unique
  name         String
  passwordHash String
  role         UserRole     @default(student)
  enrollments  Enrollment[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
}

model Course {
  id          Int           @id @default(autoincrement())
  title       String        @unique
  description String?
  price       Int
  status      CourseStatus  @default(draft)
  lessons     Lesson[]
  enrollments Enrollment[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

model Lesson {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  sortOrder Int      @default(0)
  courseId  Int
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([courseId])
}

model Enrollment {
  id        Int      @id @default(autoincrement())
  userId    Int
  courseId  Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, courseId])
  @@index([courseId])
}
```

这就是本课的核心产物。

## 十二、逐个理解模型字段

### `User`

```prisma
model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  name         String
  passwordHash String
  role         UserRole @default(student)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

解释：

```txt
id
  主键，自增。

email
  邮箱，唯一。后续注册登录会用。

passwordHash
  密码哈希，不保存明文密码。

role
  用户角色，后面权限课程会用。

createdAt
  创建时间。

updatedAt
  更新时间，数据更新时自动变化。
```

### `Course`

```prisma
model Course {
  id          Int          @id @default(autoincrement())
  title       String       @unique
  description String?
  price       Int
  status      CourseStatus @default(draft)
}
```

解释：

```txt
title @unique
  课程标题唯一，对应第 7 课“重复标题”业务规则。

description String?
  问号表示可选，也就是数据库允许为空。

price Int
  课程价格，先用整数表示分或元，课程里先不展开货币精度问题。

status
  draft 或 published。
```

### `Lesson`

```prisma
model Lesson {
  courseId Int
  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
}
```

这表示：

```txt
每个 Lesson 属于一个 Course。
Lesson.courseId 指向 Course.id。
如果课程被删除，章节也跟着删除。
```

这就是一对多关系：

```txt
一个 Course 有多个 Lesson。
一个 Lesson 只属于一个 Course。
```

### `Enrollment`

```prisma
model Enrollment {
  userId   Int
  courseId Int

  @@unique([userId, courseId])
}
```

这表示：

```txt
一个用户可以报名多个课程。
一个课程可以被多个用户报名。
同一个用户不能重复报名同一个课程。
```

`@@unique([userId, courseId])` 非常重要。

它把“不能重复报名”的规则放到了数据库层。

即使代码忘了检查，数据库也能兜底阻止重复数据。

## 十三、模型和 TypeScript 类型的区别

前面我们写过 TypeScript 类型：

```ts
export type Course = {
  id: number;
  title: string;
  price: number;
  status: CourseStatus;
};
```

现在 Prisma 里也有：

```prisma
model Course {
  id     Int
  title  String
  price  Int
  status CourseStatus
}
```

它们不是同一层东西。

```txt
TypeScript type
  描述代码里的数据形状。
  编译后消失。

Prisma model
  描述数据库表结构。
  会生成数据库迁移。
  会生成 Prisma Client 类型。
```

后续接入 Prisma Client 后，你会发现 Prisma 会根据 `model Course` 自动生成可用类型。

## 十四、运行首次迁移

确认 `.env` 中的 `DATABASE_URL` 是真实可连接的数据库地址。

然后执行：

```bash
pnpm exec prisma migrate dev --name init
```

这个命令会做几件事：

```txt
读取 schema.prisma
对比数据库结构
生成 migration.sql
把 SQL 应用到开发数据库
记录迁移历史
```

执行成功后，会出现类似目录：

```txt
prisma/
  migrations/
    20260429120000_init/
      migration.sql
  schema.prisma
```

`migration.sql` 是真正执行到数据库里的 SQL。

你应该打开看一眼。

不要把迁移文件当成黑盒。

## 十五、生成 Prisma Client

多数情况下，`migrate dev` 会触发生成客户端。

如果需要手动生成，可以执行：

```bash
pnpm exec prisma generate
```

Prisma Client 的作用是：

```txt
根据 schema.prisma 生成类型安全的数据库访问 API。
```

例如后面第 11 课会写类似：

```ts
const courses = await this.prisma.course.findMany();
```

其中 `course`、`findMany`、字段类型，都会来自 Prisma 生成结果。

## 十六、查看数据库结构

你可以用数据库工具查看表是否创建成功。

如果使用 PostgreSQL，可以用：

```bash
psql "$DATABASE_URL"
```

进入后查看表：

```sql
\dt
```

也可以使用图形化工具：

```txt
TablePlus
DataGrip
pgAdmin
Prisma Studio
```

Prisma Studio 可以这样启动：

```bash
pnpm exec prisma studio
```

它会打开一个浏览器页面，方便你查看和编辑数据。

注意：Prisma Studio 适合本地开发调试，不要当成正式后台管理系统。

## 十七、数据库建模时常见判断

### 1. 字段是否可选

Prisma 中：

```prisma
description String?
```

表示可以为空。

如果没有问号：

```prisma
title String
```

表示必须有值。

判断标准：

```txt
没有这个字段，数据是否仍然成立？
```

课程没有描述也可以成立，所以 `description` 可选。

课程没有标题就不成立，所以 `title` 必填。

### 2. 是否需要唯一约束

例如：

```prisma
email String @unique
title String @unique
```

唯一约束适合：

```txt
用户邮箱
用户名
课程 slug
某些业务唯一编号
```

但不是什么都要唯一。

课程标题是否唯一，真实项目可以讨论。

本课程为了和第 7 课“标题重复返回 400”衔接，先设置唯一。

### 3. 是否需要中间表

用户和课程是多对多：

```txt
一个用户可以报名多个课程。
一个课程可以被多个用户报名。
```

多对多通常需要中间表：

```txt
Enrollment
```

如果报名记录以后还要保存更多信息：

```txt
报名时间
学习进度
支付状态
证书状态
```

那就更应该显式建一个 `Enrollment` 模型。

## 十八、内存数组和数据库持久化对比

```txt
内存数组
  优点：简单、学习成本低、不需要安装数据库。
  缺点：重启丢失、不能共享、查询能力弱、没有事务和约束。

数据库
  优点：持久化、支持索引、约束、事务、关联查询、并发。
  缺点：需要建模、迁移、连接管理、理解数据库行为。
```

学习阶段先用内存数组，是为了降低前几课的门槛。

工程阶段必须使用数据库，是为了让数据可靠。

## 十九、常见问题

### 1. Prisma 是数据库吗？

不是。

Prisma 是 ORM 和数据库工具链。

真正保存数据的是 PostgreSQL、MySQL、SQLite 等数据库。

Prisma 负责：

```txt
描述模型
生成迁移
生成客户端
帮你用类型安全的方式访问数据库
```

### 2. `schema.prisma` 改完后为什么还要 migrate？

因为你改的是“模型描述”，数据库本身还没变。

`migrate dev` 会根据模型变化生成 SQL，并执行到数据库。

流程是：

```txt
修改 schema.prisma
  -> 运行 prisma migrate dev
  -> 生成 migration.sql
  -> 数据库结构改变
```

### 3. `migrate dev` 和 `generate` 是什么关系？

简单理解：

```txt
migrate dev
  负责数据库结构迁移。

generate
  负责生成 Prisma Client 类型和代码。
```

有时候 `migrate dev` 会顺手触发 `generate`。

如果你发现类型没更新，可以手动执行：

```bash
pnpm exec prisma generate
```

### 4. 为什么不用 `prisma db push`？

`db push` 可以快速把 schema 推到数据库，适合原型阶段。

但课程更推荐 `migrate dev`，因为它会生成迁移文件。

迁移文件可以进入版本管理，能记录数据库结构如何一步步变化。

真实团队项目更需要迁移历史。

### 5. 第 10 课运行完后接口会自动使用数据库吗？

不会。

这一课只完成数据库结构。

现在的 `CoursesService` 可能仍然在使用内存数组。

第 11 课才会把课程 CRUD 改成 Prisma 数据库读写。

## 二十、本节练习任务

### 任务 1：安装 Prisma

要求：

- 安装 `prisma`。
- 安装 `@prisma/client`。
- 执行 `pnpm exec prisma --version`。

记录：

```txt
Prisma CLI 版本：
Prisma Client 是否安装：
```

### 任务 2：初始化 Prisma

要求：

- 执行 `pnpm exec prisma init --datasource-provider postgresql`。
- 确认出现 `prisma/schema.prisma`。
- 确认 `DATABASE_URL` 指向你的开发数据库。

记录：

```txt
生成的文件：
DATABASE_URL 使用的数据库类型：
```

### 任务 3：编写模型

要求：

- 添加 `User` 模型。
- 添加 `Course` 模型。
- 添加 `Lesson` 模型。
- 添加 `Enrollment` 模型。
- 添加 `CourseStatus` 和 `UserRole` 枚举。

记录：

```txt
我定义的模型：
我定义的关系：
```

### 任务 4：运行首次迁移

要求：

- 执行 `pnpm exec prisma migrate dev --name init`。
- 查看生成的 migration 文件。
- 确认数据库中有对应表。

记录：

```txt
迁移目录名称：
生成了哪些表：
```

### 任务 5：画出关系图

要求：

画出：

```txt
User
Course
Lesson
Enrollment
```

之间的关系。

可以用文字：

```txt
Course 1 -> n Lesson
User 1 -> n Enrollment
Course 1 -> n Enrollment
User n -> n Course，通过 Enrollment 连接
```

也可以画图。

## 二十一、本节知识输出

请在学习笔记中回答：

1. 内存数组和数据库持久化有什么区别？
2. ORM 解决什么问题？它有什么代价？
3. Prisma 的 `schema.prisma` 主要包含哪几类内容？
4. `model`、`enum`、`@id`、`@unique`、`@relation` 分别是什么意思？
5. 为什么 `Lesson` 需要 `courseId`？
6. 为什么用户和课程之间需要 `Enrollment`？
7. `prisma migrate dev` 做了什么？
8. 为什么真实团队项目更需要迁移文件，而不是只用 `db push`？

建议结合本节的四个模型回答。

## 二十二、本节最小验收

- 新增依赖：`prisma`。
- 新增依赖：`@prisma/client`。
- 新增目录：`prisma/`。
- 新增文件：`prisma/schema.prisma`。
- `.env` 中有可连接的 `DATABASE_URL`。
- `schema.prisma` 中有 `User`、`Course`、`Lesson`、`Enrollment`。
- 已执行 `pnpm exec prisma migrate dev --name init`。
- 数据库中可以看到对应表。
- 迁移文件已生成。
- 你能解释课程和章节的一对多关系。
- 你能解释用户和课程为什么通过报名记录关联。

## 二十三、下一节预告

下一节会学习 Repository/Service 数据访问封装。

第 10 课完成的是：

```txt
数据库结构已经有了。
Prisma Client 可以生成了。
```

第 11 课要做的是：

```txt
创建 PrismaService。
把 CoursesService 从内存数组改成数据库读写。
实现分页、筛选、创建、更新、删除。
```

到那时，课程数据就会真正持久化：

```txt
服务重启后，数据不会丢失。
```

## 参考资料

- [NestJS Prisma recipe](https://docs.nestjs.com/recipes/prisma)
- [Prisma Migrate getting started](https://www.prisma.io/docs/v6/orm/prisma-migrate/getting-started)
- [Prisma migrate dev CLI reference](https://docs.prisma.io/docs/cli/migrate/dev)
