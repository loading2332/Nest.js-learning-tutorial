# Q

1. Adapter是什么
2. 为什么这里的update不用?可选了，都是必须了？

# A

## 1. Adapter 是什么？

Adapter 可以理解成“适配器”。

它的作用是：

```txt
把 A 系统需要的接口
转换成 B 系统真正提供的接口
让两边可以配合工作
```

在第 11 课里，A 是 Prisma Client，B 是 PostgreSQL 驱动。

Prisma 7 中连接 PostgreSQL 时，我们写：

```ts
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString,
});

super({
  adapter,
});
```

这里的意思是：

```txt
Prisma Client 不直接自己管理 PostgreSQL 连接细节。
它通过 PrismaPg 这个 adapter 去使用 pg 驱动连接数据库。
```

可以把它类比成电源转接头：

```txt
你的电脑充电器
  -> 需要某种插口

墙上的插座
  -> 是另一种形状

adapter
  -> 把两边接起来
```

在代码里：

```txt
Prisma Client
  -> 需要一个符合 Prisma adapter 接口的对象

PostgreSQL
  -> 实际连接由 pg 驱动完成

PrismaPg
  -> 负责把 Prisma 的数据库操作适配到 pg 驱动
```

所以 Adapter 不是数据库，也不是 ORM。

它只是连接 Prisma Client 和具体数据库驱动的中间层。

一句话：

```txt
Adapter 是适配层。Prisma 7 里 PostgreSQL 用 PrismaPg adapter，让 Prisma Client 能通过 pg 驱动访问数据库。
```

## 2. 为什么这里的 update 不用 `?` 可选了，都是必须了？

这里要区分两层：

```txt
DTO 输入层
  -> 字段可以是可选的

Prisma update 参数对象
  -> data 这个对象必须传
```

例如更新 DTO：

```ts
export class UpdateCourseDto {
  title?: string;
  description?: string;
  price?: number;
  status?: 'draft' | 'published';
}
```

这里的 `?` 表示：

```txt
更新课程时，用户可以只传一部分字段。
比如只传 price，不传 title。
```

但是调用 Prisma 的 `update` 时：

```ts
return this.prisma.course.update({
  where: {
    id,
  },
  data: {
    title: input.title,
    description: input.description,
    price: input.price,
    status: input.status,
  },
});
```

这里的 `where` 和 `data` 是 Prisma API 规定必须传的参数名。

它的意思是：

```txt
where
  要更新哪一条记录？

data
  要更新哪些字段？
```

所以：

```txt
data 这个对象必须有。
但是 data 里面的字段可以是 undefined。
```

如果 `input.title` 是 `undefined`，Prisma 通常不会把它更新进数据库。

也就是说：

```ts
data: {
  title: undefined,
  price: 199,
}
```

实际效果接近：

```txt
只更新 price，不更新 title。
```

为什么不是这样写？

```ts
data?: {
  title?: string;
}
```

因为 Prisma 的 `update()` 必须知道你要更新什么，所以 `data` 本身是必须的。

但 `UpdateCourseDto` 里的字段是可选的，因为用户不需要每次更新所有字段。

一句话：

```txt
UpdateCourseDto 的字段可选，表示客户端可以只传部分字段。
Prisma update 的 data 必填，表示 update 操作必须提供“更新内容”这个对象。
```
