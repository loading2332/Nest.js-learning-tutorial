# Q

- module是不是和java中的class一样的东西？如果不是，module和class有什么区别？或者说是和jar一样？
- 导入模块不是导入某个文件，而是导入一个被 `@Module()` 装饰的模块类。这句话什么意思？
- exports的不是module吗？service不应该什么模块都能写在providers中直接使用吗？为什么说是要exports后其他模块才能注册？如果不exports，其他模块就不能注册吗？为什么？

# A

## 1. NestJS 的 Module 和 Java 的 class 一样吗？和 jar 一样吗？

不一样。

NestJS 里的 `Module` 本质上仍然是一个 TypeScript `class`，但它不是普通业务类，而是一个被 `@Module()` 装饰器标记过的“功能组织单元”。

普通 class 主要描述一个对象有什么属性、方法，负责具体行为。

例如：

```ts
export class User {
  constructor(
    public id: number,
    public name: string,
  ) {}
}
```

这个 `User` class 描述的是“用户对象”。

而 NestJS Module 更像是一个功能包的配置入口：

```ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

这里的 `UsersModule` 不是用来保存用户数据的，也不是用来写具体业务逻辑的。它的作用是告诉 NestJS：

```txt
UsersModule 这个功能模块里有：

- UsersController
- UsersService
```

所以可以这样理解：

```txt
普通 class
  -> 描述一个具体对象或一段具体能力

NestJS Module
  -> 组织一组相关的 Controller、Service、Provider
```

它也不完全等于 Java 的 jar。

jar 更像是一个已经打包好的代码产物，可以被其他 Java 项目引入。NestJS Module 不是打包文件，而是运行时给 NestJS 框架读取的模块配置。

如果一定要类比，可以这样记：

```txt
Java class
  -> 类似 TypeScript class

Java package
  -> 类似按目录组织代码

Java jar
  -> 类似构建后的代码包

NestJS Module
  -> 更像“框架层面的功能模块配置”
```

所以 `CoursesModule` 的意义不是“一个类”，也不是“一个 jar”，而是：

```txt
课程功能的边界：
课程相关 Controller 和 Service 都归它管理。
```

## 2. “导入模块不是导入某个文件，而是导入一个被 `@Module()` 装饰的模块类”是什么意思？

这句话容易混淆，因为 TypeScript 里的 `import` 确实是在从文件里导入东西。

例如：

```ts
import { CoursesModule } from './courses/courses.module';
```

这行代码从文件 `./courses/courses.module.ts` 中导入了 `CoursesModule` 这个类。

但 NestJS 的 `imports` 配置里写的不是文件路径，而是模块类本身：

```ts
@Module({
  imports: [CoursesModule],
})
export class AppModule {}
```

注意这里：

```ts
imports: [CoursesModule]
```

数组里放的是 `CoursesModule` 这个类，不是字符串路径：

```ts
// 错误理解
imports: ['./courses/courses.module']
```

也不是把整个文件内容直接塞进来。

NestJS 会读取 `CoursesModule` 类上面的 `@Module()` 元数据：

```ts
@Module({
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
```

也就是说，`AppModule` 导入 `CoursesModule` 后，NestJS 能知道：

```txt
CoursesModule 里面注册了 CoursesController 和 CoursesService。
```

完整流程可以这样理解：

```txt
1. TypeScript import 从文件里拿到 CoursesModule 这个类
2. AppModule 的 imports 引用 CoursesModule
3. NestJS 读取 CoursesModule 上的 @Module() 配置
4. NestJS 加载 CoursesModule 管理的 Controller 和 Provider
```

所以“导入模块不是导入某个文件”的意思是：

> NestJS 关心的是 `CoursesModule` 这个被 `@Module()` 标记的模块类，而不是单纯关心 `courses.module.ts` 这个文件。

文件只是存放代码的地方，真正参与 NestJS 模块系统的是类和装饰器元数据。

## 3. `exports` 导出的不是 Module 吗？为什么 Service 不能在任何模块的 `providers` 里直接使用？

在 NestJS 里，`exports` 通常导出的是 Provider，比如 Service，而不是导出 Module 本身。

例如：

```ts
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

这里的意思是：

```txt
UsersService 是 UsersModule 内部注册的 Provider。
UsersModule 允许其他导入它的模块使用 UsersService。
```

### providers 和 exports 的区别

可以先记住一句话：

```txt
providers 是“我自己模块内部能用”。
exports 是“我愿意暴露给其他模块用”。
```

例如：

```ts
@Module({
  providers: [UsersService],
})
export class UsersModule {}
```

这种写法下，`UsersService` 只在 `UsersModule` 内部可用。

`UsersController` 可以注入它：

```ts
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
}
```

因为 `UsersController` 和 `UsersService` 都属于 `UsersModule`。

但是如果以后有一个 `AuthModule`，它也想注入 `UsersService`：

```ts
@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}
}
```

那就不能只在 `UsersModule.providers` 里注册 `UsersService`。还需要：

```ts
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

然后 `AuthModule` 导入 `UsersModule`：

```ts
@Module({
  imports: [UsersModule],
  providers: [AuthService],
})
export class AuthModule {}
```

这样 `AuthModule` 才能使用 `UsersModule` 暴露出来的 `UsersService`。

### 如果不 exports，其他模块能不能自己写到 providers 中？

技术上，另一个模块可以这样写：

```ts
@Module({
  providers: [AuthService, UsersService],
})
export class AuthModule {}
```

这样 NestJS 确实会在 `AuthModule` 里再注册一个 `UsersService`。

但这通常不是推荐做法。

原因是：这不是“使用 UsersModule 提供的 UsersService”，而是在 `AuthModule` 里重新注册了一个新的 `UsersService` Provider。

问题可能有几个：

1. 模块边界被破坏。

   `UsersService` 本来属于用户模块，现在认证模块也直接管理它，后面项目会越来越乱。

2. 可能产生多个实例。

   如果 `UsersService` 内部有状态、缓存、数据库连接、配置依赖，多处重复注册可能导致行为不一致。

3. 依赖关系不清楚。

   正确的关系应该是：

   ```txt
   AuthModule 需要用户能力
     -> 导入 UsersModule
     -> 使用 UsersModule exports 出来的 UsersService
   ```

   而不是：

   ```txt
   AuthModule 自己偷偷注册 UsersService
   ```

4. 后续维护困难。

   如果 `UsersService` 以后还依赖 `UserRepository`、`ConfigService`、`LoggerService`，你就要在多个模块里重复补这些依赖。

所以推荐写法是：

```ts
// users.module.ts
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

```ts
// auth.module.ts
@Module({
  imports: [UsersModule],
  providers: [AuthService],
})
export class AuthModule {}
```

### 那为什么说“不 exports，其他模块不能使用”？

更准确地说是：

> 如果一个模块想通过“导入某个模块”的方式使用它内部的 Provider，那么这个 Provider 必须被对方模块 `exports` 出来。

比如：

```ts
@Module({
  imports: [UsersModule],
  providers: [AuthService],
})
export class AuthModule {}
```

这里 `AuthModule` 只导入了 `UsersModule`。如果 `UsersModule` 没有：

```ts
exports: [UsersService]
```

那么 `AuthService` 就不能注入 `UsersService`。

因为 `UsersService` 只是 `UsersModule` 的内部成员，没有被公开。

你可以把它类比成对象的访问权限：

```txt
providers
  -> private/internal，模块内部可用

exports
  -> public，导入该模块的其他模块可用
```

这就是为什么 NestJS 要区分 `providers` 和 `exports`。

## 本课完成情况检查

你的第四课核心结构已经完成：

```txt
src/
  courses/
    courses.controller.ts
    courses.module.ts
    courses.service.ts
  users/
    users.controller.ts
    users.module.ts
    users.service.ts
  app.module.ts
```

`AppModule` 当前写法是正确的：

```ts
@Module({
  imports: [CoursesModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

这说明根模块已经不再直接注册 `CoursesController`、`CoursesService`、`UsersController`、`UsersService`，而是通过业务模块导入。

我执行了：

```bash
pnpm run build
```

构建通过，说明当前模块拆分可以被 NestJS 正常编译和解析。

我也执行了：

```bash
pnpm run test
```

测试没有通过，原因不是第四课模块拆分，而是默认单测还期望：

```ts
expect(appController.getHello()).toBe('Hello World!');
```

但你当前 `AppService.getHello()` 返回的是：

```ts
return 'Hello nestjs!';
```

所以后续可以把测试期望改成 `'Hello nestjs!'`，或者把 Service 返回值改回 `'Hello World!'`。这属于第一课默认接口返回值和测试没有同步的问题。
