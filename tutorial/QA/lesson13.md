1. ​        role: UserRole.student,为啥直接用了UserRole的，冷不丁突然用了这个，不懂
2. Create 为什么还要用上 select
3. await argon2.hash(input.password); 为什么这个要用异步？到底什么时候用异步？js不是单线程吗？异步从头到位做了什么事情，结合具体例子讲讲。
4. curl -X POST http://localhost:3000/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "alice@example.com",
       "password": "wrong-password"
     }'
   {"success":false,"statusCode":500,"message":"Internal server error","error":"Internal Server Error","path":"/auth/login","timestamp":"2026-04-30T05:57:17.535Z"}%   为什么是500，不应该是401吗

# A

## 1. `role: UserRole.student` 为啥突然用了 `UserRole`

这里确实应该先解释。

`UserRole` 来自 Prisma 根据 `schema.prisma` 生成的枚举：

```prisma
enum UserRole {
  student
  teacher
  admin
}
```

执行 `prisma generate` 后，Prisma Client 会生成一个 TypeScript 里的 `UserRole`。

所以代码里可以写：

```ts
import { UserRole } from '../generated/client';

role: UserRole.student;
```

它等价于直接写：

```ts
role: 'student';
```

但更推荐用 `UserRole.student`，因为它有类型提示，也不容易写错字符串。

例如如果你手写：

```ts
role: 'studnet';
```

这个拼错的字符串很容易到运行时才暴露。

用枚举时，编辑器会提示你只能选：

```txt
student
teacher
admin
```

本课里注册用户默认是学生，所以写：

```ts
role: UserRole.student
```

## 2. `create` 为什么还要用 `select`

因为 `create` 不只是“写入数据库”，它还会返回创建后的记录。

例如：

```ts
return this.prisma.user.create({
  data: {
    email: input.email,
    name: input.name,
    passwordHash: input.passwordHash,
  },
});
```

如果不写 `select`，Prisma 默认会返回用户的所有普通字段，其中就包括：

```txt
passwordHash
```

但 `passwordHash` 不应该出现在接口响应里。

所以我们写：

```ts
select: {
  id: true,
  email: true,
  name: true,
  role: true,
  createAt: true,
  updateAt: true,
}
```

意思是：

```txt
创建用户后，只返回这些安全字段。
```

一句话：

```txt
create 负责写入数据，select 负责控制写入后返回什么。
```

## 3. `await argon2.hash(input.password)` 为什么是异步

先说结论：

```txt
耗时的、需要等待结果的操作，通常会设计成异步。
```

密码哈希是故意设计得比较慢的计算。

它慢不是缺点，而是安全特性：

```txt
用户登录时慢一点可以接受。
攻击者批量猜密码时，每次都慢，就会很难撞库。
```

JS 主线程确实是单线程的，但 Node.js 不只是一个主线程。

你可以先把 Node.js 想成这样：

```txt
JS 主线程：
  负责执行你的 JavaScript 代码。

底层系统 / 线程池：
  负责处理一部分耗时任务，比如文件读写、部分加密计算、DNS、压缩等。

事件循环：
  负责在异步任务完成后，把回调/Promise 结果放回 JS 主线程继续执行。
```

所以这段代码：

```ts
const passwordHash = await hash(input.password);
```

大概流程是：

```txt
1. JS 调用 hash(input.password)
2. argon2 开始做耗时计算
3. 当前请求函数在 await 这里暂停
4. JS 主线程可以去处理别的请求
5. hash 计算完成后，Promise 变成 fulfilled
6. 事件循环安排后续代码继续执行
7. passwordHash 拿到结果
8. 继续 create 用户
```

`await` 不是让整个 Node.js 停住。

它只是让当前这个 async 函数暂停，等 Promise 完成后再继续。

比如：

```ts
async register(input: RegisterDto) {
  const passwordHash = await hash(input.password);

  return this.usersService.create({
    email: input.email,
    name: input.name,
    passwordHash,
  });
}
```

如果不用 `await`：

```ts
const passwordHash = hash(input.password);
```

这里拿到的不是字符串哈希，而是：

```txt
Promise<string>
```

那你传给数据库的就不是密码哈希字符串了。

什么时候用异步？

常见场景：

```txt
数据库查询
HTTP 请求
文件读写
密码哈希
发送邮件
访问 Redis
调用第三方接口
```

判断方法：

```txt
如果一个函数返回 Promise，就用 await 等它。
如果后续代码依赖它的结果，也要 await。
```

## 4. 为什么错误密码返回 500，不是 401

因为你的代码里当时写的是普通 `Error`：

```ts
throw new Error('Invalid email or password');
```

普通 `Error` 对 Nest 来说是“未知系统异常”。

Nest 不知道它应该对应哪个 HTTP 状态码，所以全局异常过滤器会把它当成：

```txt
500 Internal Server Error
```

登录失败属于认证失败，应该抛 Nest 提供的：

```ts
throw new UnauthorizedException('email or password is incorrect');
```

`UnauthorizedException` 对应：

```txt
401 Unauthorized
```

注册邮箱重复属于请求不符合业务规则，可以抛：

```ts
throw new BadRequestException('email already registered');
```

它对应：

```txt
400 Bad Request
```

我已经把代码改成了 Nest 的 HTTP 异常：

```ts
if (!user) {
  throw new UnauthorizedException('email or password is incorrect');
}

if (!isPasswordValid) {
  throw new UnauthorizedException('email or password is incorrect');
}
```

所以错误密码现在应该返回 401。
