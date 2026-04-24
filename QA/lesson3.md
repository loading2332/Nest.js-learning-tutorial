# Q

1. 所以 module controller service 就是三个层面的装配吗？ module负责装配全部的controller 路由，然后controller 路由具体分配service。
2. 然后 module 是 类似 A-B-C 中的B，得到providers然后再给controller？
3. 依赖注入的底层本质代码是怎么实现的？
4. 容器概念是什么？
5. module声明好了为什么controller中还要导入service？ module不是已经装配好controller和service了么？另外导入的名字是约定好了的从文件名来的么？比如现在是courses.service.ts，导入的时候就叫CoursesService？

# A

## 1. Module、Controller、Service 是三个层面的装配吗？

可以先这样理解，但要稍微修正一下：

```txt
Module
  -> 装配当前功能范围内的 Controller 和 Provider

Controller
  -> 装配 HTTP 路由和请求参数
  -> 调用 Service

Service
  -> 装配业务逻辑
  -> 处理数据、规则、流程
```

所以你的理解“module/controller/service 是三个层面的装配”是有道理的。

但更准确地说：

- `Module` 不是负责装配“全部”的 Controller，而是负责装配“当前模块范围内”的 Controller 和 Provider。
- `Controller` 不是真的“分配 Service”，而是“声明自己需要哪个 Service”，然后 NestJS 把 Service 注入给它。
- `Service` 不关心 HTTP，它主要负责业务逻辑。

比如现在项目中只有 `AppModule`，所以所有东西都放在它里面：

```ts
@Module({
  controllers: [AppController, CoursesController],
  providers: [AppService, CoursesService],
})
export class AppModule {}
```

这里的意思是：

```txt
AppModule 这个模块里有：
  - AppController
  - CoursesController
  - AppService
  - CoursesService
```

后面拆模块后会变成：

```txt
AppModule
  -> CoursesModule
       -> CoursesController
       -> CoursesService

  -> UsersModule
       -> UsersController
       -> UsersService
```

这样每个模块只管理自己的 Controller 和 Service。

## 2. Module 是不是类似 A-B-C 中的 B，得到 providers 然后再给 Controller？

如果你用 A-B-C 来想，可以这样类比：

```txt
A: NestJS 容器
B: Module
C: Controller / Service
```

但更准确的关系是：

```txt
NestJS 容器读取 Module 的配置
  -> 知道有哪些 controllers
  -> 知道有哪些 providers
  -> 创建 provider 实例
  -> 创建 controller 实例
  -> 把 controller 需要的 provider 注入进去
```

也就是说，`Module` 更像一张“装配清单”，不是亲自手动把 Service 塞给 Controller 的对象。

可以把 `Module` 理解成：

```txt
Module 告诉 NestJS：
  这个功能范围里有哪些 Controller？
  这个功能范围里有哪些 Provider？
  这个功能范围里要导入哪些其他 Module？
  这个功能范围里要暴露哪些 Provider 给别的 Module？
```

然后真正执行创建和注入的是 NestJS 的 IoC 容器。

用更贴近当前代码的方式说：

```ts
@Module({
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
```

这段代码不是在说：

```txt
CoursesModule 亲自 new CoursesService，然后亲自传给 CoursesController
```

而是在说：

```txt
NestJS，请在 CoursesModule 这个范围里管理 CoursesController 和 CoursesService。
如果 CoursesController 需要 CoursesService，你负责把它注入进去。
```

## 3. 依赖注入的底层本质代码是怎么实现的？

先用非常简化的版本理解。

假设我们手写一个极简容器：

```ts
class Container {
  private instances = new Map();

  register(token: any, provider: any) {
    const instance = new provider();
    this.instances.set(token, instance);
  }

  get(token: any) {
    return this.instances.get(token);
  }
}
```

使用方式：

```ts
const container = new Container();

container.register(CoursesService, CoursesService);

const coursesService = container.get(CoursesService);
const coursesController = new CoursesController(coursesService);
```

这就是最朴素的依赖注入：

```txt
对象不自己 new 依赖
而是由外部容器创建依赖
再把依赖传进来
```

在 NestJS 中，Controller 写成这样：

```ts
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}
}
```

它本质上相当于告诉容器：

```txt
创建 CoursesController 的时候，我需要一个 CoursesService。
```

NestJS 会结合 TypeScript 的装饰器元数据来识别构造函数参数类型。

大概流程可以理解为：

```txt
1. NestJS 读取 @Module 配置
2. 发现 providers 里有 CoursesService
3. 发现 controllers 里有 CoursesController
4. 读取 CoursesController 构造函数参数
5. 发现它需要 CoursesService
6. 去容器里找 CoursesService 实例
7. new CoursesController(coursesService)
```

可以写成更接近底层感觉的伪代码：

```ts
const providers = new Map();

// 1. 创建并保存 Provider
providers.set(CoursesService, new CoursesService());

// 2. 准备创建 Controller
const coursesService = providers.get(CoursesService);

// 3. 把依赖传进去
const coursesController = new CoursesController(coursesService);
```

真实 NestJS 会复杂很多，因为它还要处理：

- 一个 Service 依赖另一个 Service。
- Module 之间的 `imports` 和 `exports`。
- Provider 的作用域，比如默认单例、请求级别实例。
- 自定义 Provider，比如 `useClass`、`useValue`、`useFactory`。
- 循环依赖。
- 生命周期钩子。

但第一阶段你抓住这个本质就够了：

```txt
依赖注入 = 我不在类里面自己 new 依赖，而是声明我需要什么，由容器创建并传给我。
```

当前课程里的关系可以这样看：

```txt
AppModule
  -> 注册 CoursesController
  -> 注册 CoursesService

NestJS 容器
  -> 创建 CoursesService
  -> 创建 CoursesController
  -> 把 CoursesService 传给 CoursesController

请求进来
  -> CoursesController 接请求
  -> CoursesController 调 CoursesService
  -> CoursesService 做业务
```

一句话总结：

```txt
Module 提供装配清单，NestJS 容器负责实例化和注入，Controller 使用 Service 完成请求处理。
```

## 4. 容器概念是什么？

这里说的“容器”不是 Docker 容器，而是 NestJS 里的 IoC Container，也可以先理解成：

```txt
一个专门管理对象创建、保存、查找和注入的管理器。
```

在普通代码里，你如果需要一个对象，通常会自己创建：

```ts
const coursesService = new CoursesService();
const coursesController = new CoursesController(coursesService);
```

也就是说：

```txt
你自己负责 new
你自己负责保存
你自己负责传递
```

而有了容器之后，这些事情交给框架：

```txt
NestJS 容器负责 new CoursesService
NestJS 容器负责保存 CoursesService 实例
NestJS 容器负责创建 CoursesController
NestJS 容器负责把 CoursesService 传给 CoursesController
```

所以容器本质上可以想象成一个 `Map`：

```ts
const container = new Map();

container.set(CoursesService, new CoursesService());

const coursesService = container.get(CoursesService);
const coursesController = new CoursesController(coursesService);
```

当然，真实 NestJS 容器比这个 `Map` 复杂很多，但第一阶段可以先这么理解。

### 为什么叫容器？

因为它“装着”应用里需要被管理的对象。

比如当前项目中，容器可能管理这些东西：

```txt
AppService 实例
CoursesService 实例
AppController 实例
CoursesController 实例
```

当某个类需要另一个类时，它不用自己创建，只需要在构造函数里声明：

```ts
constructor(private readonly coursesService: CoursesService) {}
```

NestJS 容器看到后就会说：

```txt
CoursesController 需要 CoursesService。
我已经知道怎么创建 CoursesService。
那我创建 CoursesController 时，把 CoursesService 传进去。
```

### 容器和 Module 是什么关系？

`Module` 是配置清单，`容器` 是执行装配的人。

你可以这样分：

```txt
Module:
  告诉 NestJS 有哪些 Controller 和 Provider

Container:
  根据 Module 的信息创建对象、保存对象、注入对象
```

对应代码：

```ts
@Module({
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
```

这段代码是在给容器提供信息：

```txt
请你管理 CoursesController。
请你管理 CoursesService。
如果 CoursesController 需要 CoursesService，请注入它。
```

### 容器解决了什么问题？

容器主要解决对象之间的依赖管理问题。

没有容器时，依赖关系可能这样散落在代码中：

```ts
const logger = new Logger();
const config = new ConfigService();
const database = new DatabaseService(config);
const coursesService = new CoursesService(database, logger);
const coursesController = new CoursesController(coursesService);
```

项目变大后，每个地方都要手动 `new`，会非常麻烦。

有容器后，你只需要声明依赖：

```ts
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}
}
```

`CoursesService` 如果还依赖别的对象，也继续声明：

```ts
export class CoursesService {
  constructor(private readonly databaseService: DatabaseService) {}
}
```

容器会顺着依赖关系去创建：

```txt
CoursesController
  -> 需要 CoursesService
       -> 需要 DatabaseService
```

然后按正确顺序组装好。

### 一句话理解

```txt
容器就是 NestJS 内部的对象管理中心。
它根据 Module 的配置，创建 Provider，并把 Provider 注入到需要它的 Controller 或其他 Provider 中。
```

## 5. Module 声明好了，为什么 Controller 中还要导入 Service？

这里要区分两个概念：

```txt
Module 里的 providers: [CoursesService]
  -> 是告诉 NestJS 容器：请你管理 CoursesService 这个类。

Controller 文件里的 import { CoursesService } from './courses.service'
  -> 是告诉 TypeScript：当前这个文件里要使用 CoursesService 这个类型/变量名。
```

也就是说，`Module` 解决的是“运行时由 NestJS 容器管理和注入对象”的问题；`import` 解决的是“当前 TypeScript 文件能不能识别这个名字”的问题。

比如 Controller 里写：

```ts
import { Controller } from '@nestjs/common';
import { CoursesService } from './courses.service';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}
}
```

这里的 `CoursesService` 出现了两次：

```ts
private readonly coursesService: CoursesService
```

第一个 `coursesService` 是属性名，可以自己起名。

第二个 `CoursesService` 是类型名，也是 NestJS 用来判断要注入哪个 Provider 的关键线索。

如果不写 import，TypeScript 不知道 `CoursesService` 是谁，会报类似这样的错误：

```txt
Cannot find name 'CoursesService'.
```

所以：

```txt
Module 负责注册和装配。
import 负责让当前文件认识这个类名。
constructor 负责声明 Controller 需要这个依赖。
NestJS 容器负责真正创建并注入实例。
```

完整流程可以这样理解：

```txt
1. courses.service.ts 导出 CoursesService
2. courses.controller.ts import CoursesService
3. CoursesController 在 constructor 中声明自己需要 CoursesService
4. app.module.ts 在 providers 中注册 CoursesService
5. NestJS 容器创建 CoursesService 实例
6. NestJS 容器创建 CoursesController，并把 CoursesService 实例传进去
```

对应代码是：

```ts
// courses.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class CoursesService {
  findAll() {
    return ['NestJS 入门', 'TypeScript 基础'];
  }
}
```

```ts
// courses.controller.ts
import { Controller, Get } from '@nestjs/common';
import { CoursesService } from './courses.service';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  findAll() {
    return this.coursesService.findAll();
  }
}
```

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class AppModule {}
```

### 导入的名字是由文件名决定的吗？

不是。

导入时用什么名字，主要由 `export` 出来的名字决定，不是由文件名自动决定。

比如在 `courses.service.ts` 里面写的是：

```ts
export class CoursesService {}
```

那么别的文件就要这样导入：

```ts
import { CoursesService } from './courses.service';
```

这里的规则是：

```txt
./courses.service
  -> 指向文件路径 courses.service.ts

{ CoursesService }
  -> 指向这个文件中 export 出来的 CoursesService
```

所以文件名和类名只是通常保持一致，方便阅读和维护，但不是强制绑定。

例如下面这样也可以运行，但不推荐：

```ts
// courses.service.ts
export class MyCourseManager {}
```

导入时就必须写：

```ts
import { MyCourseManager } from './courses.service';
```

然后 Module 里也要注册这个类：

```ts
@Module({
  providers: [MyCourseManager],
})
export class AppModule {}
```

如果你写成：

```ts
import { CoursesService } from './courses.service';
```

就会报错，因为 `courses.service.ts` 并没有导出一个叫 `CoursesService` 的东西。

### 那为什么大家都写成 CoursesService？

这是 NestJS 和 TypeScript 项目里的常见命名习惯：

```txt
courses.service.ts      -> export class CoursesService
courses.controller.ts   -> export class CoursesController
courses.module.ts       -> export class CoursesModule
```

这样做的好处是：

- 看文件名就知道里面大概导出了什么类。
- 看类名就知道它大概属于哪个文件。
- 项目变大后更容易维护。
- Nest CLI 自动生成代码时也会遵守这个习惯。

一句话总结：

```txt
Module 里的 providers 是给 NestJS 容器看的。
Controller 里的 import 是给 TypeScript 当前文件看的。
constructor 里的 CoursesService 类型声明，是告诉 NestJS：创建 Controller 时请注入这个 Service。

导入名不是由文件名自动决定的，而是由 export 出来的名字决定的。
文件名和类名保持一致只是工程习惯，不是语法强制。
```
