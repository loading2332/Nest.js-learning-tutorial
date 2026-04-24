1. main.ts 的职责是什么？

答：main.ts 是应用入口，核心职责是启动 Nest 应用。
- 通过 NestFactory.create(AppModule) 创建应用实例。
- 通过 app.listen(process.env.PORT ?? 3000) 监听端口。
- 一般全局配置也会放在这里，例如全局前缀、全局管道、跨域等。

2. AppModule 的 controllers 和 providers 分别注册什么？

答：
- controllers: [AppController]
	负责注册控制器，用来接收 HTTP 请求并返回响应。
- providers: [AppService]
	负责注册可注入的提供者（服务），用于承载可复用的业务逻辑。

在当前项目里，AppController 通过构造函数注入 AppService，并在路由方法中调用它。

3. 为什么业务逻辑更适合放到 Service，而不是都写在 Controller？

答：主要是为了分层清晰、可维护、可测试、可复用：
- 职责单一：Controller 关注“路由和参数”，Service 关注“业务规则”。
- 更易测试：Service 可独立做单元测试，不依赖 HTTP 上下文。
- 更易复用：多个 Controller 或任务（如定时任务、消息消费者）可以共享同一个 Service。
- 更易演进：后续接数据库、缓存、第三方接口时，改动集中在 Service 层，Controller 更稳定。

一句话：Controller 像“前台接待”，Service 像“后台处理中心”。