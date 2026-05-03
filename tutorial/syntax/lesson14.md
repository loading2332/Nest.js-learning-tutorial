1. usefactory 是什么
2. return { accessToken }; 为什么要写成对象形式
3. CanActivate是啥
4. SwitchToHttp是什么意思？request本来不就是http发来的吗？结合具体代码例子讲讲

# A

## 1. `useFactory` 是什么

### 解释

`useFactory` 是 Nest 依赖注入里的“工厂提供者”写法。

你可以把它理解成：

```txt
不要直接给我一个固定值
而是调用一个函数，运行时动态产出这个值
```

在第 14 课里：

```ts
JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    secret: configService.getOrThrow('JWT_SECRET'),
    signOptions: { expiresIn: '1h' },
  }),
})
```

这里的意思是：

```txt
先注入 ConfigService
再执行 useFactory 这个函数
函数返回 JwtModule 需要的配置对象
```

为什么需要它？

因为 `JWT_SECRET` 不是写死的，而是从 `.env` 里读出来的。

如果配置依赖运行时数据，`useFactory` 就很合适。

### 示例代码

最简单的固定配置：

```ts
JwtModule.register({
  secret: 'abc',
})
```

运行时动态配置：

```ts
JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    // 运行时从环境变量读取 JWT_SECRET
    secret: configService.getOrThrow('JWT_SECRET'),
    signOptions: {
      expiresIn: '1h',
    },
  }),
})
```

可以把它想成：

```txt
register
  直接给配置

registerAsync + useFactory
  先执行一个函数，再得到配置
```

## 2. `return { accessToken };` 为什么要写成对象

### 解释

因为接口响应通常不是只为了“把一个值吐出去”，而是为了表达：

```txt
这是什么数据
```

如果你直接返回：

```ts
return accessToken;
```

那接口响应就是纯字符串：

```json
"eyJhbGciOiJIUzI1NiIs..."
```

这不够语义化。

而写成：

```ts
return { accessToken };
```

响应就是：

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

这样客户端一看就知道这个字段的含义。

另外，后面如果要扩展返回内容，也更自然，比如：

```json
{
  "accessToken": "...",
  "expiresIn": 3600
}
```

### 示例代码

不推荐的纯字符串返回：

```ts
async login() {
  const accessToken = 'token-value';

  // 客户端拿到的是一个字符串，不知道这个字符串是什么
  return accessToken;
}
```

更常见的对象返回：

```ts
async login() {
  const accessToken = 'token-value';

  // 响应字段名表达了语义
  return {
    accessToken,
  };
}
```

## 3. `CanActivate` 是什么

### 解释

`CanActivate` 是 Nest 里 Guard 的接口。

你可以把它理解成：

```txt
一个“是否允许继续访问”的标准接口
```

只要一个类实现了 `CanActivate`，Nest 就知道：

```txt
这个类是一个 Guard
它应该在进入 Controller 方法之前执行
```

接口的核心方法就是：

```ts
canActivate(context: ExecutionContext): boolean | Promise<boolean>
```

如果返回：

```txt
true
  允许请求继续进入 Controller

false
  拒绝请求
```

当然，更常见的是直接抛异常：

```ts
throw new UnauthorizedException(...)
```

### 示例代码

一个最小的 Guard：

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class DemoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // 返回 true，表示放行
    return true;
  }
}
```

JWT Guard：

```ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 读取 token、校验 token
    // 成功则 return true
    // 失败则 throw UnauthorizedException
    return true;
  }
}
```

## 4. `switchToHttp()` 是什么

### 解释

你问得很对：请求本来就是 HTTP 发来的，为什么还要 `switchToHttp()`？

因为 `ExecutionContext` 是 Nest 做的一层“通用抽象”。

Nest 不只支持 HTTP，还支持：

```txt
WebSocket
RPC / 微服务
GraphQL（底层也会有自己的上下文适配）
```

所以 `ExecutionContext` 先不给你直接暴露“这一定是 Express request”，而是先给一个统一上下文对象。

当你确定当前是在处理 HTTP 请求时，就要写：

```ts
context.switchToHttp()
```

意思是：

```txt
把当前这个通用执行上下文，切换成 HTTP 视角来读取
```

然后你才能拿：

```ts
getRequest()
getResponse()
```

### 结合当前代码理解

在 `JwtAuthGuard` 里：

```ts
const request = context.switchToHttp().getRequest<RequestWithUser>();
```

可以拆成两步看：

```ts
const httpContext = context.switchToHttp();
const request = httpContext.getRequest<RequestWithUser>();
```

意思就是：

```txt
先告诉 Nest：我现在要按 HTTP 请求来处理这个上下文
再从 HTTP 上下文里拿出 request 对象
```

### 示例代码

在 Guard 中读取 header：

```ts
canActivate(context: ExecutionContext): boolean {
  const request = context.switchToHttp().getRequest<Request>();

  // 拿到原始 HTTP 请求头
  const authHeader = request.headers.authorization;

  return Boolean(authHeader);
}
```

在装饰器中读取当前用户：

```ts
export const CurrentUser = createParamDecorator(
  (data, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();

    // 这里拿到的就是 Guard 之前塞进去的 request.user
    return request.user;
  },
);
```

注意：

```txt
request 的确是 HTTP 发来的
但在 Nest 的底层抽象里，你需要先通过 switchToHttp() 明确告诉框架：
“我要用 HTTP 这套对象”
```
