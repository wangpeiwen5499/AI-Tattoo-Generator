# Google 直接登录

网站使用 Better Auth Google provider：网站 → Google → `/api/auth/callback/google` → 登录前的目标页。回调在服务器交换授权码、写入网站会话 Cookie 后直接重定向，不经过 Clerk 或 `/auth/google/tasks`。

## 生产配置

Google Cloud 现有 OAuth Web 应用新增 Authorized redirect URI：
`https://tattoovis.ink/api/auth/callback/google`

Vercel Production：
- `GOOGLE_AUTH_ENABLED=true`
- `GOOGLE_CLIENT_ID`：上述 Google OAuth Web 应用的 Client ID
- `GOOGLE_CLIENT_SECRET`：同一应用的 Client Secret

密钥只保存在 Vercel 或网站管理后台，不使用 NEXT_PUBLIC 前缀。配置变更后需要重新部署。若使用管理后台配置，字段是 google_auth_enabled / google_client_id / google_client_secret，环境变量优先。

Google Cloud 应用应处于适合真实用户使用的发布状态，授权域名包含 tattoovis.ink。保留现有 Clerk 配置和旧 Google 回调，直到在途登录结束；新登录按钮不会加载或调用 Clerk。

## 用户和余额

- 同一已验证邮箱会链接到原有用户 ID（包括先前使用 Clerk 的用户），保留余额与订单。
- 新用户沿用事务内创建用户和赠送 3 credits 的逻辑，重复登录不重复赠送。
- 未验证的本地邮箱必须先完成验证，不能自动合并不同邮箱账号。
- 登录按钮发送经过校验的站内返回地址；取消或失败返回带错误提示的登录页。

## 验收

1. 登录、注册页和弹窗中 Google 选项仍置顶，白底彩色 G 图标。
2. Google 授权请求的 redirect_uri 为 https://tattoovis.ink/api/auth/callback/google，使用 PKCE S256 和 select_account。
3. 授权后直接回原目标页，回调设置网站 session cookie，不加载 Clerk JS、不进入 /tasks。
4. 新用户收到 3 credits；退出再登录不重复赠送。老用户 ID、余额、订单不变。
5. 取消授权显示错误并能重试；伪造 state、缺失 Cookie、已消费的 state 不建立会话。

自动测试使用真实 Better Auth handler、Drizzle 测试数据库和会话 Cookie，仅替换 Google 外部 token HTTP 响应。浏览器最终选账号仍需使用用户自己的 Google 会话验证。

参考：https://www.better-auth.com/docs/authentication/google
