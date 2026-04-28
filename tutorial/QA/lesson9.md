# Q
1. ConfigService.get() 和 ConfigService.getOrThrow() 有什么区别？

# A

## 1. `ConfigService.get()` 和 `ConfigService.getOrThrow()` 有什么区别？

最核心的区别是：

```txt
get()
  -> 配置不存在时，返回 undefined 或默认值。

getOrThrow()
  -> 配置不存在时，直接抛出错误，让程序尽早失败。
```

## `get()`：适合可选配置

比如有些配置不是必须的，可以没有：

```ts
const logLevel = configService.get<string>('LOG_LEVEL') ?? 'debug';
```

这里的意思是：

```txt
如果 LOG_LEVEL 存在，就使用 LOG_LEVEL。
如果 LOG_LEVEL 不存在，就使用 debug。
```

也可以直接传默认值：

```ts
const port = configService.get<number>('PORT', 3000);
```

这种写法适合：

```txt
这个配置缺了也没关系，我有合理默认值。
```

## `getOrThrow()`：适合必填配置

比如数据库地址和 JWT 密钥，通常不能缺：

```ts
const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
const jwtSecret = configService.getOrThrow<string>('JWT_SECRET');
```

如果 `.env` 里没有这些配置，程序会直接报错。

这很重要，因为：

```txt
DATABASE_URL 缺失
  -> 项目不应该假装能正常启动

JWT_SECRET 缺失
  -> 后面登录签 token 时一定会出问题
```

所以对关键配置，推荐使用 `getOrThrow()`。

## 为什么第 9 课把端口改成 `getOrThrow()`？

现在代码里是：

```ts
const port = configService.getOrThrow<number>('PORT');
```

同时我们在 `validateEnv()` 里已经写了默认值：

```ts
const port = Number(config.PORT ?? 3000);
```

也就是说：

```txt
如果 .env 没有 PORT
  -> validateEnv 会使用默认值 3000
  -> ConfigService 里仍然能拿到 PORT

如果 PORT 写成 abc
  -> validateEnv 会直接报错
```

所以这里用 `getOrThrow()` 是为了表达：

```txt
经过配置校验后，应用启动时必须能拿到一个可靠的 PORT。
```

## 和配置校验是什么关系？

`getOrThrow()` 只能检查“有没有这个 key”。

但它不擅长检查复杂规则，例如：

```txt
PORT 必须是正整数
NODE_ENV 只能是 development/test/production
DATABASE_URL 不能为空
JWT_SECRET 不能为空
```

这些更适合放在 `validateEnv()` 中：

```ts
if (!Number.isInteger(port) || port <= 0) {
  throw new Error('PORT must be a positive integer');
}
```

所以两者可以这样分工：

```txt
validateEnv()
  -> 应用启动时集中校验所有关键配置

getOrThrow()
  -> 使用配置时明确表达“这个配置必须存在”

get()
  -> 使用可选配置，或者给默认值
```

## 怎么选择？

可以按这个规则记：

```txt
必须有，否则项目不应该启动
  -> getOrThrow()

没有也能运行，有默认值
  -> get()

配置格式、范围、枚举值需要检查
  -> validateEnv()
```

例子：

```ts
const port = configService.getOrThrow<number>('PORT');
const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
const jwtSecret = configService.getOrThrow<string>('JWT_SECRET');
const logLevel = configService.get<string>('LOG_LEVEL', 'debug');
```

一句话总结：

```txt
get() 偏“可选读取”，getOrThrow() 偏“必填读取”，validateEnv() 负责启动时集中把配置质量检查好。
```
