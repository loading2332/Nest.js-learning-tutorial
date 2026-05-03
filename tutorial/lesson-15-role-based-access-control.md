# 第 15 课：角色权限与接口安全

## 本节目标

学完这一节，你要能做到：

- 理解认证和授权的区别。
- 理解什么是 RBAC。
- 理解为什么“已登录”不等于“有权限”。
- 理解 `@SetMetadata()`、`Reflector`、`RolesGuard` 各自负责什么。
- 实现 `@Roles()` 自定义装饰器。
- 实现 `RolesGuard`。
- 让创建课程接口只允许 `teacher` 和 `admin`。
- 让删除课程接口只允许 `admin`。
- 能区分 `401 Unauthorized` 和 `403 Forbidden`。
- 能说明权限逻辑为什么不应该散落在每个 Controller 方法里。

第 14 课我们已经完成了：

```txt
登录成功 -> 返回 accessToken
请求带 Bearer token -> JwtAuthGuard 校验
Guard 成功 -> request.user
Controller 通过 @CurrentUser() 读取当前用户
```

这解决的是：

```txt
你是谁
```

但真实业务还要继续判断：

```txt
你能做什么
```

这就是第 15 课要解决的问题。

## 一、认证和授权不是一回事

先把这两个词彻底分开。

认证，英文是 Authentication。

它解决：

```txt
你是谁
```

比如第 14 课的 JWT 登录态，就是认证。

授权，英文是 Authorization。

它解决：

```txt
你能做什么
```

比如：

```txt
学生可以报名课程
老师可以创建课程
管理员可以删除课程
```

所以：

```txt
已登录
  不等于
有权限
```

一个已经登录的学生用户，依然不应该能删除课程。

这也是为什么第 14 课的 `JwtAuthGuard` 还不够。

它只能保证：

```txt
这个请求的用户身份是真的
```

但它还不能保证：

```txt
这个用户有资格访问这个接口
```

## 二、什么是 RBAC

RBAC 是 Role-Based Access Control，基于角色的访问控制。

你可以先把它理解成：

```txt
先给用户一个角色
再根据角色决定接口权限
```

本项目里我们已经有角色枚举：

```prisma
enum UserRole {
  student
  teacher
  admin
}
```

这几个角色的业务含义可以先约定成：

```txt
student
  普通学员，可以浏览课程、报名课程。

teacher
  教师，可以创建课程、维护课程内容。

admin
  管理员，可以做更高权限操作，比如删除课程。
```

这就是最基础的 RBAC 思路：

```txt
用户 -> 角色 -> 权限
```

它的好处是：

- 规则容易理解。
- 接口权限能集中管理。
- 比“在每个方法里手写 if 判断”更清晰。
- 后续扩展新角色时，结构也比较稳定。

当然，RBAC 不是唯一方案。

更复杂的系统还可能做：

```txt
按资源归属授权
按组织授权
按字段授权
按操作粒度授权
```

但对当前这个学习项目，RBAC 已经足够合适。

## 三、本课要实现什么权限规则

我们先实现一组很直观的规则：

```txt
创建课程
  teacher / admin 才能访问

删除课程
  只有 admin 才能访问

报名课程
  任何已登录用户都可以访问
```

注意这三个接口的层次关系：

```txt
报名课程
  只要求登录

创建课程
  要求登录 + 角色符合

删除课程
  要求登录 + 更高角色权限
```

这正好能把：

```txt
JwtAuthGuard
RolesGuard
```

两层职责分开。

## 四、为什么权限判断不应该直接写在 Controller 方法里

你当然可以在 Controller 里手写：

```ts
if (user.role !== 'admin') {
  throw new ForbiddenException('forbidden');
}
```

但这样会很快出问题。

问题主要有这几个：

- 每个接口都自己写一遍，重复很多。
- 权限规则散落在不同方法里，不容易统一看。
- 后面新增角色时，要到处改判断条件。
- Controller 会越来越像业务和权限逻辑的混合体。
- 很难一眼看出“这个接口需要什么权限”。

更好的方式是：

```txt
把“这个接口需要哪些角色”写成声明
把“如何判断角色是否满足”收口到 Guard
```

也就是：

```ts
@Roles(UserRole.teacher, UserRole.admin)
@UseGuards(JwtAuthGuard, RolesGuard)
@Post()
create() {}
```

这样 Controller 表达的是：

```txt
这个接口需要 teacher 或 admin
```

而不是把判断细节塞在方法体里。

## 五、Metadata 是什么

这一课第一次会碰到一个新概念：

```txt
metadata
```

先不要把它想复杂。

你可以把 metadata 理解成：

```txt
附着在类或方法上的“额外说明信息”
```

比如：

```txt
这个接口需要哪些角色
这个接口是否公开
这个接口是否需要某种特殊处理
```

它不是业务数据，也不是请求参数。

它更像是：

```txt
给框架看的配置说明
```

本课里我们会把“这个接口需要哪些角色”写进 metadata。

然后 `RolesGuard` 再把这些 metadata 读出来。

也就是说：

```txt
@Roles(...)
  负责写 metadata

RolesGuard
  负责读 metadata 并做权限判断
```

## 六、`@SetMetadata()` 是做什么的

Nest 官方在权限相关文档里会使用：

```ts
@SetMetadata(...)
```

它的作用就是：

```txt
把一段 metadata 挂到类或方法上
```

本课里我们要挂的是：

```txt
这个接口允许哪些角色访问
```

所以会有一个自定义装饰器：

```ts
@Roles(UserRole.teacher, UserRole.admin)
```

而这个 `@Roles()` 内部其实就是调用了：

```ts
SetMetadata('roles', [...])
```

这里的核心思路是：

```txt
Controller 不负责解释权限规则
Controller 只负责声明权限规则
```

## 七、`Reflector` 是做什么的

既然 metadata 写到了方法上，就需要有人把它读出来。

这个“读取 metadata 的工具”就是：

```txt
Reflector
```

你可以把它理解成：

```txt
Nest 提供的 metadata 读取器
```

在本课里，`RolesGuard` 会做这样的事：

```txt
1. 看当前路由方法上有没有 roles metadata
2. 如果有，拿到要求的角色列表
3. 再和当前登录用户的 role 比较
4. 决定放行还是拒绝
```

所以：

```txt
SetMetadata
  负责写

Reflector
  负责读
```

这两个通常是成对出现的。

## 八、`RolesGuard` 解决什么问题

`RolesGuard` 的职责非常单纯：

```txt
看当前用户的角色是否满足接口要求
```

它不负责：

```txt
验证 token
解析 Authorization header
识别当前登录用户
```

这些事已经由第 14 课的 `JwtAuthGuard` 完成。

所以本课的权限链路应该是：

```txt
1. JwtAuthGuard
   确认用户已登录，写入 request.user

2. RolesGuard
   读取路由需要的角色，判断 request.user.role 是否符合
```

这是很重要的职责拆分。

你应该形成这个思维模型：

```txt
JwtAuthGuard
  负责“认人”

RolesGuard
  负责“看这个人能不能做这件事”
```

## 九、401 和 403 的区别

这一课里很容易混两个状态码。

`401 Unauthorized` 的意思是：

```txt
你还没有通过认证
```

比如：

```txt
没带 token
token 无效
token 过期
```

`403 Forbidden` 的意思是：

```txt
我已经知道你是谁了
但你没有权限访问这个资源
```

比如：

```txt
学生用户去访问“删除课程”
```

所以：

```txt
JwtAuthGuard 常见返回 401
RolesGuard 常见返回 403
```

这两个状态码背后的语义千万不要混。

## 十、当前项目里已经有哪些基础

在开始写代码前，先看你现在已经有的东西：

```txt
UserRole 枚举
JWT 登录
JwtAuthGuard
request.user
@CurrentUser()
```

并且第 14 课的登录 token 里已经包含：

```ts
{
  sub: user.id,
  email: user.email,
  role: user.role,
}
```

这意味着：

```txt
RolesGuard 已经可以直接从 request.user.role 读取角色
```

所以第 15 课不需要再重做认证。

只需要在现有认证链路上加授权。

## 十一、创建 `@Roles()` 装饰器

先创建文件：

```txt
src/auth/decorators/roles.decorator.ts
```

写入：

```ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../generated/client';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

先解释这段代码在做什么：

```txt
ROLES_KEY
  metadata 的名字，后面 RolesGuard 会按这个 key 去读取。

Roles(...roles)
  一个自定义装饰器，接收任意数量的角色。

SetMetadata(ROLES_KEY, roles)
  把这些角色写到路由方法的 metadata 上。
```

使用时可以写：

```ts
@Roles(UserRole.teacher, UserRole.admin)
```

这句话的业务含义就是：

```txt
这个接口只允许 teacher 或 admin 访问
```

## 十二、实现 `RolesGuard`

创建文件：

```txt
src/auth/guards/roles.guard.ts
```

写入：

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserRole } from '../../generated/client';
import { AuthUser } from '../types/auth-user';
import { ROLES_KEY } from '../decorators/roles.decorator';

type RequestWithUser = Request & {
  user?: AuthUser;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      return false;
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException('forbidden');
    }

    return true;
  }
}
```

这段代码建议你分四层理解。

### 第一层：先读路由要求的角色

```ts
const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
  ROLES_KEY,
  [context.getHandler(), context.getClass()],
);
```

意思是：

```txt
读取当前路由方法或当前 controller 类上的 roles metadata
```

这里为什么传：

```ts
[context.getHandler(), context.getClass()]
```

因为 Nest 允许你把装饰器写在：

```txt
方法上
类上
```

`getAllAndOverride()` 的意思可以先理解成：

```txt
按顺序查找 metadata
谁离当前方法更近，就优先用谁
```

本课先主要在方法级别使用它。

### 第二层：如果接口没声明角色要求，就直接放行

```ts
if (!requiredRoles || requiredRoles.length === 0) {
  return true;
}
```

这表示：

```txt
只有写了 @Roles(...) 的接口才做角色判断
```

没写 `@Roles()` 的接口，`RolesGuard` 不拦它。

### 第三层：从 request.user 取当前登录用户

```ts
const request = context.switchToHttp().getRequest<RequestWithUser>();
const user = request.user;
```

这里的前提是：

```txt
JwtAuthGuard 已经先执行过，并且把 user 写进了 request.user
```

所以 `RolesGuard` 不负责识别用户是谁，它只负责读取这个结果。

### 第四层：判断用户角色是否命中

```ts
const hasRole = requiredRoles.includes(user.role);

if (!hasRole) {
  throw new ForbiddenException('forbidden');
}
```

意思就是：

```txt
如果当前用户 role 不在允许列表里，就返回 403
```

这就是最核心的授权判断。

## 十三、在 `AuthModule` 中注册并导出 `RolesGuard`

打开：

```txt
src/auth/auth.module.ts
```

导入：

```ts
import { RolesGuard } from './guards/roles.guard';
```

然后改成：

```ts
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  controllers: [AuthController],
  exports: [JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
```

为什么这里也要 `exports: [RolesGuard]`？

因为课程模块里的 Controller 要使用它。

这和第 14 课导出 `JwtAuthGuard` 的原因完全一样：

```txt
AuthModule 内部定义了一个可复用的 Guard
其他模块想用，就要导出
```

## 十四、在 Controller 上使用多个 Guard

现在一个需要角色权限的接口，应该同时经过两道判断：

```txt
1. 先确认你已登录
2. 再确认你角色符合
```

所以 Controller 里要这样写：

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
```

Guard 的执行顺序就是从左到右。

也就是说：

```txt
先跑 JwtAuthGuard
再跑 RolesGuard
```

这很重要。

因为 `RolesGuard` 依赖：

```txt
request.user
```

而 `request.user` 是 `JwtAuthGuard` 先写进去的。

## 十五、限制创建课程：只允许 teacher / admin

打开：

```txt
src/courses/courses.controller.ts
```

导入：

```ts
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../generated/client';
```

然后把创建课程接口改成：

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.teacher, UserRole.admin)
@Post()
create(@Body() body: CreateCourseDto) {
  return this.coursesService.create(body);
}
```

先看这三行各自表达什么：

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
```

表示：

```txt
这个接口先做登录校验，再做角色校验
```

```ts
@Roles(UserRole.teacher, UserRole.admin)
```

表示：

```txt
允许 teacher 和 admin
```

```ts
@Post()
```

表示：

```txt
这是创建课程接口
```

所以整段声明翻译成中文就是：

```txt
创建课程接口，需要已登录，并且角色是 teacher 或 admin
```

## 十六、限制删除课程：只允许 admin

同样在 `CoursesController` 中，把删除接口改成：

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@Delete(':id')
remove(@Param('id', ParseIntPipe) id: number) {
  return this.coursesService.remove(id);
}
```

这段就更直观了：

```txt
删除课程接口，需要已登录，并且角色必须是 admin
```

如果你想进一步收紧权限，也可以把：

```txt
创建章节
更新课程
```

这些接口一起纳入角色限制。

但本课先聚焦两件最典型的事：

```txt
创建课程
删除课程
```

## 十七、为什么报名接口不需要 `RolesGuard`

第 14 课的报名接口已经改成了：

```txt
从 token 识别当前用户
```

本课不需要再给它加角色限制。

原因是当前业务规则是：

```txt
任何已登录用户都可以报名课程
```

所以报名接口只需要：

```ts
@UseGuards(JwtAuthGuard)
```

不需要：

```ts
@Roles(...)
@UseGuards(JwtAuthGuard, RolesGuard)
```

这也说明一件事：

```txt
不是所有登录接口都需要角色 Guard
只有真的有角色约束时才加
```

## 十八、一个完整的权限判断流程

假设有一个学生用户访问：

```txt
DELETE /courses/1
```

请求头里带了有效 token。

流程会是：

```txt
1. JwtAuthGuard 执行
   -> token 有效
   -> request.user = { id, email, role: 'student' }

2. RolesGuard 执行
   -> 读到 @Roles(UserRole.admin)
   -> 当前用户 role 是 student
   -> 不满足
   -> 抛 ForbiddenException

3. 最终响应
   -> 403 Forbidden
```

而如果是一个老师用户访问：

```txt
POST /courses
```

流程就是：

```txt
1. JwtAuthGuard 通过
2. RolesGuard 读到 teacher/admin
3. 当前用户 role 是 teacher
4. 命中允许列表
5. 放行进入 Controller
```

这就是认证和授权叠加后的完整效果。

## 十九、角色放在 JWT 里有没有问题

这节课为了让链路简单，我们直接把：

```txt
role
```

放进了 JWT payload。

这样 `RolesGuard` 可以直接从：

```txt
request.user.role
```

读取角色，不需要每次查数据库。

这有一个明显优点：

```txt
实现简单
请求少一次数据库查询
```

但也有一个代价：

```txt
如果用户角色在数据库里被改了，旧 token 里的 role 不会自动更新
```

也就是说：

```txt
数据库 role 已经变了
但用户没重新登录
那旧 token 里还是旧角色
```

学习项目里，这个取舍可以接受。

真实项目要根据安全要求判断：

```txt
是否每次请求都重新查数据库确认角色
```

本课先优先理解权限机制本身。

## 二十、测试建议

为了验证这一课，你至少应该测试四种情况。

### 1. 未登录访问创建课程

```txt
预期：401
```

因为连认证都没通过。

### 2. 学生用户访问创建课程

```txt
预期：403
```

因为用户已登录，但角色不符合。

### 3. 老师用户访问创建课程

```txt
预期：成功
```

因为角色命中允许列表。

### 4. 老师用户访问删除课程

```txt
预期：403
```

因为删除课程只允许 `admin`。

## 二十一、代码练习

请完成以下练习：

1. 创建 `src/auth/decorators/roles.decorator.ts`。
2. 创建 `src/auth/guards/roles.guard.ts`。
3. 在 `AuthModule` 中注册并导出 `RolesGuard`。
4. 在 `CoursesController` 中导入 `Roles`、`RolesGuard`、`UserRole`。
5. 为创建课程接口加：
   `@UseGuards(JwtAuthGuard, RolesGuard)`
   `@Roles(UserRole.teacher, UserRole.admin)`
6. 为删除课程接口加：
   `@UseGuards(JwtAuthGuard, RolesGuard)`
   `@Roles(UserRole.admin)`
7. 保持报名接口只使用 `JwtAuthGuard`。
8. 准备至少两个不同角色的测试用户。
9. 分别测试未登录、学生、老师、管理员访问不同接口的结果。

## 二十二、知识输出

请用自己的话回答：

1. 认证和授权有什么区别？
2. 为什么“已登录”不等于“有权限”？
3. 什么是 RBAC？
4. `@Roles()` 的作用是什么？
5. `Reflector` 在本课里负责什么？
6. `RolesGuard` 和 `JwtAuthGuard` 的职责边界是什么？
7. 为什么权限判断不建议直接写在 Controller 方法体里？
8. 401 和 403 的区别是什么？
9. 为什么把 role 放进 JWT 会有“旧 token 角色滞后”的问题？

## 二十三、验收标准

完成后，你应该能做到：

- `pnpm run build` 能通过。
- `pnpm run lint` 能通过。
- `pnpm run test` 能通过。
- 创建课程接口未登录时返回 401。
- 创建课程接口学生访问时返回 403。
- 创建课程接口老师访问时可以成功。
- 删除课程接口只有 admin 可以成功。
- 报名接口仍然只要求登录。
- 你能解释 `@Roles() -> metadata -> Reflector -> RolesGuard` 这条链路。

## 二十四、本节小结

这一节你在第 14 课“认人”的基础上，又加了一层“判断是否有资格”：

```txt
JwtAuthGuard
  负责认证

RolesGuard
  负责授权
```

你现在的项目已经可以表达：

```txt
谁登录了
谁能创建课程
谁能删除课程
```

这让接口安全从：

```txt
只区分登录 / 未登录
```

升级成：

```txt
还能区分不同角色的能力边界
```

下一节我们会进入工程质量阶段，开始把前面这条业务链路用测试真正保护起来。

## 参考资料

- NestJS Authorization: https://docs.nestjs.com/security/authorization
- NestJS Guards: https://docs.nestjs.com/guards
- NestJS Execution context: https://docs.nestjs.com/fundamentals/execution-context
- NestJS Custom decorators: https://docs.nestjs.com/custom-decorators
