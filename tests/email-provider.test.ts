import { afterEach, expect, it, vi } from 'vitest';

import { ResendProvider } from '@/extensions/email/resend';
import { VerificationCode } from '@/shared/blocks/email/verification-code';

afterEach(() => vi.unstubAllGlobals());

it('renders the real verification template and submits its HTML through the real Resend SDK', async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ id: 'test-message-id' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  );
  vi.stubGlobal('fetch', fetch);
  const provider = new ResendProvider({
    apiKey: 'test-only-no-network',
    defaultFrom: 'TattooVis <verify@example.com>',
  });
  const result = await provider.sendEmail({
    to: 'recipient@example.com',
    subject: 'Verify your email',
    react: VerificationCode({ code: '123456' }),
  });

  expect(result).toEqual({
    success: true,
    messageId: 'test-message-id',
    provider: 'resend',
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, request] = fetch.mock.calls[0];
  expect(url).toBe('https://api.resend.com/emails');
  const body = JSON.parse(request.body);
  expect(body.html).toContain('123456');
  expect(body.html).toContain('Verify Your Email');
  expect(body.to).toEqual(['recipient@example.com']);
  expect(body.react).toBeUndefined();
});
