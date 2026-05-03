1. JwtModule.registerAsync({

   ​      imports: [ConfigModule],

   ​      inject: [ConfigService],

   ​      useFactory: (configService: ConfigService) => ({

   ​        secret: configService.getOrThrow('JWT_SECRET'),

   ​        signOptions: { expiresIn: '1h' },

   ​      }),

   ​    }),看不懂这个，之前的module都没有过这种写法

2. signAsync和sign有啥区别

3. request.user这里的赋值是干什么的

4. jwt加密和解密的过程是怎么样的，jwt这个技术从头到尾干了什么，是怎么保证安全性的

5. 为什么要 `exports: [JwtAuthGuard]`？

   因为课程模块也要使用这个 Guard。

   如果其他模块想注入或使用 `AuthModule` 里的 provider，需要 `AuthModule` 导出它。这里面的话，别的模块如果要用，为什么不能直接providers写上要导入的service？我一直不理解为什么要导出

6. 看不懂这个自定义装饰器是怎么写的，你完全没铺垫就给了代码。keyof AuthUser是什么。这个type定义中的&又是什么？user为什么又取索引data？这个装饰器是保证user是token校验过的吗？我没看到

# A

## 1. `JwtModule.registerAsync(...)` 这段为什么和之前的 module 写法不一样

前面你见到的大多数 `Module` 写法，都是在说：

```txt
这个模块里有哪些 controller
有哪些 provider
要导入哪些模块
```

但 `JwtModule.registerAsync(...)` 属于另一类东西：

```txt
动态模块配置
```

`JwtModule` 不是我们自己写的普通模块，它是 Nest 提供的一个“可配置模块”。

它需要你告诉它：

```txt
JWT 用什么 secret
token 多久过期
```

也就是这段：

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

你可以把它理解成：

```txt
先创建一个 JwtModule
但这个模块在创建前，需要先读取配置
然后根据配置生成它自己的内部 provider
```

为什么不用普通写法？

因为 `JWT_SECRET` 来自环境变量，不适合写死。

如果写成：

```ts
JwtModule.register({
  secret: 'abc',
})
```

那就是把密钥直接写在代码里了。

而 `registerAsync` 的意思就是：

```txt
这个模块的配置不是提前写死，而是启动时动态算出来。
```

## 2. `signAsync` 和 `sign` 有什么区别

它们做的事情本质一样：

```txt
把 payload 签成 JWT
```

区别主要在返回值形式：

```ts
sign(payload)
```

返回的是同步结果，直接给你字符串。

```ts
await signAsync(payload)
```

返回的是 Promise，要 `await`。

为什么教程里用 `signAsync`？

因为我们现在整个登录流程本来就是 `async` 的：

```ts
findByEmail -> verify password -> sign token
```

统一用异步风格更顺，也更贴近 Nest 里常见写法。

你可以先把它理解成：

```txt
sign
  立刻给结果

signAsync
  Promise 形式给结果
```

## 3. `request.user = ...` 这一步是在干什么

这是整个认证链路里最关键的一步。

Guard 校验 token 成功后，服务端已经知道：

```txt
这个请求是谁发来的
```

但这个“当前用户信息”还得放到某个地方，后面的 Controller 和装饰器才能拿到。

最常见的做法就是挂到：

```txt
request.user
```

也就是：

```ts
request.user = {
  id: payload.sub,
  email: payload.email,
  role: payload.role,
};
```

这样后面 Controller 执行时，就可以通过：

```ts
@CurrentUser('id') userId: number
```

拿到这个值。

所以它不是“JWT 规范要求”的字段，而是：

```txt
Node/Nest 生态里非常常见的约定。
```

简单流程是：

```txt
请求进来
-> Guard 校验 token
-> 校验成功，把当前用户写到 request.user
-> Controller / 装饰器读取 request.user
```

## 4. JWT 从头到尾到底干了什么，它怎么保证安全

先说一句最重要的话：

```txt
JWT 主要解决的是“身份声明可以被服务端验证”，不是“把数据藏起来”。
```

### 整个过程

登录时：

```txt
1. 用户提交 email + password
2. 服务端验证密码正确
3. 服务端生成 payload，比如：
   { sub: 1, email: 'a@example.com', role: 'student' }
4. 服务端用 JWT_SECRET 对这份 payload 做签名
5. 得到 token，返回给客户端
```

后续访问受保护接口时：

```txt
1. 客户端把 token 放到 Authorization: Bearer <token>
2. Guard 取出 token
3. 服务端用同一个 JWT_SECRET 验证签名
4. 如果签名没问题、且没过期，就说明：
   这份 payload 确实是服务端签发的，而且中途没被改过
5. 服务端把 payload 转成 request.user
6. 业务代码继续执行
```

### 安全性从哪来

JWT 的安全性主要来自两点：

```txt
1. 签名
2. 过期时间
```

签名保证：

```txt
别人就算看到了 token，也不能随便把 sub 从 1 改成 2
因为一改 payload，签名就对不上了
```

过期时间保证：

```txt
token 不是永久有效
即使泄露，影响时间也有限
```

### JWT 不保证什么

JWT 默认不保证：

```txt
1. payload 保密
2. token 不会被窃取
3. 用户权限变化后旧 token 自动同步
```

所以你不能把它理解成“加密存储”。

它更像是：

```txt
一张服务端签过名的身份说明书
```

别人可以看到说明书上写了什么，但不能伪造服务端的签名。

## 5. 为什么模块里要 `exports`

你这个疑问特别关键，本质上是在问：

```txt
为什么模块之间不能直接随便拿别人的 provider
```

Nest 的模块系统本质上是在做：

```txt
作用域隔离
```

默认情况下，一个模块里的 provider 只属于这个模块自己。

比如：

```ts
@Module({
  providers: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
```

这里的意思是：

```txt
AuthService 和 JwtAuthGuard 只在 AuthModule 内部可见
```

如果别的模块也想用，就必须显式导出：

```ts
exports: [JwtAuthGuard, JwtModule]
```

再由别的模块显式导入：

```ts
imports: [AuthModule]
```

为什么不能在 `CoursesModule` 里直接再写一遍 `providers: [JwtAuthGuard]`？

因为 `JwtAuthGuard` 自己还依赖：

```txt
JwtService
ConfigService
```

而 `JwtService` 是 `JwtModule` 里提供的。

你如果只是把 `JwtAuthGuard` 这个类手动写进 `providers`，并不等于它依赖的整套东西都能跟着拿到。

更重要的是，模块导出表达的是：

```txt
我愿意把哪些能力开放给别的模块使用
```

这是一种边界声明。

你可以把它理解成：

```txt
providers
  模块内部自己用的东西

exports
  模块愿意对外提供的东西
```

## 6. 自定义装饰器这段代码怎么看

这个问题我拆开说。

### 第一步：它到底想解决什么问题

Guard 已经做了：

```ts
request.user = {
  id: payload.sub,
  email: payload.email,
  role: payload.role,
};
```

那 Controller 里如果不用装饰器，你就得这样写：

```ts
@Req() req
const user = req.user;
```

这样 Controller 会显得很脏，而且和 Express 耦合得很深。

所以我们做一个装饰器：

```ts
@CurrentUser()
@CurrentUser('id')
```

让 Controller 更像在表达业务语义：

```txt
我要当前用户
我要当前用户 id
```

### 第二步：`keyof AuthUser` 是什么

先看：

```ts
type AuthUser = {
  id: number;
  email: string;
  role: UserRole;
};
```

`keyof AuthUser` 的意思是：

```txt
取出 AuthUser 这个类型的所有键名
```

结果就是：

```ts
'id' | 'email' | 'role'
```

所以这里：

```ts
(data: keyof AuthUser | undefined, ctx: ExecutionContext)
```

意思是：

```txt
data 只能是 'id'、'email'、'role'，或者不传
```

这就是为什么可以写：

```ts
@CurrentUser('id')
```

但不能乱写：

```ts
@CurrentUser('abc')
```

### 第三步：`Request & { user?: AuthUser }` 里的 `&` 是什么

`&` 在类型里表示：

```txt
交叉类型
```

意思是把两个类型合并起来。

这里：

```ts
type RequestWithUser = Request & {
  user?: AuthUser;
};
```

意思就是：

```txt
这是一个 Express 的 Request
并且我们额外约定它上面可能还有一个 user 字段
```

为什么要这样写？

因为原生 `Request` 类型里并没有默认定义 `user`。

但我们的 Guard 已经手动加上去了，所以这里要把类型补出来。

### 第四步：`user[data]` 为什么能这么写

`user[data]` 是“按键名取属性”。

比如：

```ts
const user = {
  id: 1,
  email: 'a@example.com',
  role: 'student',
};
```

如果：

```ts
data = 'id'
```

那：

```ts
user[data]
```

就等于：

```ts
user.id
```

如果：

```ts
data = 'email'
```

那就等于：

```ts
user.email
```

所以这段代码：

```ts
return data ? user[data] : user;
```

意思就是：

```txt
如果传了 data，比如 'id'
  -> 返回 user.id

如果没传 data
  -> 返回整个 user 对象
```

### 第五步：这个装饰器本身会不会校验 token

不会。

这个装饰器本身不负责认证。

它只是：

```txt
从 request 上把已经存在的 user 读出来
```

真正保证 “user 是 token 校验过的” 的是前面的：

```txt
JwtAuthGuard
```

也就是说链路是：

```txt
1. @UseGuards(JwtAuthGuard)
2. Guard 校验 token
3. Guard 成功后写入 request.user
4. @CurrentUser() 只是把 request.user 读出来
```

如果没有 Guard，这个装饰器自己并不会神奇地产生 user。

所以它依赖前置条件：

```txt
这个接口已经先经过 JwtAuthGuard
```
