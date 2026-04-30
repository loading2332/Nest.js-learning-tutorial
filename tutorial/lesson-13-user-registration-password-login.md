# 第 13 课：用户注册、密码处理与登录

## 本节目标

学完这一节，你要能做到：

- 理解注册和登录分别在做什么。
- 理解认证和授权的区别。
- 知道为什么不能明文保存密码。
- 使用 Argon2 对密码做哈希。
- 给 `User` 模型增加 `passwordHash` 字段。
- 实现用户注册接口。
- 实现用户登录接口。
- 登录失败时返回统一且安全的错误信息。
- 返回用户信息时不暴露密码哈希。

第 12 课我们完成了：

```txt
Course -> Lesson
User -> Enrollment -> Course
```

现在系统里已经有 `User` 模型，但用户还不能真正“注册”和“登录”。

第 13 课开始进入第四阶段：

```txt
认证、授权与安全
```

这一节只做账号密码登录。

JWT 放到第 14 课。

## 一、本课要解决什么问题

现在项目里的用户模块还比较简单：

```txt
GET /users
  返回用户列表
```

而真实项目至少需要：

```txt
POST /auth/register
  用户注册

POST /auth/login
  用户登录
```

注册的本质是：

```txt
把一个新用户保存到数据库。
```

登录的本质是：

```txt
证明“你知道这个账号对应的密码”。
```

注意，登录不是“查询用户是否存在”这么简单。

登录需要验证：

```txt
1. 这个邮箱有没有注册
2. 请求里的密码是否能匹配数据库中的密码哈希
3. 匹配成功后，返回一个安全的登录结果
```

本节先让登录成功后返回用户基础信息：

```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice",
  "role": "student"
}
```

第 14 课再把返回值改成：

```json
{
  "accessToken": "..."
}
```

## 二、认证和授权的区别

这两个词很容易混。

认证，英文是 Authentication。

它回答的问题是：

```txt
你是谁？
```

例如：

```txt
邮箱 + 密码登录
短信验证码登录
扫码登录
JWT 校验当前用户身份
```

授权，英文是 Authorization。

它回答的问题是：

```txt
你能做什么？
```

例如：

```txt
普通学生不能创建课程
老师可以创建课程
管理员可以删除课程
```

本节做的是认证的第一步：

```txt
注册账号
校验账号密码
```

第 14 课继续做：

```txt
登录后发放 JWT
请求接口时识别当前用户
```

第 15 课再做：

```txt
角色权限
```

## 三、为什么不能明文保存密码

假设数据库这样保存密码：

```txt
email              password
alice@example.com  123456
```

一旦数据库泄露，攻击者直接拿到用户密码。

更糟糕的是，很多人会在多个网站使用相同密码。

所以后端永远不应该保存明文密码。

正确做法是保存密码哈希：

```txt
email              passwordHash
alice@example.com  $argon2id$v=19$m=65536,t=3,p=4$...
```

哈希可以理解为：

```txt
把原始密码经过不可逆计算，变成一段摘要。
```

登录时不是把哈希“解密”回密码。

而是：

```txt
用户输入密码
  -> 用同一种算法验证它是否匹配数据库中的哈希
```

这里有一个关键点：

```txt
哈希不是加密。
```

加密通常可以解密。

密码哈希不应该能被还原。

NestJS 官方认证文档也强调：真实应用中不要存明文密码，而应该保存密码哈希。OWASP 密码存储建议也推荐使用现代的自适应密码哈希算法，例如 Argon2id、bcrypt、PBKDF2。

本课选择：

```txt
argon2
```

原因是：

- 它适合密码哈希。
- 默认使用 Argon2id。
- Node.js 中使用简单。
- 不需要你自己管理 salt。

## 四、本课接口设计

本课新增一个独立的认证模块：

```txt
src/auth
```

接口设计：

```txt
POST /auth/register
  注册用户

POST /auth/login
  登录用户
```

请求体：

```json
{
  "email": "alice@example.com",
  "name": "Alice",
  "password": "pass123456"
}
```

登录请求体：

```json
{
  "email": "alice@example.com",
  "password": "pass123456"
}
```

为什么放在 `auth` 模块，而不是直接放到 `users` 模块？

因为两者关注点不同：

```txt
UsersModule
  管理用户数据。

AuthModule
  处理注册、登录、认证相关流程。
```

当前项目可以让：

```txt
AuthService -> UsersService -> PrismaService
```

这样 `AuthService` 不直接关心数据库细节。

## 五、安装密码哈希依赖

先安装 `argon2`：

```bash
pnpm add argon2
```

`argon2` 提供两个核心方法：

```ts
argon2.hash(password)
argon2.verify(passwordHash, password)
```

含义：

```txt
hash()
  注册时使用，把明文密码变成密码哈希。

verify()
  登录时使用，验证明文密码是否匹配已有哈希。
```

注意：

```txt
不要自己用 Math.random() 生成 salt。
不要自己拼接密码和 salt。
不要把密码用 MD5 或 SHA256 简单 hash 后保存。
```

密码存储是安全领域的成熟问题，优先使用成熟库。

## 六、给 User 模型增加 passwordHash

打开：

```txt
prisma/schema.prisma
```

把 `User` 模型改成：

```prisma
model User {
  id           Int          @id @default(autoincrement())
  email        String       @unique
  name         String
  passwordHash String
  role         UserRole     @default(student)
  enrollments  Enrollment[]
  createAt     DateTime     @default(now())
  updateAt     DateTime     @updatedAt
}
```

新增字段是：

```prisma
passwordHash String
```

这表示：

```txt
users 表里要新增一列 passwordHash。
它是必填字符串。
以后只保存哈希，不保存 password。
```

为什么字段名叫 `passwordHash`，不叫 `password`？

因为数据库里保存的不是原始密码。

字段名直接表达真实含义，可以减少误解。

## 七、执行迁移

修改 Prisma schema 后，需要生成数据库迁移。

执行：

```bash
pnpm exec prisma migrate dev --name add-user-password-hash
```

然后重新生成 Prisma Client：

```bash
pnpm exec prisma generate
```

如果你的开发数据库里已经有旧用户，Prisma 可能会提示：

```txt
Added the required column `passwordHash` to the `User` table without a default value.
```

原因是：

```txt
旧数据已经存在。
现在新增一个必填字段。
但旧用户没有 passwordHash。
数据库不知道该给旧行填什么。
```

如果这是学习项目，数据不重要，可以重置开发数据库：

```bash
pnpm exec prisma migrate reset
```

然后再执行迁移和生成：

```bash
pnpm exec prisma migrate dev
pnpm exec prisma generate
```

生产项目不能随便 reset。

生产项目通常会分几步做：

```txt
1. 先新增可空字段
2. 写脚本补全历史数据
3. 再把字段改成必填
```

本课是学习项目，可以优先走最短路径。

## 八、创建注册 DTO

DTO 是请求体的形状和校验规则。

注册接口需要三个字段：

```txt
email
name
password
```

创建文件：

```txt
src/auth/dto/register.dto.ts
```

写入：

```ts
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
```

关键点解释：

```txt
@IsEmail()
  校验 email 格式。

@MinLength(8)
  密码至少 8 位。

@MaxLength(72)
  限制密码长度，避免异常长的输入消耗过多资源。
```

这里的密码规则先保持简单。

真实项目还可能加入：

```txt
禁止常见弱密码
检查密码泄露库
限制登录尝试次数
多因素认证
```

但不要一开始就把规则写得很复杂。

复杂密码规则不一定真的更安全，反而可能让用户形成不好的密码习惯。

## 九、创建登录 DTO

登录接口需要：

```txt
email
password
```

创建文件：

```txt
src/auth/dto/login.dto.ts
```

写入：

```ts
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
```

为什么登录也要 DTO？

因为登录接口也是外部输入。

后端不能相信请求体一定长这样：

```json
{
  "email": "alice@example.com",
  "password": "pass123456"
}
```

如果不校验，可能收到：

```json
{
  "email": 123,
  "password": null
}
```

DTO 的职责是把非法输入挡在业务逻辑外面。

## 十、改造 UsersService

现在 `UsersService` 还在使用内存数组。

第 13 课要让它使用数据库。

目标是给认证模块提供三个能力：

```txt
findAll()
  查询用户列表，但不返回 passwordHash。

findByEmail(email)
  登录和注册查重时使用。

create(input)
  注册时创建用户。
```

打开：

```txt
src/users/users.module.ts
```

导入 `PrismaModule`，并导出 `UsersService`：

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

这里新增两个点。

第一个：

```ts
imports: [PrismaModule]
```

表示 `UsersService` 可以注入 `PrismaService`。

第二个：

```ts
exports: [UsersService]
```

表示其他模块导入 `UsersModule` 后，可以使用 `UsersService`。

后面 `AuthModule` 就需要这一点。

然后修改：

```txt
src/users/users.service.ts
```

写成：

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../generated/client';

type CreateUserInput = {
  email: string;
  name: string;
  passwordHash: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createAt: true,
        updateAt: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email,
      },
    });
  }

  create(input: CreateUserInput) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        role: UserRole.student,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createAt: true,
        updateAt: true,
      },
    });
  }
}
```

这里最重要的是 `select`。

`select` 表示：

```txt
只返回指定字段。
```

我们故意没有选择：

```txt
passwordHash
```

原因是：

```txt
密码哈希也属于敏感信息。
即使它不是明文密码，也不应该出现在接口响应里。
```

`findByEmail()` 没有用 `select`，是因为登录时需要拿到：

```txt
passwordHash
```

用于 `argon2.verify()`。

但 `findByEmail()` 只给服务内部使用，不直接作为接口返回。

## 十一、创建 AuthModule

认证逻辑单独放到：

```txt
src/auth
```

可以用 Nest CLI 创建：

```bash
pnpm nest g module auth
pnpm nest g service auth
pnpm nest g controller auth
```

也可以手动创建这些文件：

```txt
src/auth/auth.module.ts
src/auth/auth.service.ts
src/auth/auth.controller.ts
src/auth/dto/register.dto.ts
src/auth/dto/login.dto.ts
```

`AuthModule` 需要使用 `UsersService`。

打开：

```txt
src/auth/auth.module.ts
```

写入：

```ts
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
```

这段代码的意思是：

```txt
AuthModule 导入 UsersModule。
所以 AuthService 可以注入 UsersService。
```

注意：

```txt
只有 UsersModule exports 了 UsersService，AuthModule 才能注入它。
```

## 十二、实现 AuthService

`AuthService` 负责认证流程。

它不负责直接操作数据库表。

它负责组织这些步骤：

```txt
注册：
  1. 检查 email 是否已存在
  2. 对密码做 hash
  3. 创建用户
  4. 返回安全的用户信息

登录：
  1. 根据 email 查用户
  2. 校验密码
  3. 登录成功后返回安全的用户信息
```

打开：

```txt
src/auth/auth.service.ts
```

写入：

```ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async register(input: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(input.email);

    if (existingUser) {
      throw new BadRequestException('email already registered');
    }

    const passwordHash = await argon2.hash(input.password);

    return this.usersService.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });
  }

  async login(input: LoginDto) {
    const user = await this.usersService.findByEmail(input.email);

    if (!user) {
      throw new UnauthorizedException('email or password is incorrect');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      input.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('email or password is incorrect');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
```

这里有几个关键点。

### 1. 为什么注册前要查重

因为 `email` 在 Prisma schema 中是唯一字段：

```prisma
email String @unique
```

如果重复创建，数据库会报唯一约束错误。

我们提前查重，是为了返回更清楚的业务错误：

```txt
email already registered
```

但注意：

```txt
业务代码查重不是最终保障。
数据库唯一约束才是最终保障。
```

高并发场景下，两个注册请求可能同时通过查重，然后同时创建。

后面可以再专门处理 Prisma 唯一约束错误。

### 2. 为什么登录失败统一返回同一个错误

你可能会想：

```txt
邮箱不存在：user not found
密码错误：password incorrect
```

但这会泄露信息。

攻击者可以用接口判断哪些邮箱注册过。

所以登录失败建议统一返回：

```txt
email or password is incorrect
```

这样不会告诉对方到底是邮箱错，还是密码错。

### 3. 为什么登录成功不能返回 passwordHash

`findByEmail()` 查出来的用户包含 `passwordHash`。

但接口响应不能返回它。

所以这里手动组装：

```ts
return {
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
};
```

真实项目中也可以封装一个方法：

```ts
toSafeUser(user)
```

当前先不抽象，避免文件过多。

## 十三、实现 AuthController

Controller 负责接收 HTTP 请求。

认证的业务流程交给 `AuthService`。

打开：

```txt
src/auth/auth.controller.ts
```

写入：

```ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }
}
```

这里出现了一个新装饰器：

```ts
@HttpCode(HttpStatus.OK)
```

默认情况下，`POST` 成功会返回：

```txt
201 Created
```

注册接口创建了新用户，返回 `201` 是合理的。

登录接口没有创建资源，只是验证身份。

所以我们把登录成功状态码改成：

```txt
200 OK
```

这就是 `@HttpCode(HttpStatus.OK)` 的作用。

## 十四、把 AuthModule 加入 AppModule

模块创建后，还要挂到根模块。

打开：

```txt
src/app.module.ts
```

导入：

```ts
import { AuthModule } from './auth/auth.module';
```

然后加入 `imports`：

```ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    CoursesModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

现在应用启动时就会加载认证模块。

## 十五、测试注册接口

启动项目：

```bash
pnpm run start:dev
```

发送注册请求：

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "name": "Alice",
    "password": "pass123456"
  }'
```

成功响应大概是：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "email": "alice@example.com",
    "name": "Alice",
    "role": "student",
    "createAt": "2026-04-30T00:00:00.000Z",
    "updateAt": "2026-04-30T00:00:00.000Z"
  }
}
```

如果你第 8 课的统一响应拦截器已经启用，外层会有：

```txt
code
message
data
```

如果没有启用统一响应，则会直接返回用户对象。

检查数据库时，你应该看到：

```txt
passwordHash 是一长串哈希。
不是 pass123456。
```

## 十六、测试登录接口

发送登录请求：

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "pass123456"
  }'
```

成功响应大概是：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "email": "alice@example.com",
    "name": "Alice",
    "role": "student"
  }
}
```

错误密码：

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "wrong-password"
  }'
```

应该返回：

```txt
401 Unauthorized
```

错误信息类似：

```json
{
  "code": 401,
  "message": "email or password is incorrect",
  "path": "/auth/login"
}
```

具体格式取决于你第 7 课写的异常过滤器。

## 十七、为什么本节不返回 JWT

登录接口通常会返回 token。

但本节先不做。

原因是 JWT 涉及几个新概念：

```txt
token
payload
signature
secret
expiresIn
Authorization header
Bearer token
Guard
当前用户
```

如果全部塞到这一节，会导致你只是把代码粘上去，却没有真正理解。

所以第 13 课只负责：

```txt
账号密码是否正确
密码如何安全保存
AuthModule 如何组织
```

第 14 课再负责：

```txt
登录成功后如何发 JWT
接口如何校验 JWT
如何拿到当前登录用户
```

## 十八、常见问题

### 1. 为什么不用 bcrypt？

可以用。

NestJS 官方文档示例里经常用 bcrypt 说明密码哈希。

但 OWASP 当前更推荐新项目优先考虑 Argon2id。

`argon2` 这个 Node 包默认就是 Argon2id，接口也很简单。

所以本课选择它。

如果你的部署环境安装原生依赖不方便，bcrypt 也是常见选择。

### 2. passwordHash 要不要加 `@unique`？

不要。

唯一的是邮箱：

```prisma
email String @unique
```

密码哈希不应该作为唯一身份标识。

两个用户使用相同密码时，最终哈希一般也不同，因为算法会使用 salt。

### 3. 注册接口要不要返回登录态？

看业务。

有些产品注册成功后直接登录。

有些产品注册成功后要求邮箱验证。

本课先返回用户基础信息。

第 14 课学完 JWT 后，你可以选择：

```txt
注册成功直接返回 accessToken
```

或者：

```txt
注册成功后让用户再调用 login
```

### 4. 为什么最大密码长度限制为 72？

这是一个保守的教学设置。

在一些算法和库里，过长密码可能带来额外处理成本，bcrypt 还存在 72 字节截断问题。

Argon2 没有 bcrypt 的同类截断问题，但接口层仍然应该限制极端输入长度，避免有人传超大字符串消耗资源。

真实项目可以结合安全策略调整，例如允许更长的 passphrase。

## 十九、代码练习

请完成以下练习：

1. 安装 `argon2`。
2. 给 `User` 模型增加 `passwordHash` 字段。
3. 执行 Prisma 迁移和生成。
4. 创建 `AuthModule`、`AuthService`、`AuthController`。
5. 创建 `RegisterDto` 和 `LoginDto`。
6. 改造 `UsersService`，让它使用数据库。
7. 实现 `POST /auth/register`。
8. 实现 `POST /auth/login`。
9. 确认接口响应中没有 `passwordHash`。
10. 用错误密码测试登录失败。

## 二十、知识输出

请用自己的话回答：

1. 注册和登录分别在做什么？
2. 认证和授权有什么区别？
3. 为什么密码哈希不是加密？
4. 为什么登录失败时不建议区分“邮箱不存在”和“密码错误”？
5. 为什么接口响应不能返回 `passwordHash`？
6. `AuthModule` 和 `UsersModule` 的职责分别是什么？

## 二十一、验收标准

完成后，你应该能做到：

- `pnpm run build` 能通过。
- `pnpm run lint` 能通过。
- `POST /auth/register` 可以创建用户。
- 数据库中的用户保存的是 `passwordHash`，不是明文密码。
- `POST /auth/login` 可以校验邮箱和密码。
- 密码错误时返回 `401 Unauthorized`。
- 登录失败不会泄露用户是否存在。
- `/users` 接口不会返回 `passwordHash`。

## 二十二、本节小结

这一节你完成了认证系统的第一块拼图：

```txt
用户注册
密码哈希保存
账号密码登录
安全错误提示
```

你现在应该形成一个重要习惯：

```txt
只在请求进入系统的边界接收明文密码。
明文密码只用于 hash 或 verify。
数据库和接口响应中都不应该出现明文密码。
```

下一节我们会继续：

```txt
JWT
Guard
CurrentUser
保护接口
```

到那时，登录成功后就不会只返回用户信息，而是返回可以用于后续请求的访问令牌。

## 参考资料

- NestJS Authentication: https://docs.nestjs.com/security/authentication
- NestJS Encryption and Hashing: https://docs.nestjs.com/security/encryption-and-hashing
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- node-argon2: https://github.com/ranisalt/node-argon2
