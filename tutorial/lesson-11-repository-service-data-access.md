# 第 11 课：Repository/Service 数据访问封装

## 本节目标

学完这一节，你要能做到：

- 理解数据访问层的职责。
- 理解为什么不建议在 Controller 中直接调用 ORM。
- 在 NestJS 中创建 `PrismaService`。
- 在 Prisma 7 中使用 PostgreSQL driver adapter。
- 将课程接口从内存数组改成数据库读写。
- 使用 Prisma Client 实现查询、创建、更新、删除。
- 实现课程列表分页、关键词筛选、状态筛选。
- 理解 Service 与 ORM Client 的边界。
- 知道什么时候需要再拆 Repository。

第 10 课我们已经完成：

```txt
schema.prisma
prisma.config.ts
prisma validate
prisma generate
```

现在项目已经可以生成 Prisma Client：

```txt
src/generated/client
```

这一课要做的是：

```txt
让业务代码真正用 Prisma Client 访问数据库。
```

## 一、从内存数组走向数据库

当前 `CoursesService` 里还有类似这样的内存数组：

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

前面课程用它是为了降低学习成本。

现在进入数据库阶段，这个数组要被 Prisma 查询替代。

迁移后的目标是：

```txt
findAll()
  -> prisma.course.findMany()

findOne()
  -> prisma.course.findUnique()

create()
  -> prisma.course.create()

update()
  -> prisma.course.update()

remove()
  -> prisma.course.delete()
```

这样课程数据就会真正保存到数据库里。

服务重启后，数据不会消失。

## 二、数据访问层是什么

数据访问层负责和数据库打交道。

它关注的是：

```txt
怎么查数据
怎么创建数据
怎么更新数据
怎么删除数据
怎么分页
怎么筛选
怎么处理数据库唯一约束错误
```

在当前项目里，我们可以先让 `CoursesService` 直接调用 Prisma。

结构是：

```txt
CoursesController
  -> 处理 HTTP 请求、读取参数

CoursesService
  -> 处理业务逻辑
  -> 调用 PrismaService 访问数据库

PrismaService
  -> 包装 Prisma Client
  -> 管理数据库连接
```

后面项目更复杂时，可以再拆：

```txt
CoursesController
  -> CoursesService
    -> CoursesRepository
      -> PrismaService
```

但第 11 课先不急着加 Repository。

原因是：

```txt
当前业务还不复杂。
过早抽象会让你多记一层文件，却没有明显收益。
```

本课先把 Service 和 ORM Client 的边界讲清楚。

## 三、为什么不要在 Controller 中直接调用 ORM

你当然可以这样写：

```ts
@Get()
findAll() {
  return this.prisma.course.findMany();
}
```

但不推荐。

Controller 应该关注 HTTP 层：

```txt
路由
参数
请求体
状态码
装饰器
```

数据库读写属于业务执行的一部分，更适合放在 Service。

如果 Controller 直接调 ORM，会出现几个问题：

- Controller 很快变厚。
- 业务规则散落在路由方法里。
- 后续换数据库访问方式时，Controller 也要跟着改。
- 单元测试更难写。
- 其他入口无法复用同一套业务逻辑，比如定时任务、消息队列。

更推荐：

```ts
@Get()
findAll(@Query() query: FindCourseQuery) {
  return this.coursesService.findAll(query);
}
```

由 `CoursesService` 负责：

```ts
findAll(query: FindCourseQuery) {
  return this.prisma.course.findMany(...);
}
```

一句话：

```txt
Controller 不碰数据库，Service 组织业务和数据访问。
```

## 四、Prisma 7 运行时需要 driver adapter

你当前用的是 Prisma 7。

Prisma 7 和老版本有一个重要差异：

```txt
运行时创建 PrismaClient 时，需要传入数据库 driver adapter。
```

PostgreSQL 使用：

```txt
@prisma/adapter-pg
pg
```

如果还没安装，执行：

```bash
pnpm add @prisma/adapter-pg pg
pnpm add -D @types/pg
```

这些包的作用：

```txt
@prisma/adapter-pg
  Prisma 的 PostgreSQL driver adapter。

pg
  node-postgres 数据库驱动。

@types/pg
  pg 的 TypeScript 类型。
```

官方 Prisma 7 PostgreSQL quickstart 也是这个方向：Prisma Client 需要通过 `PrismaPg` adapter 连接 PostgreSQL。

## 五、确认生成客户端路径

你的 `schema.prisma` 当前生成配置是：

```prisma
generator client {
  provider     = "prisma-client-js"
  output       = "../src/generated/client"
  moduleFormat = "cjs"
}
```

所以 Prisma Client 的导入路径是：

```ts
import { PrismaClient } from '../generated/client';
```

注意：路径会根据文件所在位置变化。

如果在：

```txt
src/prisma/prisma.service.ts
```

那么到 `src/generated/client` 的相对路径是：

```ts
import { PrismaClient } from '../generated/client';
```

如果你的生成路径以后改成：

```txt
src/generated/prisma
```

导入路径也要同步改。

## 六、创建 `PrismaService`

建议创建目录：

```txt
src/prisma/
```

创建文件：

```txt
src/prisma/prisma.service.ts
```

写入：

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const connectionString =
      configService.getOrThrow<string>('DATABASE_URL');
    const adapter = new PrismaPg({ connectionString });

    super({
      adapter,
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

这段代码做了几件事：

- 从 `ConfigService` 读取 `DATABASE_URL`。
- 用 `PrismaPg` 创建 PostgreSQL adapter。
- 把 adapter 传给 `PrismaClient`。
- 应用启动时连接数据库。
- 应用关闭时断开数据库。

## 七、创建 `PrismaModule`

创建文件：

```txt
src/prisma/prisma.module.ts
```

写入：

```ts
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

这里要注意 `exports`。

`PrismaService` 不只在 `PrismaModule` 内部使用。

课程模块也要注入它：

```ts
constructor(private readonly prisma: PrismaService) {}
```

所以要导出：

```ts
exports: [PrismaService]
```

一句话：

```txt
PrismaModule 负责提供 PrismaService。
其他模块通过 imports: [PrismaModule] 使用它。
```

## 八、在 `CoursesModule` 中导入 `PrismaModule`

打开：

```txt
src/courses/courses.module.ts
```

加入：

```ts
import { PrismaModule } from '../prisma/prisma.module';
```

然后：

```ts
@Module({
  imports: [PrismaModule],
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
```

这样 `CoursesService` 就能注入 `PrismaService`。

## 九、改造 `CoursesService`

打开：

```txt
src/courses/courses.service.ts
```

先移除内存数组：

```ts
private courses: Course[] = [...]
```

移除：

```ts
private getNextId() {}
private findCourseById() {}
```

然后注入 `PrismaService`：

```ts
constructor(private readonly prisma: PrismaService) {}
```

导入：

```ts
import { PrismaService } from '../prisma/prisma.service';
```

课程状态类型可以继续保留：

```ts
export type CourseStatus = 'draft' | 'published';
```

查询参数类型也可以保留：

```ts
export type FindCourseQuery = {
  keyword?: string;
  status?: CourseStatus;
  page: number;
  limit: number;
};
```

## 十、实现课程列表查询

原来是内存数组筛选：

```ts
let result = this.courses;
```

现在要改成 Prisma 查询。

示例：

```ts
async findAll(query: FindCourseQuery) {
  const { keyword, status, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(keyword
      ? {
          title: {
            contains: keyword,
            mode: 'insensitive' as const,
          },
        }
      : {}),
    ...(status ? { status } : {}),
  };

  const [items, total] = await Promise.all([
    this.prisma.course.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        id: 'desc',
      },
    }),
    this.prisma.course.count({
      where,
    }),
  ]);

  return {
    items,
    meta: {
      total,
      page,
      limit,
    },
  };
}
```

解释：

```txt
where
  查询条件。

contains
  模糊查询标题。

mode: 'insensitive'
  不区分大小写。

skip
  跳过多少条，用于分页。

take
  取多少条，用于分页。

orderBy
  排序。

count
  查询符合条件的总数。
```

这里用 `Promise.all` 是因为列表数据和总数可以并行查询。

## 十一、实现课程详情查询

```ts
async findOne(id: number) {
  const course = await this.prisma.course.findUnique({
    where: {
      id,
    },
  });

  if (!course) {
    throw new NotFoundException('Not Exists');
  }

  return course;
}
```

说明：

```txt
findUnique
  按唯一字段查询。

where: { id }
  id 是主键，所以可以使用 findUnique。
```

现在 `NotFoundException` 仍然保留在 Service 里。

这是合理的，因为“课程不存在”是业务规则。

## 十二、实现创建课程

原来创建课程要手动：

```ts
id: this.getNextId()
```

数据库版本不需要。

因为 `schema.prisma` 中写了：

```prisma
id Int @id @default(autoincrement())
```

创建时：

```ts
async create(input: CreateCourseDto) {
  const exists = await this.prisma.course.findUnique({
    where: {
      title: input.title,
    },
  });

  if (exists) {
    throw new BadRequestException('already exists');
  }

  return this.prisma.course.create({
    data: {
      title: input.title,
      description: input.description,
      price: input.price,
      status: input.status ?? 'draft',
    },
  });
}
```

这里先手动查重，是为了延续第 7 课的业务错误写法。

但真实项目里还要知道：

```txt
数据库唯一约束才是最终兜底。
```

也就是说，就算代码忘了查重，`title @unique` 也会阻止重复标题。

更严谨的做法是捕获 Prisma 唯一约束错误。

本课先保留容易理解的查重写法。

## 十三、实现更新课程

更新前先确认课程存在：

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

为什么先 `await this.findOne(id)`？

因为这样不存在时能返回我们熟悉的：

```txt
404 Not Found
```

如果直接调用 `update()`，Prisma 也会报错，但错误会更偏数据库层，不如业务异常清晰。

注意：`UpdateCourseDto` 中字段是可选的。

如果某些字段是 `undefined`，Prisma 通常会忽略它们，不更新该字段。

## 十四、实现删除课程

```ts
async remove(id: number) {
  await this.findOne(id);

  return this.prisma.course.delete({
    where: {
      id,
    },
  });
}
```

删除课程时，数据库关系会受到 `schema.prisma` 影响。

你之前写了：

```prisma
course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
```

所以如果课程下面有章节，删除课程时章节也会被级联删除。

这就是第 10 课讲的 `onDelete: Cascade` 的效果。

## 十五、完整 `CoursesService` 示例

整理后大概是：

```ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

export type CourseStatus = 'draft' | 'published';

export type FindCourseQuery = {
  keyword?: string;
  status?: CourseStatus;
  page: number;
  limit: number;
};

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindCourseQuery) {
    const { keyword, status, page, limit } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(keyword
        ? {
            title: {
              contains: keyword,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          id: 'desc',
        },
      }),
      this.prisma.course.count({
        where,
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async findOne(id: number) {
    const course = await this.prisma.course.findUnique({
      where: {
        id,
      },
    });

    if (!course) {
      throw new NotFoundException('Not Exists');
    }

    return course;
  }

  async create(input: CreateCourseDto) {
    const exists = await this.prisma.course.findUnique({
      where: {
        title: input.title,
      },
    });

    if (exists) {
      throw new BadRequestException('already exists');
    }

    return this.prisma.course.create({
      data: {
        title: input.title,
        description: input.description,
        price: input.price,
        status: input.status ?? 'draft',
      },
    });
  }

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

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.course.delete({
      where: {
        id,
      },
    });
  }
}
```

你会发现 Controller 基本不用改。

因为 Controller 原来就是调用：

```ts
this.coursesService.findAll(...)
this.coursesService.findOne(...)
this.coursesService.create(...)
this.coursesService.update(...)
this.coursesService.remove(...)
```

这就是分层的好处：

```txt
数据来源从内存数组换成数据库。
Controller 几乎不受影响。
```

## 十六、关于 Prisma 错误处理

本课示例里，重复课程标题先手动查：

```ts
const exists = await this.prisma.course.findUnique({
  where: {
    title: input.title,
  },
});
```

但真实项目要知道一个问题：

```txt
先查再创建，不是百分百防并发重复。
```

比如两个请求同时创建同名课程：

```txt
请求 A 查：不存在
请求 B 查：不存在
请求 A 创建成功
请求 B 创建时数据库唯一约束报错
```

所以数据库唯一约束仍然必要。

更严谨时，需要捕获 Prisma 错误码，比如唯一约束冲突。

本课先不展开 Prisma 错误码细节，后面做更严格错误处理时再补。

## 十七、种子数据：给数据库放几门课程

迁移完成后，数据库里可能是空的。

你可以先用接口创建课程，也可以写 seed 脚本。

简单方式：用接口创建。

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "NestJS 入门",
    "description": "学习 NestJS 基础工程结构",
    "price": 99,
    "status": "published"
  }'
```

再创建一门：

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "TypeScript 基础",
    "description": "学习 TypeScript 类型系统",
    "price": 59,
    "status": "published"
  }'
```

然后查询：

```bash
curl "http://localhost:3000/courses?page=1&limit=10"
```

预期返回：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 2,
        "title": "TypeScript 基础",
        "description": "学习 TypeScript 类型系统",
        "price": 59,
        "status": "published"
      }
    ],
    "meta": {
      "total": 2,
      "page": 1,
      "limit": 10
    }
  }
}
```

实际返回还会包含 `path` 和 `timestamp`，因为第 8 课已经加了 `ResponseInterceptor`。

## 十八、测试分页和筛选

### 分页

```bash
curl "http://localhost:3000/courses?page=1&limit=1"
```

预期：

```txt
items 只有 1 条
meta.total 是总数
meta.page 是 1
meta.limit 是 1
```

### 关键词筛选

```bash
curl "http://localhost:3000/courses?keyword=Nest"
```

预期：

```txt
只返回标题包含 Nest 的课程
```

### 状态筛选

```bash
curl "http://localhost:3000/courses?status=published"
```

预期：

```txt
只返回 published 状态的课程
```

## 十九、为什么查询条件不要写在 Controller

Controller 里当前是：

```ts
return this.coursesService.findAll({
  page,
  limit,
  keyword,
  status,
});
```

这样很好。

不要把 Prisma 的 `where` 写到 Controller 里：

```ts
// 不推荐
return this.prisma.course.findMany({
  where: {
    title: {
      contains: keyword,
    },
  },
});
```

原因：

```txt
Controller 应该不知道数据库怎么查。
Controller 只负责把 HTTP 参数交给 Service。
Service 决定业务层如何组织查询。
```

如果以后查询规则改变，比如：

```txt
只显示 published 课程
普通用户不能看到 draft
管理员可以看到全部
```

这些都应该进入 Service，而不是散在 Controller 里。

## 二十、什么时候需要 Repository

当前课程我们让 `CoursesService` 直接调用 Prisma。

这是可以的。

如果项目继续变复杂，可以拆 Repository：

```txt
CoursesService
  -> 业务规则

CoursesRepository
  -> 数据库查询细节
```

例如：

```ts
@Injectable()
export class CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: number) {
    return this.prisma.course.findUnique({
      where: {
        id,
      },
    });
  }
}
```

什么时候值得拆？

```txt
同一个模型查询逻辑很多。
多个 Service 复用同一组查询。
Service 里 Prisma 查询太长，影响阅读业务规则。
需要隔离 ORM，方便以后替换或测试。
```

什么时候不必拆？

```txt
当前 CRUD 很简单。
只有一个 Service 使用。
拆了只是多一个转发文件。
```

本课建议：

```txt
先不拆 Repository。
等查询复杂起来，再自然拆。
```

## 二十一、常见问题

### 1. 为什么启动时报 `Cannot find module '@prisma/adapter-pg'`？

没有安装 adapter。

执行：

```bash
pnpm add @prisma/adapter-pg pg
pnpm add -D @types/pg
```

### 2. 为什么 `PrismaClient` 导入路径不一样？

看你的 `schema.prisma`：

```prisma
output = "../src/generated/client"
```

所以导入路径是：

```ts
import { PrismaClient } from '../generated/client';
```

如果你生成到其他目录，导入路径要改。

### 3. 为什么 `findOne()` 要抛 `NotFoundException`？

因为接口语义是：

```txt
GET /courses/:id
```

如果这个课程不存在，就应该返回 404。

数据库查不到只返回 `null`，Service 要把它转换成业务异常。

### 4. 为什么创建课程还要查重？数据库不是有唯一约束吗？

查重是为了给用户更友好的错误提示。

唯一约束是最终兜底。

真实项目最好两者都有：

```txt
Service 主动检查
数据库唯一约束兜底
捕获 Prisma 唯一约束错误
```

### 5. 为什么 `findAll()` 要同时查 `items` 和 `total`？

分页接口通常需要：

```txt
当前页数据
符合条件的总数
```

前端需要总数来显示分页器。

所以：

```ts
findMany()
  查当前页数据。

count()
  查符合条件的总数。
```

## 二十二、本节练习任务

### 任务 1：安装 Prisma PostgreSQL adapter

要求：

- 安装 `@prisma/adapter-pg`。
- 安装 `pg`。
- 安装 `@types/pg`。

记录：

```txt
安装的依赖：
```

### 任务 2：创建 PrismaService 和 PrismaModule

要求：

- 创建 `src/prisma/prisma.service.ts`。
- 创建 `src/prisma/prisma.module.ts`。
- `PrismaService` 使用 `ConfigService` 读取 `DATABASE_URL`。
- `PrismaService` 使用 `PrismaPg` adapter。
- `PrismaModule` 导出 `PrismaService`。

记录：

```txt
PrismaService 的 constructor 做了什么：
PrismaModule 为什么要 exports PrismaService：
```

### 任务 3：让 CoursesModule 使用 PrismaModule

要求：

- 在 `CoursesModule` 中导入 `PrismaModule`。
- 确认 `CoursesService` 可以注入 `PrismaService`。

记录：

```txt
CoursesModule imports 当前包含：
```

### 任务 4：改造 CoursesService

要求：

- 删除内存数组。
- 删除 `getNextId()`。
- 使用 `prisma.course.findMany()` 实现列表。
- 使用 `prisma.course.findUnique()` 实现详情。
- 使用 `prisma.course.create()` 实现创建。
- 使用 `prisma.course.update()` 实现更新。
- 使用 `prisma.course.delete()` 实现删除。

记录：

```txt
改造后的 CoursesService 方法：
```

### 任务 5：测试接口

要求：

测试：

```txt
POST /courses
GET /courses
GET /courses/:id
PATCH /courses/:id
DELETE /courses/:id
GET /courses?keyword=xxx
GET /courses?status=published
GET /courses?page=1&limit=10
```

记录：

```txt
创建课程返回：
列表分页返回：
查询不存在课程返回：
```

## 二十三、本节知识输出

请在学习笔记中回答：

1. `PrismaService` 的作用是什么？
2. 为什么 Prisma 7 创建 `PrismaClient` 时需要 driver adapter？
3. 为什么 `PrismaModule` 要 `exports: [PrismaService]`？
4. 为什么不建议 Controller 直接调用 Prisma？
5. `findMany`、`findUnique`、`create`、`update`、`delete` 分别适合什么场景？
6. 分页查询里的 `skip` 和 `take` 是什么意思？
7. 为什么分页列表通常要同时返回 `items` 和 `total`？
8. 什么时候需要拆 Repository？

## 二十四、本节最小验收

- 已安装 `@prisma/adapter-pg`、`pg`、`@types/pg`。
- 已创建 `src/prisma/prisma.service.ts`。
- 已创建 `src/prisma/prisma.module.ts`。
- `CoursesModule` 已导入 `PrismaModule`。
- `CoursesService` 不再使用内存数组。
- 课程 CRUD 使用 Prisma 访问数据库。
- `GET /courses` 支持分页。
- `GET /courses` 支持关键词筛选。
- `GET /courses` 支持状态筛选。
- 查询不存在课程返回 404。
- 重启服务后课程数据仍然存在。
- `pnpm run build` 可以通过。
- `pnpm run lint` 可以通过。

## 二十五、下一节预告

下一节会学习关系查询与事务。

第 11 课我们只把课程 CRUD 改成数据库读写。

第 12 课会继续处理：

```txt
课程和章节的一对多关系
用户报名课程
防止重复报名
事务保证数据一致性
```

到那时，你会真正用到第 10 课建的：

```txt
Lesson
Enrollment
```

## 参考资料

- [Prisma PostgreSQL quickstart](https://docs.prisma.io/docs/prisma-orm/quickstart/postgresql)
- [Prisma PostgreSQL connector](https://www.prisma.io/docs/orm/core-concepts/supported-databases/postgresql)
- [NestJS Prisma recipe](https://docs.nestjs.com/recipes/prisma)
