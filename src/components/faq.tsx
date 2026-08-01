import { ChevronDown } from 'lucide-react'

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is an AI tattoo preview?',
    a: 'Upload a photo of your body, describe a tattoo idea, and our AI shows what it would look like on your arm, shoulder, and calf — before you commit to real ink.',
  },
  {
    q: 'Which body parts can I preview?',
    a: 'Four areas: left arm, right arm, shoulder, and calf. Each generation previews the design on all four at once.',
  },
  {
    q: 'Is my photo safe?',
    a: "Your photo is uploaded securely to generate your preview and only appears in your account's history. We don't use it for model training or share it with anyone.",
  },
  {
    q: 'How do credits work?',
    a: 'One credit equals one generation (4 body-part previews). New accounts get 1 free generation; extra credits start at $4.99 for 5.',
  },
  {
    q: 'How long does a generation take?',
    a: 'About 4 minutes. It runs in the background, so you can close the page — finished previews show up in your History.',
  },
  {
    q: 'What if my generation fails?',
    a: 'If all 4 previews fail, your credit is refunded automatically. You can also check your History for any partial results.',
  },
  {
    q: 'What photo formats can I upload?',
    a: 'JPG, PNG, or WebP, up to 10 MB. A clear, well-lit photo of a single body area works best.',
  },
  {
    q: 'Can I use the previews commercially?',
    a: 'Yes. You own the rights to the images you generate and can use them for personal or commercial purposes.',
  },
]

/**
 * 落地页 FAQ（仅未登录展示）。
 * 用原生 <details>/<summary> 折叠（无需 JS/组件库），
 * chevron 旋转靠 Tailwind 任意变体 [&[open]>summary>svg]:rotate-180。
 */
export function Faq() {
  return (
    <section className="mt-24">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Frequently asked questions
        </h2>

        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="border-b border-border last:border-b-0 [&[open]>summary>svg]:rotate-180"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium transition-colors hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200" />
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
