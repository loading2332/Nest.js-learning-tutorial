# 第 14 课：JWT、Guard 与当前用户

## 本节目标

学完这一节，你要能做到：

- 理解 JWT 是什么，以及它解决什么问题。
- 理解 access token 放在哪里传递。
- 使用 `@nestjs/jwt` 生成 JWT。
- 登录成功后返回 `accessToken`。
- 理解 Guard 在 NestJS 请求流程中的位置。
- 实现 `JwtAuthGuard` 校验登录状态。
- 把当前登录用户挂到 `request.user`。
- 实现自定义 `@CurrentUser()` 装饰器。
- 保护需要登录的接口。
- 把报名接口从“传 userId”改成“使用当前登录用户”。
- 理解 Passport 在 NestJS 认证体系里的位置。

第 13 课我们实现了：

```txt
POST /auth/register
  注册用户，保存 passwordHash。

POST /auth/login
  校验邮箱和密码。
```

但是第 13 课的登录成功后，只能说明：

```txt
这一次请求里的邮箱和密码是正确的。
```

下一次请求时，服务端还不知道你是谁。

第 14 课要解决的问题是：

```txt
登录成功后，客户端拿到一个令牌。
后续请求带着这个令牌。
服务端通过令牌识别当前用户。
```

这个令牌就是：

```txt
JWT access token
```

## 一、为什么需要 Token

HTTP 请求默认是无状态的。

无状态的意思是：

```txt
每一次请求都是独立的。
服务端不会天然记得上一请求是谁发的。
```

例如你先登录：

```txt
POST /auth/login
```

登录成功后，再请求：

```txt
POST /courses/1/enrollments
```

如果第二个请求没有带任何身份信息，服务端就不知道：

```txt
到底是谁要报名课程？
```

最直接的想法是让客户端每次都传：

```json
{
  "userId": 1
}
```

但这样很危险。

因为用户可以随便改：

```json
{
  "userId": 2
}
```

这就变成：

```txt
我可以冒充别人报名课程。
```

所以真实项目里，像报名这种接口不应该相信请求体里的 `userId`。

更合理的方式是：

```txt
登录成功后返回 accessToken。
客户端后续请求带上 accessToken。
服务端验证 accessToken 后得到当前用户 id。
```

也就是：

```txt
客户端不再告诉服务端“我要替 userId=1 报名”。
客户端只告诉服务端“这是我的登录令牌”。
服务端自己从令牌里识别“你是谁”。
```

## 二、JWT 是什么

JWT 全称是 JSON Web Token。

你可以先把它理解成：

```txt
一段带签名的 JSON 信息。
```

JWT 通常长这样：

```txt
xxxxx.yyyyy.zzzzz
```

它由三段组成：

```txt
Header.Payload.Signature
```

含义：

```txt
Header
  说明令牌类型和签名算法。

Payload
  保存一些业务信息，比如用户 id。

Signature
  服务端用密钥签出来的签名，用来防止令牌被篡改。
```

注意：

```txt
JWT 的 Payload 默认不是加密的。
```

也就是说，不要把敏感信息放进 JWT。

不要放：

```txt
password
passwordHash
身份证号
银行卡号
非常敏感的隐私数据
```

本项目的 JWT payload 只放：

```ts
{
  sub: user.id,
  email: user.email,
  role: user.role,
}
```

这里的 `sub` 是 subject 的缩写。

在 JWT 习惯里，`sub` 常用来表示：

```txt
这个 token 属于谁。
```

NestJS 官方认证示例里也使用 `sub` 存用户 id。

## 三、Access Token 应该放在哪里

本课使用最常见的方式：

```txt
Authorization: Bearer <accessToken>
```

请求示例：

```bash
curl http://localhost:3000/courses \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

拆开看：

```txt
Authorization
  HTTP 请求头名称。

Bearer
  令牌类型，意思是“持有这个 token 的请求者”。

accessToken
  登录成功后服务端签发的 JWT。
```

为什么不放在请求体里？

因为 GET 请求通常没有 body。

为什么不放在 query string 里？

因为 URL 容易出现在浏览器历史、日志、代理记录里。

所以 API 项目里常用：

```txt
Authorization header
```

浏览器 Web 项目也可能把 token 放在 HttpOnly Cookie 里。

这是另一套安全权衡，本课先聚焦 Bearer Token。

## 四、Guard 是什么

Guard 可以理解成：

```txt
路由方法执行前的一道门。
```

请求进入 Controller 方法之前，Guard 可以决定：

```txt
允许继续执行
拒绝这个请求
```

例如：

```txt
没有 token
  -> 拒绝，返回 401。

token 无效
  -> 拒绝，返回 401。

token 有效
  -> 放行，请求进入 Controller。
```

NestJS 官方文档里，Guard 通常配合：

```ts
@UseGuards(...)
```

使用。

例如：

```ts
@UseGuards(JwtAuthGuard)
@Post()
create() {
  // 只有通过 JwtAuthGuard 的请求才能进入这里
}
```

Guard 和 Pipe 的区别：

```txt
Pipe
  处理参数转换和参数校验。

Guard
  判断请求是否有资格访问这个接口。
```

Guard 和 Interceptor 的区别：

```txt
Guard
  在 Controller 前决定能不能进。

Interceptor
  可以包住 Controller 前后，常用于统一响应、日志、耗时统计。
```

Guard 和 Exception Filter 的区别：

```txt
Guard
  主动拒绝请求。

Exception Filter
  统一处理已经抛出的异常。
```

## 五、本课要实现的流程

本节会改造登录流程：

```txt
POST /auth/login
  1. 校验邮箱和密码
  2. 生成 JWT
  3. 返回 accessToken
```

然后实现受保护接口：

```txt
请求带 Authorization: Bearer <token>
  -> JwtAuthGuard 解析 token
  -> 校验签名和过期时间
  -> 把当前用户挂到 request.user
  -> Controller 通过 @CurrentUser() 读取当前用户
```

流程图：

```txt
客户端
  -> POST /auth/login
  -> 得到 accessToken

客户端
  -> POST /courses/1/enrollments
  -> Header: Authorization: Bearer accessToken

JwtAuthGuard
  -> 取出 accessToken
  -> verify token
  -> request.user = 当前用户

CoursesController
  -> @CurrentUser('id') userId
  -> coursesService.enroll(courseId, userId)
```

## 六、安装 JWT 依赖

安装 `@nestjs/jwt`：

```bash
pnpm add @nestjs/jwt
```

它提供：

```txt
JwtModule
  在 Nest 模块里配置 JWT。

JwtService
  用来 sign 和 verify token。
```

常用方法：

```ts
this.jwtService.signAsync(payload)
this.jwtService.verifyAsync(token)
```

本课先不安装 Passport。

原因是：

```txt
Passport 很适合复杂认证策略，比如 local、jwt、google、github、多策略组合。
但第一次理解 JWT 时，直接写 JwtAuthGuard 更透明。
```

你会清楚看到：

```txt
token 从哪里取
怎么验证
request.user 从哪里来
@CurrentUser() 怎么拿到它
```

等你理解这条链路后，再看 Passport 的 `Strategy` 和 `AuthGuard('jwt')` 会容易很多。

## 七、确认 JWT_SECRET

第 9 课我们已经配置了：

```txt
JWT_SECRET
```

`.env` 里应该有：

```env
JWT_SECRET=replace-with-your-secret
```

学习项目可以先这样。

真实项目里应该使用更复杂、更长、不可提交到代码仓库的密钥。

注意：

```txt
JWT_SECRET 用来签名和验证 token。
如果泄露，别人可能伪造 token。
```

所以它属于敏感配置。

## 八、定义 JWT 里的用户类型

先定义两个类型：

```txt
JwtPayload
  token 里保存的数据形状。

AuthUser
  request.user 上保存的当前用户形状。
```

创建文件：

```txt
src/auth/types/auth-user.ts
```

写入：

```ts
import { UserRole } from '../../generated/client';

export type JwtPayload = {
  sub: number;
  email: string;
  role: UserRole;
};

export type AuthUser = {
  id: number;
  email: string;
  role: UserRole;
};
```

为什么需要两个类型？

因为 JWT 里我们习惯用：

```ts
sub
```

表示用户 id。

但业务代码里用：

```ts
id
```

更自然。

所以 Guard 校验 token 后，会做一次转换：

```txt
JwtPayload.sub -> AuthUser.id
```

## 九、在 AuthModule 中配置 JwtModule

打开：

```txt
src/auth/auth.module.ts
```

改成：

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '1h',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
```

这里的新概念是：

```ts
JwtModule.registerAsync(...)
```

为什么不用：

```ts
JwtModule.register({
  secret: 'xxx',
})
```

因为 `JWT_SECRET` 来自环境变量。

环境变量是在应用启动时读取的，不适合写死在代码里。

所以使用：

```ts
registerAsync
```

通过 `ConfigService` 读取配置。

关键行解释：

```ts
imports: [ConfigModule]
```

表示这个动态配置需要使用 `ConfigModule`。

```ts
inject: [ConfigService]
```

表示 `useFactory` 需要注入 `ConfigService`。

```ts
secret: configService.getOrThrow<string>('JWT_SECRET')
```

表示没有 `JWT_SECRET` 时直接启动失败。

```ts
expiresIn: '1h'
```

表示 token 1 小时后过期。

过期后，Guard 会拒绝它。

## 十、登录成功后签发 accessToken

现在 `AuthService.login()` 返回用户信息。

第 14 课要改成返回：

```json
{
  "accessToken": "..."
}
```

打开：

```txt
src/auth/auth.service.ts
```

增加 `JwtService` 注入：

```ts
import { JwtService } from '@nestjs/jwt';
```

构造函数改成：

```ts
constructor(
  private readonly usersService: UsersService,
  private readonly jwtService: JwtService,
) {}
```

然后把 `login()` 改成：

```ts
async login(input: LoginDto) {
  const user = await this.usersService.findByEmail(input.email);

  if (!user) {
    throw new UnauthorizedException('email or password is incorrect');
  }

  const isPasswordValid = await verify(user.passwordHash, input.password);

  if (!isPasswordValid) {
    throw new UnauthorizedException('email or password is incorrect');
  }

  const accessToken = await this.jwtService.signAsync({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    accessToken,
  };
}
```

这段代码里，最关键的是：

```ts
this.jwtService.signAsync(...)
```

它会把 payload 签成 JWT。

payload 是：

```ts
{
  sub: user.id,
  email: user.email,
  role: user.role,
}
```

这里不要放：

```txt
passwordHash
```

因为 JWT payload 不是用来保存敏感信息的。

## 十一、创建 JwtAuthGuard

现在登录可以发 token。

下一步是：

```txt
请求接口时校验 token。
```

创建文件：

```txt
src/auth/guards/jwt-auth.guard.ts
```

写入：

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser, JwtPayload } from '../types/auth-user';

type RequestWithUser = Request & {
  user?: AuthUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('missing access token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      throw new UnauthorizedException('invalid access token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

这段代码先看整体职责：

```txt
JwtAuthGuard
  1. 从 Authorization header 取 token
  2. 没有 token 就抛 401
  3. 有 token 就 verify
  4. verify 成功后把用户信息放到 request.user
  5. 返回 true，让请求进入 Controller
```

关键行解释：

```ts
context.switchToHttp().getRequest<RequestWithUser>()
```

Guard 不直接接收 `req` 参数。

它通过 `ExecutionContext` 拿到当前 HTTP 请求对象。

```ts
request.headers.authorization
```

读取请求头：

```txt
Authorization: Bearer xxx
```

```ts
this.jwtService.verifyAsync<JwtPayload>(token, ...)
```

验证 token：

```txt
签名是否正确
是否过期
payload 是否可以解析
```

```ts
request.user = ...
```

把当前用户挂到请求对象上。

这也是很多 Node.js 认证库的常见做法。

NestJS 官方 Guard 文档也会用 `request.user` 表示当前通过认证的用户。

## 十二、把 JwtAuthGuard 注册到 AuthModule

Guard 是 Provider。

如果它需要依赖注入：

```txt
JwtService
ConfigService
```

就要让 Nest 知道它。

打开：

```txt
src/auth/auth.module.ts
```

导入：

```ts
import { JwtAuthGuard } from './guards/jwt-auth.guard';
```

然后加到 `providers`：

```ts
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '1h',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
```

为什么要 `exports: [JwtAuthGuard]`？

因为课程模块也要使用这个 Guard。

如果其他模块想注入或使用 `AuthModule` 里的 provider，需要 `AuthModule` 导出它。

## 十三、在 CoursesModule 中导入 AuthModule

打开：

```txt
src/courses/courses.module.ts
```

加入：

```ts
import { AuthModule } from '../auth/auth.module';
```

然后：

```ts
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
```

这样 `CoursesController` 里才能使用 `JwtAuthGuard`。

注意模块依赖方向：

```txt
CoursesModule -> AuthModule
AuthModule -> UsersModule
UsersModule -> PrismaModule
```

本课没有让 `AuthModule` 再导入 `CoursesModule`。

这样可以避免循环依赖。

## 十四、实现 CurrentUser 装饰器

现在 Guard 已经把用户信息放到了：

```txt
request.user
```

但 Controller 里直接写：

```ts
@Req() req
req.user
```

会让 Controller 依赖 Express 请求对象，代码也不够清爽。

所以我们做一个自定义参数装饰器：

```ts
@CurrentUser()
@CurrentUser('id')
```

创建文件：

```txt
src/auth/decorators/current-user.decorator.ts
```

写入：

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../types/auth-user';

type RequestWithUser = Request & {
  user?: AuthUser;
};

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
```

用法一：

```ts
@CurrentUser() user: AuthUser
```

得到完整当前用户：

```ts
{
  id: 1,
  email: 'alice@example.com',
  role: 'student',
}
```

用法二：

```ts
@CurrentUser('id') userId: number
```

只得到当前用户 id。

NestJS 官方自定义装饰器文档也说明了这种模式：

```txt
从 request.user 里取当前用户，必要时按 key 取某个属性。
```

## 十五、保护创建课程接口

打开：

```txt
src/courses/courses.controller.ts
```

导入：

```ts
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
```

找到创建课程接口：

```ts
@Post()
create(@Body() body: CreateCourseDto) {
  return this.coursesService.create(body);
}
```

改成：

```ts
@UseGuards(JwtAuthGuard)
@Post()
create(@Body() body: CreateCourseDto) {
  return this.coursesService.create(body);
}
```

现在：

```txt
没有 token
  -> 401

token 无效
  -> 401

token 有效
  -> 可以创建课程
```

注意：

```txt
本课只判断是否登录。
第 15 课才判断角色权限。
```

也就是说，现在任何登录用户都能创建课程。

下一课会改成：

```txt
teacher/admin 才能创建课程。
```

## 十六、改造报名接口：不再从 body 传 userId

第 12 课的报名接口是：

```ts
@Post(':courseId/enrollments')
enroll(
  @Param('courseId', ParseIntPipe) courseId: number,
  @Body() body: EnrollCourseDto,
) {
  return this.coursesService.enroll(courseId, body.userId);
}
```

当时为了学习关系和事务，临时从 body 里传：

```json
{
  "userId": 1
}
```

现在要改掉。

因为报名应该使用当前登录用户：

```txt
谁带着 token 请求，谁报名。
```

导入：

```ts
import { CurrentUser } from '../auth/decorators/current-user.decorator';
```

然后改成：

```ts
@UseGuards(JwtAuthGuard)
@Post(':courseId/enrollments')
enroll(
  @Param('courseId', ParseIntPipe) courseId: number,
  @CurrentUser('id') userId: number,
) {
  return this.coursesService.enroll(courseId, userId);
}
```

现在请求体不需要传 `userId`。

请求变成：

```bash
curl -X POST http://localhost:3000/courses/1/enrollments \
  -H "Authorization: Bearer <accessToken>"
```

这比从 body 传 `userId` 安全得多。

原因是：

```txt
body.userId
  客户端可以随便伪造。

@CurrentUser('id')
  来自服务端验证过的 token。
```

如果还有这个导入：

```ts
import { EnrollCourseDto } from './dto/enroll-course.dto';
```

报名接口已经不用它了，可以删除这个导入。

文件本身可以先保留。

## 十七、完整请求测试流程

### 1. 注册用户

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "name": "Alice",
    "password": "pass123456"
  }'
```

如果已经注册过，可以跳过。

### 2. 登录拿 token

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "pass123456"
  }'
```

响应大概是：

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "path": "/auth/login",
  "timestamp": "2026-04-30T00:00:00.000Z"
}
```

如果你没有启用第 8 课的统一响应拦截器，会直接看到：

```json
{
  "accessToken": "..."
}
```

### 3. 不带 token 创建课程

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -d '{
    "title": "JWT 认证入门",
    "description": "学习 access token 和 guard",
    "price": 99,
    "status": "published"
  }'
```

应该返回：

```txt
401 Unauthorized
```

### 4. 带 token 创建课程

```bash
curl -X POST http://localhost:3000/courses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "title": "JWT 认证入门",
    "description": "学习 access token 和 guard",
    "price": 99,
    "status": "published"
  }'
```

应该创建成功。

### 5. 带 token 报名课程

```bash
curl -X POST http://localhost:3000/courses/1/enrollments \
  -H "Authorization: Bearer <accessToken>"
```

注意：

```txt
这里没有 body。
```

服务端会从 token 里拿当前用户 id。

## 十八、Passport 在这里是什么位置

你会看到很多 NestJS 教程使用：

```txt
@nestjs/passport
passport
passport-jwt
```

然后写：

```ts
JwtStrategy
JwtAuthGuard extends AuthGuard('jwt')
```

Passport 可以理解成：

```txt
一个认证策略框架。
```

它把不同认证方式抽象成 strategy：

```txt
LocalStrategy
  邮箱/用户名 + 密码。

JwtStrategy
  JWT token。

GoogleStrategy
  Google OAuth。

GitHubStrategy
  GitHub OAuth。
```

使用 Passport 的好处：

- 多认证策略时结构统一。
- 社区示例多。
- NestJS 官方 recipe 有完整示例。
- 后续接 OAuth 更自然。

但它也会增加概念：

```txt
Strategy
validate()
AuthGuard('jwt')
PassportModule
request.user 是谁设置的
```

所以本课先不用 Passport，而是手写 Guard。

你先理解清楚：

```txt
header -> token -> verify -> request.user -> @CurrentUser()
```

以后迁移到 Passport 时，本质仍然是同一件事。

只不过：

```txt
token 提取和验证
request.user 赋值
```

由 Passport strategy 帮你做。

## 十九、常见问题

### 1. JWT 过期后怎么办？

本课设置：

```txt
expiresIn: '1h'
```

过期后，用户需要重新登录。

真实项目常见方案是：

```txt
access token
  短期有效，比如 15 分钟或 1 小时。

refresh token
  长期一点，用来换新的 access token。
```

refresh token 会引入更多安全问题，比如存储、撤销、轮换。

所以本课程先不展开。

### 2. JWT_SECRET 改了会发生什么？

旧 token 会全部失效。

因为签名密钥变了，服务端就无法验证旧 token。

这在某些场景是好事：

```txt
密钥泄露后，可以更换密钥让旧 token 失效。
```

但在生产环境更换密钥要谨慎，可能导致所有用户重新登录。

### 3. 为什么 token 里还要放 email 和 role？

其实只放：

```ts
sub: user.id
```

也可以。

然后每次请求都根据 `sub` 查数据库。

本课把 `email` 和 `role` 也放进去，是为了后面第 15 课做角色权限时更直观。

但要知道一个取舍：

```txt
JWT 里的信息签发后不会自动更新。
```

如果用户角色从 `student` 改成 `admin`，旧 token 里的 role 还是旧值，直到重新登录或重新签发 token。

真实项目要根据安全要求决定：

```txt
每次都查数据库
还是相信 token 里的 role
```

### 4. 前端要怎么保存 accessToken？

这属于前端安全策略。

常见方式：

```txt
内存变量
localStorage
sessionStorage
HttpOnly Cookie
```

每种都有代价。

本课程先从后端角度讲：

```txt
后续请求需要把 accessToken 放到 Authorization header。
```

如果是生产级 Web 应用，还需要继续学习 XSS、CSRF、Cookie SameSite 等安全问题。

### 5. 为什么 Guard 里校验失败是 401，不是 403？

401 表示：

```txt
你还没有被正确认证。
```

例如：

```txt
没有 token
token 无效
token 过期
```

403 表示：

```txt
我知道你是谁，但你没有权限做这件事。
```

例如：

```txt
学生用户尝试删除课程。
```

所以：

```txt
第 14 课主要是 401。
第 15 课角色权限会出现 403。
```

## 二十、代码练习

请完成以下练习：

1. 安装 `@nestjs/jwt`。
2. 在 `AuthModule` 中配置 `JwtModule.registerAsync()`。
3. 在 `AuthService.login()` 中签发 `accessToken`。
4. 创建 `src/auth/types/auth-user.ts`。
5. 创建 `src/auth/guards/jwt-auth.guard.ts`。
6. 创建 `src/auth/decorators/current-user.decorator.ts`。
7. 在 `AuthModule` 中注册并导出 `JwtAuthGuard`。
8. 在 `CoursesModule` 中导入 `AuthModule`。
9. 用 `@UseGuards(JwtAuthGuard)` 保护创建课程接口。
10. 把报名接口改成从 `@CurrentUser('id')` 获取用户 id。
11. 用 curl 测试不带 token、错误 token、正确 token 三种情况。

## 二十一、知识输出

请用自己的话回答：

1. JWT 由哪三部分组成？
2. JWT payload 为什么不能放敏感信息？
3. `Authorization: Bearer <token>` 每一部分是什么意思？
4. Guard 在请求流程中负责什么？
5. 为什么报名接口不应该继续从 body 里接收 `userId`？
6. `request.user` 是在哪里被设置的？
7. `@CurrentUser()` 解决了什么问题？
8. 401 和 403 的区别是什么？
9. Passport 和本课手写 Guard 的关系是什么？

## 二十二、验收标准

完成后，你应该能做到：

- `pnpm run build` 能通过。
- `pnpm run lint` 能通过。
- `pnpm run test` 能通过。
- `POST /auth/login` 成功后返回 `accessToken`。
- 不带 token 调用受保护接口会返回 401。
- 错误 token 调用受保护接口会返回 401。
- 正确 token 调用受保护接口可以通过。
- 报名接口不再从 body 接收 `userId`。
- 报名接口使用当前登录用户报名。
- 你能解释 `Guard -> request.user -> @CurrentUser()` 这条链路。

## 二十三、本节小结

这一节你完成了登录态的核心链路：

```txt
登录成功
  -> 签发 JWT
  -> 客户端携带 Bearer token
  -> Guard 校验 token
  -> request.user 保存当前用户
  -> @CurrentUser() 读取当前用户
  -> 业务接口使用当前用户执行操作
```

现在项目已经从：

```txt
客户端传 userId
```

升级成：

```txt
服务端通过 token 识别当前用户
```

这是后端认证系统非常关键的一步。

下一节我们会继续：

```txt
角色权限
RBAC
@Roles()
RolesGuard
```

到那时，系统不仅能判断：

```txt
你是谁
```

还会判断：

```txt
你能做什么
```

## 参考资料

- NestJS Passport recipe: https://docs.nestjs.com/recipes/passport
- NestJS Guards: https://docs.nestjs.com/guards
- NestJS Custom decorators: https://docs.nestjs.com/custom-decorators
- JWT Introduction: https://jwt.io/introduction
