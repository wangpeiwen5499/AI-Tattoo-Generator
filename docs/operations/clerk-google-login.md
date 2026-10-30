# TattooVis 的 Clerk Google 登录配置

网站通过 Clerk 的 OAuth / OIDC 接入 Google，继续使用现有用户 ID、邮箱密码、积分、付款记录和会话，不需要迁移用户数据库。未配置时隐藏新增按钮；三项环境变量齐全且 Discovery URL 使用 HTTPS 时显示 Google 登录。

## 1. 配置 Google → Clerk

在你的 Clerk **Production** 实例启用 Google 社交连接，并允许注册和登录。正式环境需要自己的 Google OAuth Client ID / Client Secret，填在 Clerk 中。Google 的回调地址使用 **Clerk 控制台展示的 Authorized Redirect URI**。Google OAuth 应用应发布为 In production，避免仅测试用户可用。

如果 Clerk 实例只用于本网站的 Google 登录，可在 Clerk 中只保留 Google 登录选项；网站自己的邮箱登录不受影响。若 Clerk 实例另有用途，请保留所需方式，用户进入 Clerk 后选择 Google。

先访问 Clerk Account Portal，确认 Google 登录本身可用。

## 2. 配置 Clerk → TattooVis

在 Clerk **OAuth applications** 创建名为 TattooVis 的 OAuth 应用：

- Scopes：`openid`、`email`、`profile`。
- 允许回调：`https://tattoovis.ink/api/auth/oauth2/callback/clerk`。
- 复制该 OAuth 应用的 **Client ID**、**Client Secret**、**Discovery URL**。Secret 通常只显示一次，直接保存到 Vercel。
- 使用 Clerk 托管的 Account Portal 作为登录入口，不要将 Clerk 的登录入口设为本站 `/sign-in`，否则会形成循环。

这里的回调路径已根据项目锁定的 Better Auth 1.6.26 实际实现测试。不要替换成新版文档中的 `/api/auth/callback/clerk`。

## 3. Vercel 环境变量

| 名称                        | 值                                                 |
| --------------------------- | -------------------------------------------------- |
| `CLERK_OAUTH_CLIENT_ID`     | Clerk OAuth 应用的 Client ID                       |
| `CLERK_OAUTH_CLIENT_SECRET` | Clerk OAuth 应用的 Client Secret                   |
| `CLERK_OAUTH_DISCOVERY_URL` | Clerk OAuth 应用页面提供的 Discovery URL，原样复制 |

选择 **Production**，保存后重新部署最新的 `shipany-two` 分支。无需填写 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 或 `CLERK_SECRET_KEY`；本次使用 OAuth 应用接入，不使用 Clerk React SDK。不要把 Client Secret 加上 `NEXT_PUBLIC_` 前缀。

本地测试应使用独立的开发 OAuth 应用，并允许本地回调，例如 `http://localhost:3106/api/auth/oauth2/callback/clerk`；对应 `AUTH_URL` 与站点地址也必须一致。不要把本地地址加入正式 OAuth 应用。

## 4. 验收

1. 登录页、注册页和登录弹窗出现 Google 按钮。
2. 点击后进入 Clerk，经 Google 授权后返回网站的原目标页面。
3. 首次创建网站账号仅赠送一次 3 积分。再次登录不会追加积分。
4. 以已验证邮箱的老账号登录 Google，应复用原用户 ID、余额和记录。未验证的老邮箱先使用邮箱密码登录并验证，再使用 Google；系统不会直接将未验证的老账号自动合并。
5. 退出网站会清除本网站登录；不会强制退出用户的整个 Google / Clerk 账号。

如果 Google 授权尚未成功，请先检查 Clerk 的 Google 连接、Google 发布状态、Clerk 应用回调地址及 Vercel 的生产环境变量。代码测试使用模拟 Clerk 服务，真实授权仍需配置后的人工验收。

参考：

- [Clerk Google 社交连接](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google)
- [Clerk 作为 OAuth / OIDC 服务](https://clerk.com/docs/guides/configure/auth-strategies/oauth/single-sign-on)
