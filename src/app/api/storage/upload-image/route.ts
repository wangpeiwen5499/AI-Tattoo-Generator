import { claimUpload } from '@/server/db/guest-queries';
import { readBoundedBody } from '@/server/storage/file-proxy';
import {
  hasImageSignature,
  isAllowedImageType,
  isValidUploadSize,
} from '@/server/storage/upload-policy';

import { md5 } from '@/shared/lib/hash';
import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import { respData, respErr } from '@/shared/lib/resp';
import { getSignUser } from '@/shared/models/user';
import { getStorageService } from '@/shared/services/storage';

const extFromMime = (mimeType: string) => {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  return map[mimeType] || '';
};

export async function POST(req: Request) {
  const user = await getSignUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = enforceMinIntervalRateLimit(req, {
    intervalMs: 2000,
    keyPrefix: 'upload-image',
    extraKey: user.id,
  });
  if (limited) return limited;
  const length = Number(req.headers.get('content-length'));
  if (!Number.isFinite(length) || length <= 0 || length > 31 * 1024 * 1024) {
    return Response.json({ error: 'Invalid upload size' }, { status: 413 });
  }
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if ((await claimUpload(ip, 100)) < 0)
      return Response.json(
        { error: 'Daily upload limit reached' },
        { status: 429 }
      );
    const formData = await new Response(
      Buffer.from(await readBoundedBody(req, 31 * 1024 * 1024)),
      { headers: req.headers }
    ).formData();
    const files = formData.getAll('files') as File[];

    console.log('[API] Received files:', files.length);
    files.forEach((file, i) => {
      console.log(`[API] File ${i}:`, {
        name: file.name,
        type: file.type,
        size: file.size,
      });
    });

    if (!files || files.length === 0 || files.length > 3) {
      return respErr('No files provided');
    }

    const storageService = await getStorageService();
    const uploadResults = [];

    for (const file of files) {
      // Validate file type
      if (
        !(file instanceof File) ||
        !isAllowedImageType(file.type) ||
        !isValidUploadSize(file.size)
      ) {
        return respErr(`File ${file.name} is not an image`);
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const body = new Uint8Array(arrayBuffer);
      if (!hasImageSignature(body, file.type))
        return Response.json(
          { error: 'Invalid image content' },
          { status: 415 }
        );

      const digest = md5(body);
      const ext = extFromMime(file.type) || file.name.split('.').pop() || 'bin';
      const key = `uploads/${user.id}/${digest}.${ext}`;

      // If the same image already exists, reuse its URL to save storage space.
      // (Still depends on provider supporting signed HEAD + public url generation.)
      const exists = await storageService.exists({ key });
      if (exists) {
        const publicUrl = storageService.getPublicUrl({ key });
        if (publicUrl) {
          uploadResults.push({
            url: publicUrl,
            key,
            filename: file.name,
            deduped: true,
          });
          continue;
        }
      }

      // Upload to storage
      const result = await storageService.uploadFile({
        body,
        key: key,
        contentType: file.type,
        disposition: 'inline',
      });

      if (!result.success) {
        console.error('[API] Upload failed:', result.error);
        return respErr(result.error || 'Upload failed');
      }

      console.log('[API] Upload success:', result.url);

      uploadResults.push({
        url: result.url,
        key: result.key,
        filename: file.name,
        deduped: false,
      });
    }

    console.log(
      '[API] All uploads complete. Returning URLs:',
      uploadResults.map((r) => r.url)
    );

    return respData({
      urls: uploadResults.map((r) => r.url),
      results: uploadResults,
    });
  } catch (e) {
    console.error('upload image failed:', e);
    return respErr('upload image failed');
  }
}
