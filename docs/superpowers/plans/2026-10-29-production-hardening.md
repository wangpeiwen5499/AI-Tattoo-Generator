# Production Hardening Implementation Plan

> 游客试用部分已由 2026-10-29-registration-trial-funnel.md 的注册体验流程取代；本文保留原修复记录。

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. Steps use checkbox syntax.

**Goal:** 修复已授权审查中发现的生产风险，保持现有纹身业务可用。
**Architecture:** 复用现有基础设施，强化信任边界和事务；以数据库持久化短步骤替代脱离请求生命周期的长任务。
**Tech Stack:** Next.js 16, TypeScript, Drizzle, PostgreSQL, Vitest, PGlite.
**Spec:** ../specs/2026-10-29-production-hardening-design.md

## Global Constraints

- 不操作生产数据，不推送或部署。
- 不改变套餐价格；游客额度保持 3 次 / IP / UTC 日。
- 旧 unsigned guest cookie 不再认可。
- 部分失败保留结果并全额返还付费积分。

## Review Focus

- 伪造、过期、跨身份 Cookie 和图片 key 必须拒绝。
- 最后一个积分被并发消费时只能成功一次；重复回调、重复退款不得重复入账。
- 外部任务创建超时不得无条件重试造成额外账单。
- 工作进程中断后可从持久化阶段恢复；过期任务可终结、退款。
- 网络失败与退款失败不能向用户宣称成功或已退款。

### Task 1: 身份和接口边界

Files: server/auth/_, api/upload-url, api/email/send-email, api/proxy/file, api/storage/upload-image, lib/r2, tests/security._
Interfaces: 签名游客令牌；验证当前身份的上传对象；受信图片下载。

- [x] 编写令牌、文件归属、无权限接口及代理回归测试并观察失败。
- [x] 修复实现，运行对应测试。

### Task 2: 计费事务

Files: shared/models/credit, shared/models/order, server/db/guest-queries, tests/billing.*
Interfaces: consumeCredits 返回消费记录；refundConsumedCredits 原子幂等退款；claimGuestFree 支持事务。

- [x] 编写余额不足回滚、超过十条 grant、重复退款、重复支付及游客额度测试并观察失败。
- [x] 修复事务和锁定顺序，运行数据库回归测试。

### Task 3: 可恢复生成

Files: config/db/schema, server/ai/_, server/db/tattoo-queries, api/ai/generate-tattoo/_, api/internal/tattoo-jobs, scripts/upgrade-tattoo-jobs, tests/generation.*
Interfaces: 持久化 job，startTattooGeneration / advanceTattooJob；有界、租约保护的单步推进。

- [x] 编写分阶段推进、恢复、并发、超时、部分失败退款测试并观察失败。
- [x] 实现事务创建、状态推进与受保护补偿入口，运行测试。

### Task 4: 页面、配置与交付验证

Files: hooks/use-generation, tattoo components, proxy, sitemap, translations, env example, README, docs/handoff, eslint.config, CI.

- [x] 统一额度文案；恢复轮询；真实阶段和退款状态；修复站点地图和私有缓存。
- [x] 运行完整测试、类型检查、代码检查和生产编译；检查最终 diff。
- [x] 独立审查重要问题并修复；记录验证证据与上线前置步骤。

## Progress

- 开始于 ab073cc；独立本地分支 fix/production-hardening。用户已授权按前次分析修复，采用本会话顺序执行。

- 2026-10-29 本地完成：30 项测试通过；typecheck / build 通过；lint 无新增错误（72 项模板错误另行记录）。
- 独立审查修复：用户锁改为 no key update，避免外键锁升级；持久化 checkedAt 防止异常任务饿死其他任务；优先发现当前在途任务，避免旧结果遮挡。
- 上线前置：增量数据库升级、配置定时推进；真实 PostgreSQL 并发和 Waffo 测试支付验收，均未操作生产环境。
