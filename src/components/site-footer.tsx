import Link from 'next/link'

/**
 * 全局页脚：政策链接 + 客服邮箱（合规审核要求）。
 * Server Component（layout 直接渲染）。SUPPORT_EMAIL 从环境变量读，
 * 未配置时不显示邮箱行（开发期占位，生产前必填）。
 */
export function SiteFooter() {
  const supportEmail = process.env.SUPPORT_EMAIL
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border/40 bg-background/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/acceptable-use" className="transition-colors hover:text-foreground">
            Acceptable Use
          </Link>
        </nav>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {supportEmail && (
            <a
              href={`mailto:${supportEmail}`}
              className="transition-colors hover:text-foreground"
            >
              Support: {supportEmail}
            </a>
          )}
          <span>© {year} AI Tattoo Generator</span>
        </div>
      </div>
    </footer>
  )
}
