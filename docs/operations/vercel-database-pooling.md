# Vercel 连接与 Supabase 会话故障

2026-11-02 线上排查确认：认证失败由 Drizzle 查询异常包装，数据库返回 SQLSTATE `XX000`；脱敏驱动摘要为 `max clients reached … session mode max clients … pool …`。这说明命中了会话池客户端上限。原先关闭认证日志后只能看到泛化的 Failed to get session，不能据此判断密码或代码字段错误。

## 运行策略

- Node 进程复用单个受限客户端池，Vercel production/preview 每实例 max=1。
- Vercel 环境下，仅将 `*.pooler.supabase.com` 的 PostgreSQL 会话端口 5432（含省略端口）切到事务端口 6543。
- 不修改用户名、密码、主机、数据库和 URL 查询参数；不解密、覆盖生产环境变量。
- 已是 6543 的事务池保持原 URL；不修改直接数据库、其他供应商、本地开发、非标准端口或 Worker/Hyperdrive 连接。
- 保持 prepare=false。事务池不附带 session search_path 启动设置；Drizzle schema 和部署 DDL 显式限定 schema。
- 部署升级脚本从 core/db 导入连接，因此同样使用运行策略。已检查事务锁为 pg_advisory_xact_lock，位于事务中。

官方依据：[Supabase 连接指南](https://supabase.com/docs/guides/database/connecting-to-postgres)、[连接池模式说明](https://supabase.com/kb/troubleshooting/supavisor-and-connection-terminology-explained-9pr_ZO)。会话池长时间占用后端连接；事务池适合横向扩展的无服务器请求。

## 安全日志

认证库通过自定义 error-only logger 记录原始异常的固定分类、标准错误码和编译位置；不记录原始 SQL、会话令牌、用户名、密码、图片或提示词。XX000 采用固定词表摘要，未知词替换为下划线，先删除引号内值及 URL。

## 平台设置

- 本机 CLI 已登录；关联 wpw-project/ai-tattoo-generator，生产域名 tattoovis.ink。
- 已有 Vercel 插件提供平台技能，无需重复安装 standalone skills。
- MCP 用户级共享地址 https://mcp.vercel.com 已完成连接登录；网站团队需要单独批准团队访问。CLI 授权与 MCP 团队授权独立。
- `.vercel` 和本地环境文件不纳入版本控制。生产敏感环境值无法下载，本次没有尝试解密。

## 部署后验收

1. 核对当前生产 alias 对应的新提交与 Ready 状态。
2. 重复访问资料、账单、积分、历史和图案页，检查状态码与页面正文。
3. 检查已登录能力、图库和图片接口，不把匿名 200 或兜底错误页面算作正常。
4. 按新 deployment ID 查询错误日志，确认是否再次出现会话池错误。
5. 在多个时间窗口做抽样；短时间未复现不等于长期可用性保证。
