# 第 9 课：配置管理与环境变量

## 本节目标

学完这一节，你要能做到：

- 理解为什么后端项目需要配置管理。
- 知道哪些内容应该放到环境变量里。
- 使用 `.env` 管理本地开发配置。
- 使用 `@nestjs/config` 接入 NestJS 配置模块。
- 在 `main.ts` 中从配置读取端口。
- 配置数据库连接地址和 JWT 密钥。
- 使用配置校验让项目在启动阶段尽早失败。
- 区分开发、测试、生产环境的配置差异。

前 8 课我们主要在处理请求链路：

```txt
参数校验 -> 业务逻辑 -> 错误响应 -> 成功响应 -> 请求日志
```

从这一课开始，课程进入第三阶段：配置、数据库与持久化。

配置管理是后续数据库、JWT、部署的基础。你可以先记住一句话：

> 会变的东西、敏感的东西、不同环境不一样的东西，都不要写死在代码里。

## 一、为什么需要配置管理

先看当前 `src/main.ts`：

```ts
await app.listen(process.env.PORT ?? 3000);
```

这行代码已经有一点配置意识：

```txt
如果环境变量 PORT 存在，就使用 PORT。
如果不存在，就使用默认端口 3000。
```

但随着项目变大，只靠 `process.env` 会越来越乱。

真实项目里你可能会有这些配置：

```txt
PORT
NODE_ENV
DATABASE_URL
JWT_SECRET
REDIS_URL
LOG_LEVEL
UPLOAD_DIR
OSS_ACCESS_KEY
SMTP_HOST
```

如果每个文件都直接写：

```ts
process.env.JWT_SECRET
process.env.DATABASE_URL
process.env.REDIS_URL
```

会出现几个问题：

- 不知道项目到底需要哪些环境变量。
- 拼写错误很难发现，比如 `JWT_SECRECT`。
- 取出来都是字符串，需要到处转换类型。
- 缺少关键配置时，可能运行到某个接口才报错。
- 测试环境和生产环境切换不清晰。

配置管理要解决的是：

```txt
集中读取
集中校验
集中转换
按环境区分
避免敏感信息写死
```

## 二、哪些内容应该放到环境变量里

适合放环境变量的内容：

```txt
端口
数据库连接地址
JWT 密钥
第三方服务密钥
Redis 地址
对象存储配置
邮件服务配置
运行环境
日志级别
```

不适合写死在代码里的内容：

```ts
const jwtSecret = 'my-secret';
const databaseUrl = 'postgresql://user:password@localhost:5432/app';
```

因为这些信息：

- 不同环境不一样。
- 可能包含密码或密钥。
- 泄露后有安全风险。
- 修改时不应该重新改代码、重新发版。

更推荐：

```txt
JWT_SECRET=change-me-in-local
DATABASE_URL=postgresql://user:password@localhost:5432/nest_learn
```

然后代码从配置模块读取。

## 三、`.env` 和 `.env.example`

本地开发时，常用 `.env` 保存环境变量。

例如：

```txt
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nest_learn
JWT_SECRET=local-dev-secret
```

但 `.env` 通常不应该提交到 Git。

原因是它可能包含敏感信息：

```txt
数据库密码
JWT 密钥
第三方服务 token
生产环境地址
```

更推荐提交一个 `.env.example`：

```txt
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=replace-with-your-secret
```

`.env.example` 的作用是告诉别人：

```txt
这个项目启动需要哪些环境变量。
```

但它不放真实密码和真实密钥。

## 四、安装 `@nestjs/config`

当前项目还没有安装 `@nestjs/config`。

执行：

```bash
pnpm add @nestjs/config
```

安装后，它会出现在 `package.json` 的 `dependencies` 中。

`@nestjs/config` 的作用是：

- 读取 `.env`。
- 把环境变量注入 NestJS。
- 提供 `ConfigService` 统一读取配置。
- 支持配置校验。
- 支持按模块组织配置。

## 五、创建 `.env`

在项目根目录创建：

```txt
.env
```

写入：

```txt
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nest_learn
JWT_SECRET=local-dev-secret
```

当前第 9 课还不会真正连接数据库和 JWT，但先把配置放好。

后续课程会用到：

```txt
DATABASE_URL
JWT_SECRET
```

## 六、创建 `.env.example`

在项目根目录创建：

```txt
.env.example
```

写入：

```txt
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=replace-with-your-secret
```

以后别人拿到项目时，可以：

```bash
cp .env.example .env
```

然后改成自己的本地配置。

## 七、确认 `.env` 不提交

打开 `.gitignore`，确认里面有：

```txt
.env
```

如果没有，请补上：

```txt
.env
.env.local
.env.*.local
```

注意：`.env.example` 应该提交，因为它不包含真实敏感信息。

常见做法：

```txt
提交：.env.example
不提交：.env
```

## 八、接入 `ConfigModule`

打开：

```txt
src/app.module.ts
```

导入：

```ts
import { ConfigModule } from '@nestjs/config';
```

然后加入 `imports`：

```ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CoursesModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

`isGlobal: true` 的意思是：

```txt
把 ConfigModule 变成全局模块。
其他模块想使用 ConfigService 时，不需要反复 imports ConfigModule。
```

学习阶段可以先使用 `isGlobal: true`，比较省心。

## 九、在 `main.ts` 中读取端口

现在 `main.ts` 里可能还是：

```ts
await app.listen(process.env.PORT ?? 3000);
```

接入 `ConfigModule` 后，改成使用 `ConfigService`。

打开：

```txt
src/main.ts
```

导入：

```ts
import { ConfigService } from '@nestjs/config';
```

在 `bootstrap()` 中读取：

```ts
const configService = app.get(ConfigService);
const port = configService.getOrThrow<number>('PORT');

await app.listen(port);
```

完整示例：

```ts
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('PORT');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );

  await app.listen(port);
}
void bootstrap();
```

现在端口由 `.env` 控制：

```txt
PORT=3000
```

你可以改成：

```txt
PORT=4000
```

然后重启服务，访问：

```txt
http://localhost:4000
```

## 十、为什么要配置校验

如果 `.env` 中缺少 `JWT_SECRET`，项目能不能启动？

从技术上讲，可能能启动。

但后面登录接口需要签发 JWT 时，才会发现：

```txt
JWT_SECRET 不存在
```

这就太晚了。

配置校验的目标是：

```txt
项目启动时就检查必要配置。
缺什么就立刻报错。
不要等用户请求打进来才炸。
```

比如下面这些都应该尽早失败：

```txt
PORT 不是数字
DATABASE_URL 为空
JWT_SECRET 为空
NODE_ENV 不是 development/test/production
```

## 十一、创建配置校验文件

创建目录：

```txt
src/config/
```

创建文件：

```txt
src/config/env.validation.ts
```

写入：

```ts
type RawEnv = Record<string, unknown>;

const nodeEnvs = ['development', 'test', 'production'] as const;

type NodeEnv = (typeof nodeEnvs)[number];

export function validateEnv(config: RawEnv) {
  const port = Number(config.PORT ?? 3000);
  const nodeEnv = String(config.NODE_ENV ?? 'development');
  const databaseUrl = config.DATABASE_URL;
  const jwtSecret = config.JWT_SECRET;

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  if (!nodeEnvs.includes(nodeEnv as NodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required');
  }

  if (typeof jwtSecret !== 'string' || jwtSecret.length === 0) {
    throw new Error('JWT_SECRET is required');
  }

  return {
    ...config,
    PORT: port,
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
  };
}
```

这段代码做了几件事：

- `PORT` 转成数字。
- `PORT` 必须是正整数。
- `NODE_ENV` 只能是 `development`、`test`、`production`。
- `DATABASE_URL` 必须存在。
- `JWT_SECRET` 必须存在。

注意：这里没有引入额外校验库。后面项目复杂后，也可以用 Joi、Zod、class-validator 等库做更强的配置校验。

## 十二、在 `ConfigModule` 中使用校验函数

打开：

```txt
src/app.module.ts
```

导入：

```ts
import { validateEnv } from './config/env.validation';
```

配置：

```ts
ConfigModule.forRoot({
  isGlobal: true,
  validate: validateEnv,
})
```

完整示例：

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { CoursesModule } from './courses/courses.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    CoursesModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

现在如果你把 `.env` 里的 `JWT_SECRET` 删掉，再启动项目，应该会直接报错。

这就是“尽早失败”。

## 十三、读取配置的两种方式

### 方式 1：直接读取环境变量 key

例如：

```ts
const port = configService.getOrThrow<number>('PORT');
const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
const jwtSecret = configService.getOrThrow<string>('JWT_SECRET');
```

优点：

- 简单直接。
- 适合学习阶段。
- 和 `.env` 一一对应。

缺点：

- key 是字符串，容易拼错。
- 配置多了以后不够结构化。

### 方式 2：创建配置对象

更工程化的做法是把配置按领域分组。

例如创建：

```txt
src/config/app.config.ts
src/config/database.config.ts
src/config/auth.config.ts
```

示例：

```ts
import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => {
  return {
    port: Number(process.env.PORT ?? 3000),
    nodeEnv: process.env.NODE_ENV ?? 'development',
  };
});
```

数据库配置：

```ts
import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => {
  return {
    url: process.env.DATABASE_URL,
  };
});
```

认证配置：

```ts
import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => {
  return {
    jwtSecret: process.env.JWT_SECRET,
  };
});
```

然后在 `ConfigModule` 中加载：

```ts
ConfigModule.forRoot({
  isGlobal: true,
  validate: validateEnv,
  load: [appConfig, databaseConfig, authConfig],
})
```

读取时：

```ts
const port = configService.getOrThrow<number>('app.port');
const databaseUrl = configService.getOrThrow<string>('database.url');
const jwtSecret = configService.getOrThrow<string>('auth.jwtSecret');
```

本课程建议：

```txt
第 9 课先使用直接 key。
后续项目配置变多时，再逐步抽成 app/database/auth 配置对象。
```

这样学习曲线更平滑。

## 十四、开发、测试、生产环境的区别

同一个项目在不同环境下，配置通常不同。

### 开发环境

```txt
NODE_ENV=development
PORT=3000
DATABASE_URL=本地数据库
JWT_SECRET=本地开发密钥
```

特点：

- 方便调试。
- 数据可以随时清理。
- 密钥不是真实生产密钥。

### 测试环境

```txt
NODE_ENV=test
PORT=0
DATABASE_URL=测试数据库
JWT_SECRET=test-secret
```

特点：

- 用于自动化测试。
- 不污染开发数据库。
- 配置应该稳定可重复。

### 生产环境

```txt
NODE_ENV=production
PORT=由部署平台提供
DATABASE_URL=生产数据库
JWT_SECRET=强随机密钥
```

特点：

- 配置通常由部署平台注入。
- 不应该把生产 `.env` 放进代码仓库。
- 密钥必须足够强，并且定期轮换。

## 十五、`.env` 文件的常见命名

常见文件：

```txt
.env
.env.local
.env.development
.env.test
.env.production
.env.example
```

学习阶段建议先用：

```txt
.env
.env.example
```

项目变复杂后再考虑：

```txt
.env.development
.env.test
.env.production
```

如果要指定多个 env 文件，可以这样：

```ts
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: ['.env.local', '.env'],
  validate: validateEnv,
})
```

含义是：

```txt
优先读取 .env.local
再读取 .env
```

## 十六、不要滥用环境变量

环境变量适合放“部署环境相关”的值。

但不是所有东西都要放环境变量。

不建议放环境变量的内容：

```txt
普通业务文案
前端展示标题
课程默认价格
不敏感且不随环境变化的常量
复杂业务规则
```

这些更适合放：

```txt
代码常量
数据库
后台管理配置
远程配置中心
```

判断标准：

```txt
这个值是否不同环境不一样？
这个值是否敏感？
这个值是否部署时决定？
```

如果答案都是“不是”，就不一定需要放环境变量。

## 十七、本节练习任务

### 任务 1：安装配置模块

要求：

- 执行 `pnpm add @nestjs/config`。
- 确认 `package.json` 中出现 `@nestjs/config`。

记录：

```txt
安装的依赖：
```

### 任务 2：创建 `.env` 和 `.env.example`

要求：

- 创建 `.env`。
- 创建 `.env.example`。
- 包含 `PORT`、`NODE_ENV`、`DATABASE_URL`、`JWT_SECRET`。
- 确认 `.env` 在 `.gitignore` 中。

记录：

```txt
我的 .env.example 内容：
```

### 任务 3：接入 `ConfigModule`

要求：

- 在 `AppModule` 中导入 `ConfigModule`。
- 使用 `ConfigModule.forRoot({ isGlobal: true })`。

记录：

```txt
AppModule imports 当前包含：
```

### 任务 4：从配置读取端口

要求：

- 在 `main.ts` 中使用 `ConfigService`。
- 使用 `configService.getOrThrow<number>('PORT')` 获取端口。
- 修改 `.env` 中 `PORT`，重启项目验证端口变化。

记录：

```txt
PORT=3000 时访问地址：
PORT=4000 时访问地址：
```

### 任务 5：添加配置校验

要求：

- 创建 `src/config/env.validation.ts`。
- 校验 `PORT`、`NODE_ENV`、`DATABASE_URL`、`JWT_SECRET`。
- 在 `ConfigModule.forRoot()` 中使用 `validate: validateEnv`。
- 删除一个必填配置，确认项目启动失败。

记录：

```txt
我故意删除的配置：
启动时报错信息：
恢复配置后是否能启动：
```

## 十八、本节知识输出

请在学习笔记中回答：

1. 为什么不能把 `DATABASE_URL` 和 `JWT_SECRET` 写死在代码中？
2. `.env` 和 `.env.example` 的区别是什么？
3. `ConfigModule.forRoot({ isGlobal: true })` 的作用是什么？
4. `ConfigService.get()` 和 `ConfigService.getOrThrow()` 有什么区别？
5. 为什么配置校验应该在项目启动时执行？
6. 开发、测试、生产环境的配置通常有哪些差异？
7. 哪些内容适合放环境变量？哪些内容不适合？

建议结合本节的 `.env`、`main.ts` 和 `env.validation.ts` 回答。

## 十九、常见问题

### 1. 为什么我改了 `.env`，项目没变化？

通常需要重启服务。

`.env` 在应用启动时读取，运行过程中修改不会自动生效。

### 2. 为什么 `ConfigService.get<number>('PORT')` 取到的还是字符串？

环境变量原始值都是字符串。

如果没有配置校验或转换，`PORT=3000` 读出来可能是 `'3000'`。

本节的 `validateEnv()` 会把 `PORT` 转成数字：

```ts
PORT: port
```

这样后面读取时更可靠。

### 3. `.env` 可以提交到 Git 吗？

一般不提交。

提交 `.env.example`，不提交 `.env`。

### 4. 生产环境也用 `.env` 吗？

不一定。

生产环境常见方式是由部署平台注入环境变量，比如 Docker、Kubernetes、云平台、CI/CD 系统。

代码里依然通过 `ConfigService` 读取，不关心变量来自 `.env` 还是部署平台。

### 5. `JWT_SECRET` 现在还没用，为什么要配置？

因为后面认证授权课程会使用 JWT。

提前放入配置，是为了让你形成习惯：

```txt
密钥类配置不要写死在代码中。
```

## 二十、本节最小验收

- 新增依赖：`@nestjs/config`。
- 新增文件：`.env.example`。
- 本地存在 `.env`。
- `.env` 已被 `.gitignore` 忽略。
- 新增文件：`src/config/env.validation.ts`。
- 修改文件：`src/app.module.ts`。
- 修改文件：`src/main.ts`。
- `PORT` 能从配置读取。
- 缺少 `DATABASE_URL` 或 `JWT_SECRET` 时，项目启动失败。
- 恢复配置后，项目能正常启动。
- `pnpm run build` 可以通过。
- `pnpm run lint` 可以通过。

## 二十一、本节验收标准

完成本节后，请确认：

- 你能说出为什么配置不能散落在代码中。
- 你能解释 `.env` 和 `.env.example` 的区别。
- 你能使用 `ConfigService` 读取配置。
- 你能让端口由 `PORT` 控制。
- 你能通过配置校验让缺失配置尽早报错。
- 你能区分开发、测试、生产环境的配置差异。

## 二十二、下一节预告

下一节会进入数据库建模与 ORM 入门。

第 9 课先准备了：

```txt
DATABASE_URL
```

第 10 课会真正使用它连接数据库，并把现在的内存课程数组改造成持久化数据模型。

到那时你会看到配置管理的价值：

```txt
代码不关心数据库地址写在哪里。
代码只通过 ConfigService 或 ORM 配置读取 DATABASE_URL。
不同环境只需要换环境变量。
```
