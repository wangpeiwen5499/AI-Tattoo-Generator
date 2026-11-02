// Only use for idempotent reads. Never wrap a submission or mutation.
export async function readWithRetry<T>(
  read: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      return await read();
    } catch (error) {
      signal?.throwIfAborted();
      const status = (error as { status?: number })?.status;
      if (
        attempt >= 2 ||
        (status !== undefined &&
          ![408, 429, 500, 502, 503, 504].includes(status))
      )
        throw error;
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(signal?.reason || new DOMException('Aborted', 'AbortError'));
        };
        const timer = setTimeout(
          () => {
            signal?.removeEventListener('abort', abort);
            resolve();
          },
          250 * 2 ** attempt
        );
        signal?.addEventListener('abort', abort, { once: true });
      });
    }
  }
}
