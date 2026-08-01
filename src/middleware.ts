import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// 只保护 /history 路由，首页和 sign-in/sign-up 公开
const isProtectedRoute = createRouteMatcher(['/history(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  // 给所有访客发 guest_id cookie（登录用户也会拿到，无害——getActor 优先用 userId）。
  // 游客身份就靠它（guest_<uuid>）。
  const res = NextResponse.next()
  if (!req.cookies.get('guest_id')) {
    res.cookies.set('guest_id', `guest_${crypto.randomUUID()}`, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 年
      path: '/',
    })
  }
  return res
})

export const config = {
  matcher: [
    // 跳过 Next.js 内部请求和静态资源
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // 始终运行 middleware 于 API 路由
    '/(api|trpc)(.*)',
  ],
}
