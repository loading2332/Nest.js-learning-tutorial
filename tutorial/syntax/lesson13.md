1. [{
   	"resource": "/Users/didi/develop/nest-learn/learn/src/auth/dto/register.dto.ts",
   	"owner": "typescript",
   	"code": "2564",
   	"severity": 8,
   	"message": "属性“email”没有初始化表达式，且未在构造函数中明确赋值。",
   	"source": "ts",
   	"startLineNumber": 11,
   	"startColumn": 3,
   	"endLineNumber": 11,
   	"endColumn": 8,
   	"modelVersionId": 128,
   	"origin": "extHost1"
  	}]
2. CreateUserInput为什么这里用的type而不是dto
3. import * as argon2 from 'argon2';啥意思
4. [{
   	"resource": "/Users/didi/develop/nest-learn/learn/src/auth/auth.service.ts",
   	"owner": "eslint3",
   	"code": {
   		"value": "@typescript-eslint/no-unsafe-argument",
   		"target": {
   			"$mid": 1,
   			"path": "/rules/no-unsafe-argument",
   			"scheme": "https",
   			"authority": "typescript-eslint.io"
   		}
   	},
   	"severity": 4,
   	"message": "Unsafe argument of type error typed assigned to a parameter of type `string`.",
   	"source": "eslint",
   	"startLineNumber": 33,
   	"startColumn": 7,
   	"endLineNumber": 33,
   	"endColumn": 24,
   	"modelVersionId": 422,
   	"origin": "extHost1"
   }]

# A

## 1. DTO 里的“属性没有初始化表达式”是什么意思

### 解释

你看到的是 TypeScript 的严格属性初始化检查。

代码里写：

```ts
export class RegisterDto {
  email: string;
}
```

TypeScript 会问：

```txt
这个类 new 出来的时候，email 从哪里来？
构造函数里没有赋值。
字段本身也没有默认值。
那它可能是 undefined。
```

但在 NestJS 的 DTO 场景里，字段不是我们自己在构造函数里赋值的。

请求进来后，`ValidationPipe` 和 `class-transformer` 会根据请求体创建 DTO 对象，并把字段填进去。

所以 DTO 里常见写法是使用 definite assignment assertion：

```ts
email!: string;
```

这里的 `!` 不是“非空断言”的那个运行时检查。

它是在告诉 TypeScript：

```txt
这个字段会由框架在运行时赋值，我知道它没有写在 constructor 里。
```

### 示例代码

```ts
export class RegisterDto {
  // ! 表示这个字段会在运行时被赋值，TypeScript 不要在这里报初始化错误
  email!: string;

  name!: string;

  password!: string;
}
```

注意：

```txt
! 只解决 TypeScript 编译/编辑器提示。
真正的请求校验仍然靠 class-validator。
```

所以仍然要写：

```ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
```

## 2. `CreateUserInput` 为什么用 `type`，不是 DTO

### 解释

DTO 是给接口请求用的。

例如注册接口的请求体：

```json
{
  "email": "alice@example.com",
  "name": "Alice",
  "password": "pass123456"
}
```

对应：

```ts
export class RegisterDto {
  email!: string;
  name!: string;
  password!: string;
}
```

但 `UsersService.create()` 接收的不是外部请求体。

它接收的是 `AuthService` 处理后的内部数据：

```ts
{
  email: input.email,
  name: input.name,
  passwordHash,
}
```

这里已经没有明文 `password`，而是 `passwordHash`。

所以这个类型不是“请求 DTO”，而是“Service 内部方法参数类型”。

因此用：

```ts
type CreateUserInput = {
  email: string;
  name: string;
  passwordHash: string;
};
```

更准确。

### 示例代码

```ts
// 请求层 DTO：描述客户端传什么
export class RegisterDto {
  email!: string;
  name!: string;
  password!: string;
}

// 业务内部类型：描述 UsersService.create 需要什么
type CreateUserInput = {
  email: string;
  name: string;
  passwordHash: string;
};

async register(input: RegisterDto) {
  const passwordHash = await hash(input.password);

  // 这里传给 UsersService 的已经不是 RegisterDto 了
  return this.usersService.create({
    email: input.email,
    name: input.name,
    passwordHash,
  });
}
```

判断规则：

```txt
外部请求数据：优先用 DTO class，因为需要装饰器校验。
内部函数参数：可以用 type/interface，因为只需要 TypeScript 类型约束。
```

## 3. `import * as argon2 from 'argon2';` 是什么意思

### 解释

这是 TypeScript/JavaScript 的命名空间导入写法。

意思是：

```txt
把 argon2 这个包导出的所有内容，放到 argon2 这个对象上。
```

然后可以这样用：

```ts
argon2.hash(...)
argon2.verify(...)
```

不过我已经把项目里的写法改成了更直接的命名导入：

```ts
import { hash, verify } from 'argon2';
```

这样使用时就是：

```ts
const passwordHash = await hash(input.password);
const isPasswordValid = await verify(user.passwordHash, input.password);
```

这两种写法表达的意思类似，只是风格不同。

### 示例代码

命名空间导入：

```ts
import * as argon2 from 'argon2';

const passwordHash = await argon2.hash('pass123456');
const ok = await argon2.verify(passwordHash, 'pass123456');
```

命名导入：

```ts
import { hash, verify } from 'argon2';

const passwordHash = await hash('pass123456');
const ok = await verify(passwordHash, 'pass123456');
```

本项目现在使用第二种。

## 4. `no-unsafe-argument` 是什么，为什么会提示

### 解释

`@typescript-eslint/no-unsafe-argument` 的意思是：

```txt
你把一个类型不安全的值，传给了一个要求明确类型的函数参数。
```

你看到的位置在：

```ts
await argon2.verify(user.passwordHash, input.password);
```

它通常说明 TypeScript/ESLint 没有准确推断出 `user.passwordHash` 是 `string`。

这次项目里还有一个相关原因：

```ts
import { UsersService } from 'src/users/users.service';
```

Jest 当前解析不了 `src/...` 这种路径，类型工具有时候也会跟着变得不稳定。

我已经把导入改成相对路径，并把 argon2 改成命名导入：

```ts
import { hash, verify } from 'argon2';
import { UsersService } from '../users/users.service';
```

现在代码是：

```ts
const isPasswordValid = await verify(user.passwordHash, input.password);
```

`user.passwordHash` 来自 Prisma 生成的 `User` 类型，应该能被识别成 `string`。

### 示例代码

容易触发 `no-unsafe-argument` 的例子：

```ts
function say(message: string) {
  console.log(message);
}

const value: any = 123;

// value 是 any，ESLint 不知道它是不是 string
say(value);
```

更安全的写法：

```ts
function say(message: string) {
  console.log(message);
}

const value: unknown = 'hello';

if (typeof value === 'string') {
  say(value);
}
```

在本项目里，核心思路是：

```txt
让 import 路径可解析。
让函数返回值类型明确。
不要把 any/error 类型一路传下去。
```
