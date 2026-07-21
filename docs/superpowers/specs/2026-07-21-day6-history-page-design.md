# Day 6 历史记录页设计

> **日期**：2026-07-21
> **范围**：MVP Day 6 — `/history` 页面：列出用户所有已完成的项目，可查看大图
> **依赖**：Day 1-5 已完成（Clerk 用户 + Supabase `projects`/`generations` 表 + R2 公开 URL）
> **下一步**：实施计划由 writing-plans skill 生成

---

## 1. 背景与目标

Day 4 用户能在首页生成纹身，Day 5 打通了购买 credits。但用户刷新页面、重新登录后，之前生成的纹身就找不到了（首页只显示当次会话的结果）。

Day 6 上线 `/history` 页面，让用户能查看所有历史生成记录。

**核心闭环**：
```
navbar "History" → /history → 列出所有 status='completed' 的 projects
  → 点缩略图弹 Dialog 看大图（可左右切换）
  → 空用户看到空状态 + CTA
```

**不在 Day 6 范围**（已与用户确认）：
- 生成请求并发限制（30 秒内 1 次）
- 首页 Hero / FAQ 打磨
- SEO 基础（metadata / og:image / sitemap）
- 删除记录 / 收藏 / 分享
- 分页 / 加载更多（全量返回即可）

---

## 2. 关键决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 页面架构 | **Server Component 直查 DB** | 与 `/pricing` 一致；SEO 友好；首屏快；Dialog 作为 Client 子组件抽出去 |
| 数据过滤 | **只显示 `status='completed'`** | 失败的记录体验负向；Day 5 已有退款兜底，用户感知不到损失 |
| 加载策略 | **全量返回** | MVP 用户最多 50 次生成记录（Pro 档上限），实际可能不到 10 条；分页是过早优化 |
| 交互方式 | **弹 Dialog 看大图** | 与 Day 4 `GenerationResults` 一致；不引入新动态路由 |
| Dialog 功能 | **支持左右切换上一张/下一张** | 用户想对比 4 个部位效果时不用反复开关 |
| 卡片布局 | **单列大卡片**：左纹身设计稿 1:1 + 右 prompt/时间/2x2 部位缩略图 | 与 `GenerationResults` 的视觉语言一致 |
| 时间显示 | **`toLocaleDateString('en-US', ...)`** → "Jul 21, 2026" | 避免 SSR/CSR 相对时间不一致；MVP 不需要"3 hours ago" |

---

## 3. 架构方案

```
GET /history
   │
   ▼
┌─────────────────────────────────┐
│ history/page.tsx (Server)      │
│ 1. auth() → userId             │
│ 2. ensureUser()                │
│ 3. listProjects(userId)        │
│ 4. 渲染 HistoryList 或 Empty   │
└─────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────┐
│ HistoryList (Server)           │
│ - 标题 "Your Tattoos" + 数量   │
│ - map projects → HistoryCard   │
└─────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────┐
│ HistoryCard (Server)           │
│ - 左：纹身设计稿缩略图按钮     │
│ - 右：prompt + 时间 + 2x2 部位 │
│ - 点击任意图 → HistoryImageDialog │
└─────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────┐
│ HistoryImageDialog (Client)    │
│ - 'use client'                 │
│ - useState: openIndex \| null  │
│ - Dialog + 上一张/下一张按钮   │
└─────────────────────────────────┘
```

**数据流**：
```
DB projects
  └─ (Supabase join) generations[]
       └─ tattoo_image_key（4 条共享 Step1 纹身图案）
       └─ result_image_key + result_image_url
            └─ R2 public URL → 浏览器直接拉图
```

---

## 4. 文件改动清单

### 新增

| 文件 | 类型 | 职责 |
|---|---|---|
| `src/app/history/page.tsx` | Server | auth + ensureUser + listProjects + 渲染容器 |
| `src/components/history-list.tsx` | Server | 标题 + projects.map(HistoryCard) |
| `src/components/history-card.tsx` | Server | 单卡片（左设计稿 / 右 prompt + 2x2 部位） |
| `src/components/history-image-dialog.tsx` | Client | Dialog + 上一张/下一张切换 |

### 修改

| 文件 | 改动 |
|---|---|
| `src/server/db/queries.ts` | 加 `listProjects(userId)` 函数 |
| `src/types/index.ts` | 加 `ProjectWithGenerations` 类型 |

### 不动

- `src/components/navbar.tsx` — History 链接已存在（Day 4 已加）
- `src/middleware.ts` — `/history` 已保护（Day 1 已配）

---

## 5. 详细实现

### 5.1 `listProjects(userId)` 查询

```ts
export async function listProjects(
  userId: string
): Promise<ProjectWithGenerations[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*, generations(*)')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
```

返回类型：
```ts
export type ProjectWithGenerations = ProjectRow & {
  generations: GenerationRow[]
}
```

### 5.2 Tattoo design URL 取法

`projects` 表不存纹身设计稿的 key（Step 1 的产物），但 `generations` 表的 4 条记录都共享 `tattoo_image_key`。

```ts
const tattooDesignKey = project.generations[0]?.tattoo_image_key
const tattooDesignUrl = tattooDesignKey
  ? getPublicUrl(tattooDesignKey)
  : null
```

如果 `generations` 为空（理论上不该发生，因为 Step 2 总是写 4 条），卡片跳过不渲染。

### 5.3 部位排序

`generations` 数组顺序不保证，需要用 `BODY_PARTS` 常量重新排序：

```ts
const orderedGenerations = BODY_PARTS.map((part) =>
  project.generations.find((g) => g.body_part === part)
).filter(Boolean)
```

`BODY_PARTS` 定义在 `src/lib/constants.ts`：`['left_arm', 'right_arm', 'shoulder', 'calf']`

### 5.4 `HistoryImageDialog` 组件结构

> **关键约束**：因为缩略图按钮需要触发 client state（打开 Dialog），所有缩略图按钮必须渲染在 Client Component 内部。

**组件层级**：
```
HistoryCard (Server)
  ├─ prompt + 时间（静态文本，server 渲染）
  └─ HistoryImageDialog (Client)
       ├─ 左：纹身设计稿缩略图 <button>
       ├─ 右：2x2 部位缩略图 <button> × 4
       └─ Dialog（按需弹出 + 左右切换）
```

`HistoryImageDialog` 同时负责「渲染缩略图网格」+「弹出 Dialog」两件事，因为它们共享同一组 state。这样 HistoryCard 仍是 Server Component，只渲染静态文本（prompt / 时间），把图片相关的一切委托给 Client 子组件。

Props：
```ts
type DialogImage = { url: string; title: string }

type HistoryImageDialogProps = {
  tattooDesignUrl: string | null     // null 时左侧渲染占位
  bodyParts: Array<{                 // 已按 BODY_PARTS 排序
    label: string
    url: string | null               // null 表示该部位失败
  }>
}
```

内部把 `tattooDesignUrl` + `bodyParts` 拍平成 `images: DialogImage[]`，失败的部位过滤掉（不出现在 Dialog 切换列表中）。

State：
```ts
const [openIndex, setOpenIndex] = useState<number | null>(null)
```

行为：
- 缩略图按钮 `onClick={() => setOpenIndex(对应索引)}`
- Dialog `open={openIndex !== null}`
- 内部支持 `←` / `→` 按钮切换：`(openIndex + 1) % images.length` / `(openIndex - 1 + images.length) % images.length`
- 关闭时 `setOpenIndex(null)`

可访问性：
- Shadcn Dialog 自带 Esc 关闭 + focus trap
- DialogTitle 不省略（每张图有 label）
- 按钮加 `aria-label="Previous image"` / `aria-label="Next image"`

### 5.5 空状态

```
┌──────────────────────────────────┐
│           No tattoos yet          │
│                                  │
│   Generate your first AI tattoo  │
│          to see it here.         │
│                                  │
│         [ Create Tattoo ]        │
└──────────────────────────────────┘
```

CTA `<Link href="/">Create Tattoo</Link>` 跳首页（首页已嵌入 `TattooGenerator`）。

### 5.6 时间格式

```ts
new Date(project.created_at).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})
// → "Jul 21, 2026"
```

---

## 6. 错误处理

| 场景 | 处理 |
|---|---|
| `listProjects` 抛 DB 错误 | page.tsx try/catch，渲染 "Something went wrong loading your history. Please refresh." + Retry 按钮（`<Link href="/history">Retry</Link>`） |
| 单个 project 的 `generations` 为空 | 跳过该卡片（不渲染），其余正常 |
| 未登录访问 `/history` | middleware 已拦截 → Clerk 重定向 sign-in（Day 1 已配） |
| `tattoo_image_key` 缺失（数据异常） | `HistoryImageDialog` 的 `tattooDesignUrl=null` → 左侧渲染占位 "Design unavailable"，不进入 Dialog 切换列表 |
| 单个 generation 缺 `result_image_url` | 该位置渲染 "Failed" 占位（静态 HTML，不触发 Dialog），不出现在 Dialog 切换列表中 |

---

## 7. 复用与一致性

| 视觉/逻辑 | 复用来源 |
|---|---|
| 4 部位 2x2 网格 | 参考 `src/components/generation-results.tsx` 的 `ResultCell` |
| Dialog 放大模式 | 参考同上的 `zoom` state 实现（新增上一张/下一张） |
| 部位 label | `BODY_PART_LABELS`（`src/lib/constants.ts`） |
| 部位顺序 | `BODY_PARTS`（`src/lib/constants.ts`） |
| `getPublicUrl()` | `src/lib/r2.ts` |

---

## 8. 测试与验证

### 自动化

- `npm run build` 通过
- `npm run lint` 通过

### 手动

1. **已登录有记录**：用 Day 4 已测试过的 Clerk 账号访问 `/history` → 看到之前生成的 project 卡片
2. **点开大图**：点任一缩略图 → 弹 Dialog 显示大图 → 点 `←` / `→` 可切换 → Esc 关闭
3. **空状态**：新建 Clerk 账号（或用没有 project 的账号）访问 `/history` → 看到空状态 + CTA → 点击 CTA 跳 `/`
4. **未登录拦截**：退出登录后访问 `/history` → Clerk 重定向到 sign-in
5. **数据异常**：理论上 Day 4-5 不会产生异常数据，但若手动改 DB 删掉某条 generation，应能优雅降级

---

## 9. 已知限制

- 全量加载：用户项目数 > 50（Pro 档上限）时不会出问题，但如果未来出现重度用户需要分页
- 不显示失败记录：用户看不到"为什么这次扣了 credits 却没结果"（Day 5 有退款兜底缓解）
- 不能删除：用户想清理掉不喜欢的记录暂时做不到（MVP 不做）
- 不能分享：用户想把结果分享给朋友需要自己截图（MVP 不做）

这些限制都在 MVP 边界外，Day 7 部署后看用户反馈再排优先级。

---

## 10. 后续步骤

1. 调用 `superpowers:writing-plans` skill 生成分步骤实施计划
2. 按 plan 执行实施（Server Component 先行，Client Dialog 最后）
3. 跑 build + lint + 手动验证
4. 更新 `docs/handoff.md` Day 6 完成回顾 + Day 7 准备清单
