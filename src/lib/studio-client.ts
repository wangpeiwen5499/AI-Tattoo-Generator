export type StudioRecord = {
  designAsset?: string;
  placement?: import('./manual-placement').Placement;
  id: string;
  image: string;
  original?: string | null;
  draft?: string | null;
  designId?: string | null;
  operationId?: string;
  prompt: string;
  name?: string | null;
  source?: string | null;
  resolution?: string | null;
  createdAt: string;
};
export type StudioTask = {
  task: string;
  kind: 'design' | 'render';
  operationId: string;
  prompt?: string;
  resolution?: string;
  state?: string;
};
export type StudioCapabilities = {
  configured: boolean;
  signedIn: boolean;
  verified: boolean;
  credits: number;
  pending: StudioTask[];
};
export class StudioAccessError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}
export class StudioClient {
  constructor(private fetcher: typeof fetch = (...args) => fetch(...args)) {}
  private async request<T>(
    query: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await this.fetcher(
      `/api/studio${query ? `?${query}` : ''}`,
      { cache: 'no-store', ...options }
    );
    const data = await response.json();
    if (!response.ok)
      throw new StudioAccessError(
        data.error || 'Studio is temporarily unavailable.',
        response.status
      );
    return data;
  }
  capabilities(signal?: AbortSignal) {
    return this.request<StudioCapabilities>('', { signal });
  }
  collection(collection: 'designs' | 'history', signal?: AbortSignal) {
    return this.request<{ records: StudioRecord[] }>(
      `collection=${collection}`,
      { signal }
    );
  }
  start(kind: 'design' | 'render', input: object, signal?: AbortSignal) {
    return this.request<{ task: string }>(`mode=${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });
  }
  status(task: string, signal?: AbortSignal) {
    return this.request<{
      state: string;
      error?: string;
      kind: 'design' | 'render';
      operationId: string;
      asset?: string;
    }>('mode=status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task }),
      signal,
    });
  }
  async upload(blob: Blob, signal?: AbortSignal) {
    const body = new FormData();
    body.set(
      'image',
      blob,
      blob.type === 'image/jpeg' ? 'photo.jpg' : 'image.png'
    );
    return (
      await this.request<{ asset: string }>('mode=upload', {
        method: 'POST',
        body,
        signal,
      })
    ).asset;
  }
  async saveDesign(blob: Blob, prompt: string, signal?: AbortSignal) {
    const body = new FormData();
    body.set('image', blob, 'design.png');
    body.set('name', 'Uploaded design');
    body.set('prompt', prompt);
    body.set('source', 'uploaded');
    return (
      await this.request<{ record: StudioRecord }>('mode=save-design', {
        method: 'POST',
        body,
        signal,
      })
    ).record;
  }
}
export const studioClient = new StudioClient();
export const studioAssetUrl = (id: string) =>
  `/api/studio?asset=${encodeURIComponent(id)}`;
