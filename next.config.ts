import type { NextConfig } from "next";

/**
 * 从 R2_PUBLIC_URL 解析出 hostname，注入 Next.js Image 组件白名单。
 * 不会硬编码域名，方便开发/生产环境切换。
 */
function getR2ImagePattern(): { protocol: "https"; hostname: string } | null {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return { protocol: "https", hostname: parsed.hostname };
  } catch {
    return null;
  }
}

const r2Pattern = getR2ImagePattern();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: r2Pattern ? [r2Pattern] : [],
  },
};

export default nextConfig;
