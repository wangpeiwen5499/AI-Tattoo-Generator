// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, expect, it, vi } from 'vitest';

import common from '@/config/locale/messages/en/common.json';
import { GenerationResults } from '@/shared/blocks/tattoo/generation-results';

afterEach(cleanup);
it('shows completed body previews while remaining parts are pending without claiming failure or offering a second generation', () => {
  render(
    <NextIntlClientProvider locale="en" messages={{ common }}>
      <GenerationResults
        processing
        tattooDesignUrl="https://files.example/design.png"
        images={[
          {
            bodyPart: 'left_arm',
            status: 'completed',
            url: 'https://files.example/arm.png',
          },
          { bodyPart: 'right_arm', status: 'running', url: null },
        ]}
        onReset={vi.fn()}
        onRegenerate={vi.fn()}
      />
    </NextIntlClientProvider>
  );
  expect(screen.getByAltText('Tattoo on Left Arm')).toBeTruthy();
  expect(screen.getByText('Generating…')).toBeTruthy();
  expect(screen.queryByText('This part failed')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Try another idea' })).toBeNull();
});
