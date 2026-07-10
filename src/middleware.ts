import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// 只保护 /history 路由，首页和 sign-in/sign-up 公开
const isProtectedRoute = createRouteMatcher(['/history(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // 跳过 Next.js 内部请求和静态资源
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // 始终运行 middleware 于 API 路由
    '/(api|trpc)(.*)',
  ],
}
