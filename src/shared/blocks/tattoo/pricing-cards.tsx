import { ReactNode } from 'react';
import { Check } from 'lucide-react';

export type PricingCardData = {
  title?: string;
  price?: string;
  credits?: number;
  description?: string;
  label?: string;
  features?: string[];
};

/**
 * Shared pricing card display used by both Preview and production: identical
 * card structure, per-operation costs and bottom-aligned CTAs. The mode
 * injects its own action through `renderCta` — Preview never offers a real
 * purchase, production injects the checkout button.
 */
export function PricingCards({
  cards,
  renderCta,
}: {
  cards: PricingCardData[];
  renderCta: (card: PricingCardData, featured: boolean) => ReactNode;
}) {
  const featuredIndex = Math.max(
    0,
    cards.findIndex((card) => card.label)
  );
  return (
    <div className="grid items-stretch gap-6 md:grid-cols-3">
      {cards.map((card, index) => (
        <article
          key={card.title}
          className={`bg-card flex flex-col rounded-2xl border p-7 ${
            index === featuredIndex
              ? 'border-primary ring-primary/30 shadow-lg ring-2'
              : ''
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium">{card.title}</h2>
            {index === featuredIndex && card.label ? (
              <span className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium">
                {card.label}
              </span>
            ) : null}
          </div>
          <p className="mt-5 text-4xl font-semibold">{card.price}</p>
          <p className="mt-2 text-base">{card.credits} credits</p>
          <p className="text-muted-foreground mt-4 text-sm leading-6">
            {card.description}
          </p>
          <ul className="mt-6 mb-8 space-y-3">
            {(card.features ?? []).map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <Check
                  size={17}
                  className="text-primary mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="text-sm leading-6">{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto w-full">{renderCta(card, index === featuredIndex)}</div>
        </article>
      ))}
    </div>
  );
}
