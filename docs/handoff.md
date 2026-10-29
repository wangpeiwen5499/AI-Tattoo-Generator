# 项目交接（2026-10-29）

当前线上：https://tattoovis.ink 。业务基础分支 shipany-two；main 为旧版 Demo。

本轮修复分支 fix/production-hardening，基于 ab073cc。工作目录 E:\20261011文身项目优化\AI-Tattoo-Generator。

## 当前重点

新增签名游客身份、上传/代理/邮件接口保护、事务扣分与幂等退款、支付入账锁、可恢复 tattoo_job、刷新恢复、网站地图及私有缓存修复。历史分页与批量查询替代全量 N+1。

**尚未部署，未修改生产数据库。部署前必须完成增量数据库升级与任务调度配置。**

请阅读 [部署与回归说明](production-hardening.md)，其中包含完整步骤、行为变化、验证限制和遗留项。

## 关键入口

- 身份：src/server/auth/actor.ts、guest-token.ts
- 业务状态：src/server/ai/tattoo-jobs.ts
- API：src/app/api/ai/generate-tattoo/route.ts、status/route.ts
- 调度：src/app/api/internal/tattoo-jobs/route.ts
- 升级工具：scripts/upgrade-tattoo-jobs.ts（默认 dry run）
- 余额和退款：src/shared/models/credit.ts
- 支付事务：src/shared/models/order.ts
- 前端恢复：src/hooks/use-generation.ts
- 回归：tests/，npm test / npm run typecheck / npm run lint / npm run build

测试使用隔离 PGlite 和模拟外部服务，不访问真实 AI、支付和邮件。真实 PostgreSQL 多连接并发、Waffo 测试支付及部署后链路仍需独立验收。
