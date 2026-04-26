# Q

- Validation pipe 到底是单单校验，还是说会进行转换？
- 转换完之后是符合 DTO 吗？
- Page 和 Limit 都没有用上可选，是不是因为已经写了 DefaultValuePipe，所以就默认肯定会传东西进去？
- 怎么 DTO 还能拿来当查询的东西使用？感觉对于 DTO 还有这些什么 Pipe 什么乱七八糟的校验，越来越弄不清楚，越来越模糊了
- 怎么自定义 Pipe 又用上 @Injectable() 了？这个依赖注入不应该只有 Service 用的吗，这个也要依赖注入？
- 既然能够自定义 Pipe，那它不是跟 DTO 有点冲突了吗？因为自定义 Pipe 的话也可以做到很复杂的场景

# A

## 1. ValidationPipe 到底是只校验，还是也会转换？

`ValidationPipe` 主要职责是校验，但开启 `transform: true` 后，它也会配合 `class-transformer` 做转换。

你现在的 `main.ts` 是：

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

这三个配置可以这样理解：

```txt
whitelist: true
  -> 去掉 DTO 中没有声明的字段

forbidNonWhitelisted: true
  -> 如果请求里出现 DTO 没声明的字段，直接返回 400

transform: true
  -> 尝试把普通对象转换成 DTO class 实例，也能配合 @Type 做字段转换
```

所以 `ValidationPipe` 的工作链路大概是：

```txt
请求体 plain object
  -> class-transformer 转成 DTO 实例
  -> class-validator 按装饰器规则校验
  -> 校验失败返回 400
  -> 校验成功进入 Controller
```

注意：不是所有类型都会自动安全转换。比如路径参数 `id` 推荐继续用 `ParseIntPipe`，查询参数数字推荐用 `DefaultValuePipe + ParseIntPipe` 或查询 DTO 配合 `@Type(() => Number)`。

## 2. 转换完之后是符合 DTO 吗？

要分两层看。

第一层：形状上会尽量变成 DTO 对应的 class 实例。

例如：

```ts
create(@Body() body: CreateCourseDto) {}
```

开启 `transform: true` 后，NestJS 会尝试把请求体转换成 `CreateCourseDto` 的实例。

第二层：值是否真的合法，要看校验是否通过。

例如：

```ts
export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsInt()
  @Min(0)
  price!: number;
}
```

如果请求是：

```json
{
  "title": "",
  "price": -1
}
```

它就算能被转换成 `CreateCourseDto` 实例，也不符合 DTO 上的校验规则，所以会返回 400。

所以更准确的说法是：

```txt
transform 负责把数据变成 DTO 形状或实例；
validate 负责判断这个 DTO 是否符合规则。
```

不要把“转换成 DTO 实例”理解成“数据一定正确”。数据正确必须靠装饰器规则校验。

## 3. Page 和 Limit 没有写可选，是不是因为有 DefaultValuePipe？

是的，当前这种写法下，Controller 方法里拿到的 `page` 和 `limit` 基本可以当成必有值：

```ts
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
```

执行逻辑是：

```txt
请求没传 page
  -> DefaultValuePipe 给 1
  -> ParseIntPipe 转成 number
  -> Controller 里 page 是 number

请求传了 page=2
  -> DefaultValuePipe 不处理
  -> ParseIntPipe 把 '2' 转成 2
  -> Controller 里 page 是 number

请求传了 page=abc
  -> ParseIntPipe 转换失败
  -> 直接 400
```

所以这里不需要写成：

```ts
page?: number
```

因为 `DefaultValuePipe` 已经保证“不传时也有默认值”。

但如果你不用 `DefaultValuePipe`：

```ts
@Query('page', ParseIntPipe) page: number
```

那不传 `page` 时就可能出问题，因为 `ParseIntPipe` 会尝试解析 `undefined`。

## 4. DTO 为什么还能拿来当查询参数使用？DTO 和 Pipe 怎么区分？

DTO 不是只能表示请求体。DTO 的本质是：

```txt
描述一组输入数据的结构和规则。
```

所以它可以用于：

```txt
@Body()
  -> 请求体 DTO

@Query()
  -> 查询参数 DTO

@Param()
  -> 路径参数 DTO，较少见
```

比如请求体 DTO：

```ts
create(@Body() body: CreateCourseDto) {}
```

查询 DTO：

```ts
findAll(@Query() query: ListCoursesQueryDto) {}
```

区别在于数据来源不同：

```txt
CreateCourseDto
  -> 描述 POST /courses 的 body

ListCoursesQueryDto
  -> 描述 GET /courses?page=1&limit=10&status=draft 的 query
```

Pipe 是处理参数的机制。DTO 是描述数据结构的 class。

它们不是同一层东西：

```txt
DTO
  -> 规则表
  -> 描述字段有哪些、每个字段应该满足什么规则

ValidationPipe
  -> 执行器
  -> 读取 DTO 上的规则，然后执行转换和校验

ParseIntPipe / CourseStatusPipe
  -> 处理单个参数
  -> 适合 id、page、status 这种局部转换或校验
```

可以这样记：

```txt
参数少、规则简单
  -> 直接用内置 Pipe
  -> @Query('page', DefaultValuePipe, ParseIntPipe)

参数多、属于一组查询条件
  -> 用查询 DTO
  -> @Query() query: ListCoursesQueryDto
```

## 5. 自定义 Pipe 为什么也用 `@Injectable()`？依赖注入不是只有 Service 用的吗？

不是。`@Injectable()` 不是 Service 专属的。

它的意思是：

```txt
这个 class 可以交给 NestJS 依赖注入容器管理。
```

Service 经常写：

```ts
@Injectable()
export class CoursesService {}
```

自定义 Pipe 也可以写：

```ts
@Injectable()
export class CourseStatusPipe implements PipeTransform {}
```

原因是 Pipe 也可能需要依赖别的东西。

例如以后你可能写：

```ts
@Injectable()
export class CourseExistsPipe implements PipeTransform {
  constructor(private readonly coursesService: CoursesService) {}

  transform(id: number) {
    // 使用 coursesService 检查课程是否存在
  }
}
```

如果没有 `@Injectable()`，NestJS 就不好把它当成可注入对象管理。

当前 `CourseStatusPipe` 虽然没有注入别的依赖，但写 `@Injectable()` 是符合 NestJS 习惯的，也为后续扩展留下空间。

可以这样记：

```txt
@Injectable()
  -> 不等于“这是 Service”
  -> 表示“这个类可以被 Nest 容器创建、管理、注入依赖”
```

Service、Pipe、Guard、Interceptor、Filter 都可能使用 `@Injectable()`。

## 6. 自定义 Pipe 会不会和 DTO 冲突？

不会冲突，但它们确实有重叠能力。

DTO + ValidationPipe 适合处理“一组对象字段”：

```ts
export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: 'draft' | 'published';
}
```

这种写法适合：

```txt
POST /courses 的 body
PATCH /courses/:id 的 body
GET /courses 的复杂 query
```

自定义 Pipe 适合处理“一个参数的特殊规则”：

```ts
@Query('status', CourseStatusPipe) status?: CourseStatus
```

这种写法适合：

```txt
单独校验 status
单独转换 id
单独检查某个参数格式
```

它们的选择标准可以这样判断：

```txt
如果你要校验一个对象里的多个字段
  -> 优先 DTO + ValidationPipe

如果你只处理某一个参数
  -> 优先内置 Pipe 或自定义 Pipe

如果规则需要复用在很多地方
  -> 可以封装成自定义 Pipe
```

不要把自定义 Pipe 当成 DTO 的替代品。它更像是“参数处理函数”。

例如当前课程列表状态筛选：

```ts
@Query('status', CourseStatusPipe) status?: CourseStatus
```

这是单个查询参数，用 Pipe 很直观。

如果以后列表查询参数变多：

```txt
keyword
status
page
limit
minPrice
maxPrice
```

就更适合抽成：

```ts
@Query() query: ListCoursesQueryDto
```

## 小结

这一课可以这样串起来：

```txt
Pipe
  -> NestJS 处理参数的机制

ParseIntPipe / DefaultValuePipe
  -> 处理简单单个参数

自定义 Pipe
  -> 封装单个参数的特殊规则

DTO
  -> 描述一组输入数据的结构和规则

ValidationPipe
  -> 执行 DTO 的转换和校验
```

最重要的判断不是“哪个更高级”，而是：

```txt
我现在处理的是一个参数，还是一组字段？
```
