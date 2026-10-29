# TattooVis — AI Tattoo Generator

上传身体照片和文字想法，生成纹身设计及四个部位的预览。

## 开发

使用 Node.js 24。当前业务分支为 `shipany-two`，`main` 为旧版 Demo。

1. `npm ci --legacy-peer-deps`
2. 将 `.env.example` 复制为 `.env.local`，配置独立开发数据库和所需服务。
3. 已有数据库：先预览 `npm run db:upgrade:tattoo-jobs`，确认后运行 `npm run db:upgrade:tattoo-jobs -- --apply`。
4. 全新开发数据库需先按 `src/config/db/schema.ts` 建表（`npm run db:push`）；不要对已有生产库直接 push 整套 schema。
5. `npm run dev`

## 检查

- `npm test`：隔离 PGlite 数据库和模拟 AI/存储，不调用真实付费服务。
- `npm run typecheck`
- `npm run lint`：阻止新增错误，并报告记录在 `eslint-baseline.json` 的模板遗留问题。
- `npm run lint:strict`：查看全部遗留问题，当前不是零错误。
- `npm run build`

PGlite 可验证 SQL、事务和业务回滚，但不能替代真实 PostgreSQL 多连接并发验证。

## 上线前

必须先阅读 [部署与回归说明](docs/production-hardening.md)。本次更新需要增量数据库升级和定时推进任务；仅部署代码不足以完成上线。

## License

本项目基于 ShipAny 商业模板，遵循 [LICENSE](LICENSE)。许可证包含禁止公开分发模板源码的条款，请核对仓库可见性与授权范围。
