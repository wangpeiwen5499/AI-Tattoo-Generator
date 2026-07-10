import Link from 'next/link'
import { SignInButton, UserButton, Show } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-lg">AI Tattoo</span>
        </Link>

        <div className="flex items-center gap-3">
          <Show when="signed-in">
            <Link
              href="/history"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              History
            </Link>
            <Link href="/pricing">
              <Button variant="ghost" size="sm">
                Buy Credits
              </Button>
            </Link>
            <UserButton />
          </Show>

          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button size="sm">Sign in</Button>
            </SignInButton>
          </Show>
        </div>
      </nav>
    </header>
  )
}
