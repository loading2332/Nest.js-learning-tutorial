# Lesson 10 Syntax Notes

# Q

1. `process.env['DATABASE_URL']` 和 `env()` 的作用一样吗？哪个写法是对的？

# A

## 1. `process.env['DATABASE_URL']` 和 `env()` 的作用一样吗？

## 解释

它们都是在读取环境变量，但使用场景不完全一样。

### `process.env['DATABASE_URL']`

这是 Node.js 原生读取环境变量的方式。

```ts
const databaseUrl = process.env['DATABASE_URL'];
```

它的特点是：

```txt
Node.js 原生支持
返回 string | undefined
如果环境变量不存在，不会自动报错
```

也就是说，如果 `.env` 或系统环境里没有 `DATABASE_URL`：

```ts
process.env['DATABASE_URL'];
```

结果会是：

```ts
undefined;
```

所以你通常需要自己判断：

```ts
if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL is required');
}
```

### `env('DATABASE_URL')`

这里的 `env()` 来自 Prisma 7 的配置工具：

```ts
import { defineConfig, env } from 'prisma/config';
```

在 `prisma.config.ts` 中可以这样写：

```ts
datasource: {
  url: env('DATABASE_URL'),
}
```

它的作用是：

```txt
告诉 Prisma：这里需要读取 DATABASE_URL 这个环境变量。
```

它比直接写 `process.env['DATABASE_URL']` 更贴近 Prisma 配置语义。

### 哪个写法是对的？

在 Prisma 7 的 `prisma.config.ts` 里，更推荐：

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

原因是：

```txt
env() 是 Prisma 提供给 prisma.config.ts 使用的配置辅助函数。
语义更明确。
和 Prisma 7 的配置方式更一致。
```

但下面这种写法也很常见，而且能工作：

```ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
```

区别在于：

```txt
process.env['DATABASE_URL']
  -> Node.js 原生读取，结果可能是 undefined。

env('DATABASE_URL')
  -> Prisma 配置工具读取，语义上表示这个值来自环境变量。
```

## 示例代码

### 示例 1：普通 Node.js 代码中读取环境变量

```ts
const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

console.log(databaseUrl);
```

这种写法适合普通 Node.js / NestJS 代码。

比如你自己写配置校验：

```ts
export function validateEnv(config: Record<string, unknown>) {
  const databaseUrl = config.DATABASE_URL;

  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required');
  }

  return {
    ...config,
    DATABASE_URL: databaseUrl,
  };
}
```

### 示例 2：Prisma 7 的 `prisma.config.ts`

```ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // 推荐：Prisma 7 配置里用 env()
    url: env('DATABASE_URL'),
  },
});
```

这段代码表达的是：

```txt
Prisma CLI 运行 migrate/generate 时，
从环境变量 DATABASE_URL 中读取数据库连接地址。
```

### 示例 3：如果使用 `process.env`

```ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
```

这种写法也可以，但你需要自己处理 `undefined`。

### 当前项目建议

如果是 `prisma.config.ts`，建议写：

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

如果是 NestJS 应用代码中读取配置，建议不要到处写 `process.env`，而是通过第 9 课的 `ConfigService`：

```ts
const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
```

## 常见错误

### 错误 1：在 `schema.prisma` 里继续写 URL

Prisma 7 不推荐这样：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Prisma 7 应该把 URL 放到 `prisma.config.ts`：

```ts
datasource: {
  url: env('DATABASE_URL'),
}
```

### 错误 2：忘记加载 `.env`

如果你的 `DATABASE_URL` 写在 `.env` 里，`prisma.config.ts` 顶部要有：

```ts
import 'dotenv/config';
```

否则 Prisma CLI 可能读不到 `.env`。

### 错误 3：以为 `process.env['DATABASE_URL']` 一定有值

它可能是：

```ts
undefined;
```

所以普通代码里要判断，或者使用 Prisma 的 `env()` / NestJS 的 `getOrThrow()` 这类更明确的方式。

## 一句话总结

```txt
process.env['DATABASE_URL'] 是 Node.js 原生读取环境变量。
env('DATABASE_URL') 是 Prisma 7 配置文件里的推荐辅助写法。
在 prisma.config.ts 里优先用 env()；在 NestJS 业务代码里优先用 ConfigService。
```
