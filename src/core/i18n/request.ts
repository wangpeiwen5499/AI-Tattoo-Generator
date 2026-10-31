import { getRequestConfig } from 'next-intl/server';

import {
  defaultLocale,
  localeMessagesPaths,
  localeMessagesRootPath,
} from '@/config/locale';
import { previewFunnelCopy } from '@/config/preview/messages';
import { isProductPreview } from '@/config/preview/product';

import { routing } from './config';

export async function loadMessages(
  path: string,
  locale: string = defaultLocale
) {
  try {
    // try to load locale messages
    const messages = await import(
      `@/config/locale/messages/${locale}/${path}.json`
    );
    return messages.default;
  } catch (e) {
    try {
      // try to load default locale messages
      const messages = await import(
        `@/config/locale/messages/${defaultLocale}/${path}.json`
      );
      return messages.default;
    } catch (err) {
      // if default locale is not found, return empty object
      return {};
    }
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as string)) {
    locale = routing.defaultLocale;
  }

  if (['zh-CN'].includes(locale)) {
    locale = 'zh';
  }

  try {
    // load all local messages
    const allMessages = await Promise.all(
      localeMessagesPaths.map((path) => loadMessages(path, locale))
    );

    // merge all local messages
    const messages: any = {};

    localeMessagesPaths.forEach((path, index) => {
      const localMessages = allMessages[index];

      const keys = path.split('/');
      let current = messages;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = localMessages;
    });

    if (isProductPreview()) {
      // Imported JSON modules are cached; never mutate their shared objects.
      messages.common = structuredClone(messages.common);
      messages.pages.pricing = structuredClone(messages.pages.pricing);
      messages.common.funnel = {
        ...messages.common.funnel,
        ...previewFunnelCopy(locale),
      };
      messages.common.metadata.description =
        locale === 'zh'
          ? '上传或生成纹身设计，在照片上自由定位，再生成单张试戴。Preview 使用独立测试积分，设计和历史仅保存在当前浏览器。'
          : 'Upload or create a tattoo design, place it freely on your photo and generate one try-on image. Preview uses separate test credits and browser-local designs and history.';
      messages.pages.pricing.metadata.description =
        locale === 'zh'
          ? 'Preview 拟议积分：1K 设计 1 积分；单张 1K / 2K / 4K 试戴 1 / 2 / 3 积分。上传、保存、复用和定位免费，不提供真实购买。'
          : 'Preview proposed credits: 1K design, 1 credit; single 1K / 2K / 4K try-on, 1 / 2 / 3 credits. Upload, save, reuse and position free. No real purchases.';
    }

    return {
      locale,
      messages,
    };
  } catch (e) {
    return {
      locale: defaultLocale,
      messages: await loadMessages(localeMessagesRootPath, defaultLocale),
    };
  }
});
