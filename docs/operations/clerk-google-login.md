# TattooVis 的 Clerk 原生 Google 登录配置

当前流程：网站 Google 按钮 → Google 选择账号 → Clerk 验证身份 → 返回网站。网站不再调用 Clerk OAuth application 的授权入口，因此不会出现先前那张「TattooVis wants to access…」确认页。

Clerk 仅在专用登录页面加载。服务器使用 Clerk 官方后端 SDK 验证会话，并从 Clerk 获取已验证的邮箱和 Google 关联身份，再建立网站自己的登录会话。原有邮箱密码、用户 ID、积分和付款记录继续使用；重复登录不重复赠送积分。

## 必须保留的配置

- Google Cloud 中已有的 OAuth 应用、Client ID、Client Secret。
- Google Cloud 的 Authorized Redirect URIs：保持 Clerk 的 Google 连接页展示的 Google 回调地址，不要改成网站 `/auth/google/callback`。
- Google OAuth 应用面向真实用户时应使用 In production 发布状态。
- Clerk Production 中的 Google 连接，允许注册和登录，继续使用上面的 Google Client ID / Secret。
- Clerk 生产域名及 DNS，包括已配置的 `clerk.tattoovis.ink`。

## Vercel Production 环境变量

| 名称                                | 获取位置                                 |
| ----------------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Production → API keys，`pk_live_…` |
| `CLERK_SECRET_KEY`                  | 同一实例的 API keys，`sk_live_…`         |

这是原生 API keys，不是旧 OAuth application 的 Client ID / Secret。Secret 不应带 `NEXT_PUBLIC_` 前缀，也不应提交到仓库或聊天。保存后重新部署最新的 `shipany-two` 分支。

Clerk SDK 的站内回调由代码设置为 `/auth/google/callback`，会话完成页为 `/auth/google/complete`。这两个是本网站内部页面；不需要填入 Google Cloud 的 Authorized Redirect URIs。若 Clerk 对应用来源/返回地址设有限制，请允许 `https://tattoovis.ink` 及这两个站内地址。

Google 按钮明确请求 `prompt=select_account`。页面的具体语言、头像和已登录账号由 Google 根据浏览器及账号状态显示。首次 Google 授权、账户的 MFA、Clerk 必填信息或安全验证仍可能需要额外步骤；这些由官方登录组件处理。

## 验收后可删除的旧配置

确认新版 Google 登录成功后，可移除：

- Vercel：`CLERK_OAUTH_CLIENT_ID`、`CLERK_OAUTH_CLIENT_SECRET`、`CLERK_OAUTH_DISCOVERY_URL`。
- 先前专为这次旧方案创建的 Clerk OAuth application「TattooVis」及其 `/api/auth/oauth2/callback/clerk` 回调登记。若该 OAuth application 还被其他系统使用，请保留。

不要删除整个 Clerk 项目、Google 连接、Google Cloud 应用或网站的历史用户。代码暂保留旧回调处理，仅用于兼容已经开始的旧登录；新按钮不会进入旧流程。

## 验收清单

1. 在网站点击 Google，进入 `accounts.google.com` 的账号选择/登录页面。
2. Google 授权后返回网站，生成页显示已登录。
3. 新用户仅收到一次 3 积分；再次登录不追加。
4. 已验证邮箱的老用户复用原用户 ID、余额与记录。未验证老邮箱先使用邮箱密码完成邮箱验证，再关联 Google。
5. 退出网站后，首页不因 Clerk 的已有 Cookie 自动登录；再次点 Google 才启动登录。

参考：[Clerk Google 连接](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google)、[Clerk 原生 SSO 流程](https://clerk.com/docs/guides/development/custom-flows/authentication/oauth-connections)、[后端身份验证](https://clerk.com/docs/reference/backend/authenticate-request)。
