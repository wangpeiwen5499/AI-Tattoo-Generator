import Link from "next/link";
import { SignInButton, Show } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          See Your Tattoo Before You Ink
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground text-pretty">
          Upload a photo, describe your idea, and let AI preview the tattoo on
          your arm, shoulder, and calf in seconds.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Show when="signed-in">
            <Link href="#generator">
              <Button size="lg">Start generating</Button>
            </Link>
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button size="lg">Try it free</Button>
            </SignInButton>
          </Show>
          <Button size="lg" variant="outline">
            See examples
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          1 free generation on sign up · No credit card required
        </p>
      </section>
    </div>
  );
}
