# Kie.ai GPT Image 2 API 使用文档

> 来源：  
> - https://kie.ai/zh-CN/gpt-image-2（字段定义、Playground）  
> - https://docs.kie.ai/（鉴权、异步任务模型、速率限制等通用规范）  
> - `docs/gpt image2 接口调用.md`（用户提供的真实接口示例，已合入 §7）  
> 最后整理：2026-07-19

本项目的 AI 调用通过 Kie.ai 中转调用 OpenAI gpt-image-2，避开国内直连 OpenAI 的风险。

---

## 1. 为什么用 Kie.ai

| 维度 | 说明 |
|---|---|
| 国内可访问 | 无需科学上网，可直接 `fetch('https://api.kie.ai')` |
| 价格 | 官方声称比 OpenAI 原生便宜 30%–50%，部分模型最高 80% |
| 模型覆盖 | 兼容 gpt-image-2 的文生图 + 图生图，正好匹配本项目两步流程 |
| 付款 | 支持 credits 制，国内支付方式更友好 |

**代价**：稳定性略低于官方、媒体文件只保留 14 天（必须及时下载到 R2）。

---

## 2. 账号准备清单

1. **注册 / 登录**：https://kie.ai
2. **获取 API Key**：https://kie.ai/api-key → 创建并复制（形如 `sk-xxxxxxxx`）
3. **充值**：在 dashboard 里买 credits，建议首次 $10 试水
4. **Playground 验证效果**：https://kie.ai/zh-CN/gpt-image-2 → 上传测试照片 → 调 prompt → 确认效果达标（≥60% 通过率）后再写代码
5. **(可选) 配置 IP 白名单**：在 API Key 管理页限制只允许服务器 IP 访问

---

## 3. 环境变量

`.env.local` 增加（**不要复用 `OPENAI_API_KEY` 这个名字**，方便日后切换）：

```bash
KIE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
KIE_BASE_URL=https://api.kie.ai
# R2_PUBLIC_URL 已配置，正好作为 input_urls 输入源
```

> **安全提示**：`KIE_API_KEY` 只能在服务端（API Route / Server Component）使用，**严禁**出现在客户端代码或 `NEXT_PUBLIC_*` 变量里。

---

## 4. 鉴权

所有请求必须带两个 header：

```
Authorization: Bearer $KIE_API_KEY
Content-Type: application/json
```

缺失或错误会返回：

```json
{ "code": 401, "msg": "You do not have access permissions" }
```

---

## 5. 异步任务模型（关键差异）

Kie.ai **不是同步返回图片**，而是异步任务流：

```
客户端 ──POST /api/v1/jobs/createTask──> Kie.ai   → 返回 { data: { taskId } }
                                                       │
                                                       ▼
                                         后台异步执行（约 3 秒/张）
                                                       │
客户端 <──轮询 / 回调─────────────────── Kie.ai   → 返回图片 URL
```

**两种拿结果的方式**：

1. **轮询（推荐 MVP 用）**：用 `taskId` 周期性查询，直到状态变 `success` / `failed`
2. **回调 webhook**：创建任务时在顶层带 `callBackUrl`，Kie.ai 完成后 POST 过去

MVP 阶段用**轮询**即可，简单可控。

### 统一入口

所有模型共用一个 endpoint，靠 body 里的 `model` 字段区分：

```
POST https://api.kie.ai/api/v1/jobs/createTask
```

### 速率限制

- 每 10 秒最多 20 个新任务（账号维度）
- 通常支持 100+ 并发任务
- 超限返回 HTTP 429，请求不会入队

### 任务状态流转

```
created → running → success
                  ↘ failed
```

### 数据保留

- 生成图片：**14 天后自动删除**
- 日志元数据：2 个月
- **必须**在拿到 URL 后立即 `fetch(url)` + PUT 到 R2

---

## 6. 两种模式字段定义

> ⚠️ 下表的字段都在 body 的 **`input` 对象里**，不是顶层。顶层只有 `model` / `callBackUrl` / `input`。  
> 完整请求结构见 §7。

### 6.1 Text-to-Image（文生图）

**模型 ID**：`gpt-image-2-text-to-image`

**请求字段**：

| 字段 | 类型 | 必填 | 取值 | 默认 | 说明 |
|---|---|---|---|---|---|
| `prompt` | string | ✅ | 自由文本 | — | 描述要生成的图像 |
| `aspect_ratio` | string | ❌ | `auto` / `1:1` / `9:16` / `16:9` / `4:3` / `3:4` | `auto` | 生成图的宽高比 |
| `nsfw_checker` | boolean | ❌ | `true` / `false` | `true` | 内容审核开关 |

**本项目用途**：Step 1，把"dragon japanese style"这类 prompt 生成纹身图案（白底、线条清晰）。

### 6.2 Image-to-Image（图生图）

**模型 ID**：`gpt-image-2-image-to-image`

**请求字段**：

| 字段 | 类型 | 必填 | 取值 | 默认 | 说明 |
|---|---|---|---|---|---|
| `prompt` | string | ✅ | 自由文本 | — | 编辑指令，例如 "Apply tattoo on left arm" |
| `input_urls` | string[] | ✅ | URL 数组 | — | 参考图（最多 16 张） |
| `aspect_ratio` | string | ❌ | 同上 6 个值 | `auto` | 输出图比例 |
| `nsfw_checker` | boolean | ❌ | `true` / `false` | `true` | 内容审核 |

**`input_urls` 约束**：

- 单文件最大 **30MB**
- 数组最多 **16** 个 URL
- 格式：`JPEG` / `PNG` / `WEBP` / `JPG`
- 必须是**可公网访问的 URL**（正好用我们的 `R2_PUBLIC_URL`）

**本项目用途**：Step 2，把纹身图案 + 身体照片融合，生成 4 个部位（左臂/右臂/肩膀/小腿）的预览图。

---

## 7. 真实接口示例（已验证）

### 7.1 创建任务

**请求**：

```bash
curl --location 'https://api.kie.ai/api/v1/jobs/createTask' \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "gpt-image-2-image-to-image",
    "callBackUrl": "https://your-domain.com/api/callback",
    "input": {
      "prompt": "take a photo with Sam Altman in the conference room",
      "input_urls": [
        "https://static.aiquickdraw.com/tools/example/1776782793756_wrogXTdd.png"
      ],
      "aspect_ratio": "auto"
    }
  }'
```

**响应**：

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "task_gptimage_1765180586443"
  }
}
```

### 7.2 关键结构要点

| 字段 | 层级 | 类型 | 说明 |
|---|---|---|---|
| `model` | 顶层 | string | 模型 ID，如 `gpt-image-2-image-to-image` / `gpt-image-2-text-to-image` |
| `callBackUrl` | 顶层 | string | 可选，回调 URL（**注意是 camelCase**） |
| `input` | 顶层 | object | 业务参数都包在这里 |
| `input.prompt` | input 内 | string | 必填 |
| `input.input_urls` | input 内 | string[] | 图生图必填，URL 数组 |
| `input.aspect_ratio` | input 内 | string | 可选，6 选 1 |
| `input.nsfw_checker` | input 内 | boolean | 可选，默认 true |

**响应字段**：

| 字段 | 说明 |
|---|---|
| `code` | 200 表示任务创建成功（不等于图片生成完成） |
| `msg` | `"success"` 或错误描述 |
| `data.taskId` | 任务 ID（**camelCase**，用于后续轮询/回调对账） |

### 7.3 查询任务结果（⏳ 待补）

> ⚠️ **此接口尚未从 kie.ai 文档抓到**。  
> 根据 kie.ai 通用文档说明，查询接口大概率是 `GET /api/v1/jobs/record-info?taskId=xxx` 或类似路径。  
> **下次会话开始 Day 3 前，需要先在 Playground 跑一次拿真实查询接口示例**。

### 7.4 调用流程伪代码（修正版）

```ts
// 1. 创建任务（注意 body 包了一层 input）
const createRes = await fetch(`${process.env.KIE_BASE_URL}/api/v1/jobs/createTask`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-image-2-image-to-image',
    input: {
      prompt: 'Apply this dragon tattoo design on the left arm of the person',
      input_urls: [
        bodyPhotoUrl,    // R2 公开 URL
        tattooDesignUrl, // R2 公开 URL（Step 1 的输出）
      ],
      aspect_ratio: '3:4',  // ⚠️ 只能选 auto|1:1|9:16|16:9|4:3|3:4，没有 2:3
    },
  }),
});
const { data: { taskId } } = await createRes.json();  // 注意是 taskId 不是 task_id

// 2. 轮询任务（具体 endpoint 见 §7.3，待补）
const result = await pollUntilDone(taskId);

// 3. 下载图片到 R2（kie.ai 媒体只保留 14 天）
const imageBuffer = await fetch(result.output_url).then(r => r.arrayBuffer());
await r2.putObject({ ... });
```

---

## 8. 错误处理建议

Kie.ai 的响应统一是 `{ code, msg, data }` 结构，HTTP 状态码和 `code` 字段都需检查。

| 场景 | 表现 | 处理 |
|---|---|---|
| Key 错误 / 过期 | `code: 401` + msg "You do not have access permissions" | 提醒管理员，不要重试 |
| 请求参数错误 | `code: 4xx` + msg 描述 | 不重试，记录日志返回 4xx 给前端 |
| 速率超限 | HTTP 429 | 指数退避重试（最多 3 次） |
| 任务执行失败 | 轮询返回 `status: failed` | 记录错误、退还 credits（业务层）、返回 5xx 给前端 |
| 轮询超时（>60s） | — | 标记任务为超时，提示用户重试 |

---

## 9. 对本项目（Day 3）的影响

### 9.1 与原 mvp-plan.md 的差异

| 维度 | 原计划 | 实际 |
|---|---|---|
| SDK | `openai` npm 包 | **不用**，直接 `fetch` |
| Endpoint | OpenAI 原生 `/v1/images/generations` | **统一** `POST /api/v1/jobs/createTask`，靠 `model` 字段区分 |
| 请求体 | 扁平 `{ prompt, image, size }` | **嵌套** `{ model, callBackUrl, input: { prompt, input_urls, aspect_ratio } }` |
| 响应 ID | 直接拿图片 base64 / URL | 先拿 `data.taskId`，再轮询查结果 |
| 调用模式 | 同步 | 异步任务 + 轮询（或回调） |
| 图片输入 | multipart/form-data file | `input_urls` URL 数组 |
| 尺寸 | `size: "1024x1024"` | `aspect_ratio`（6 选 1） |
| 模型名 | `gpt-image-1` | `gpt-image-2-image-to-image` / `gpt-image-2-text-to-image` |

### 9.2 关键约束

- **`aspect_ratio` 只有 6 个值**：`auto | 1:1 | 9:16 | 16:9 | 4:3 | 3:4`  
  → 身体照片（竖图）建议用 `3:4` 或 `9:16`，纹身图案（方图）建议用 `1:1`
- **图片必须先在 R2**：用户上传的照片要先 PUT 到 R2 拿到公开 URL 才能传给 Kie.ai
- **下载要快**：Kie.ai 输出 URL 14 天失效，但更重要的是把数据攥在自己手里，建议生成完立即落 R2

### 9.3 建议的文件结构

```
src/server/ai/
├── kie-client.ts          # fetch 封装：createTask / pollTask / downloadImage
├── generate-tattoo.ts     # Step 1：prompt → 纹身图案 URL（落 R2）
├── apply-to-body.ts       # Step 2：纹身 + 身体 → 4 部位融合图（并发）
└── types.ts               # 任务类型定义
```

### 9.4 成本估算（待 Playground 验证后回填）

Kie.ai 没在主页面公布精确单价，需登录后在 https://kie.ai/pricing 查看。  
预算 = 单次生成成本 × 25（测试）+ 后续用户每次 1 credit 对应的成本。

---

## 10. 上线前检查清单

- [ ] Kie.ai 账号已注册、API Key 已拿到、已充值
- [ ] Playground 用 5 张照片 × 5 个 prompt 跑过，通过率 ≥60%
- [ ] `.env.local` 已配 `KIE_API_KEY` 和 `KIE_BASE_URL`
- [x] **已确认创建任务接口**：`POST /api/v1/jobs/createTask`
- [ ] **待确认查询任务接口**：在 Playground 跑一次实际生成，截图"查询任务状态"接口的 curl
- [ ] 已确认单价和并发额度够用
- [ ] R2 公开域名（`R2_PUBLIC_URL`）可达

---

## 参考资料

- Kie.ai GPT Image 2 主页：https://kie.ai/zh-CN/gpt-image-2
- Kie.ai 通用 API 文档：https://docs.kie.ai/
- API Key 管理：https://kie.ai/api-key
- 定价：https://kie.ai/pricing
- 任务日志：https://kie.ai/logs
- 模型市场：https://kie.ai/market
