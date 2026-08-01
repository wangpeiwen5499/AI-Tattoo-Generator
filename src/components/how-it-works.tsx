import { Upload, PencilLine, Sparkles } from 'lucide-react'

const STEPS = [
  {
    n: '01',
    icon: Upload,
    title: 'Upload your photo',
    desc: 'Drop a clear photo of where you want inked: arm, shoulder, or calf.',
  },
  {
    n: '02',
    icon: PencilLine,
    title: 'Describe your idea',
    desc: "Write the tattoo you're after — style, subject, mood.",
  },
  {
    n: '03',
    icon: Sparkles,
    title: 'Preview on your body',
    desc: 'AI places the design on 4 body parts in about 4 minutes.',
  },
]

/**
 * 落地页 "How it works" 3 步说明（仅未登录展示）。
 */
export function HowItWorks() {
  return (
    <section className="mt-24">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          How it works
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-base text-muted-foreground text-pretty">
          Three steps from idea to ink preview
        </p>

        <ol className="mt-12 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="flex flex-col items-center text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <step.icon className="h-6 w-6" />
              </div>
              <span className="mt-4 text-xs font-semibold tracking-widest text-muted-foreground">
                {step.n}
              </span>
              <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground text-pretty">
                {step.desc}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
