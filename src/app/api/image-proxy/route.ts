/**
 * 图片代理 - 解决微信小程序 downloadFile 白名单问题
 * 
 * 背景：小程序 <image> 组件下载图片需要域名在 downloadFile 白名单中。
 * usedfarmmach-oss.oss-cn-beijing.aliyuncs.com 不在白名单 → 图片无法显示。
 * 此端点代理 OSS 图片，使小程序只需 usedfarmmach.com 一个域名即可加载所有图片。
 * 
 * 用法：GET /api/image-proxy?url=<encoded-oss-url>&w=<width>
 */
import { NextRequest, NextResponse } from 'next/server';

// 允许代理的域名白名单（安全：防止被滥用为开放代理）
const ALLOWED_HOSTS = [
  'usedfarmmach-oss.oss-cn-beijing.aliyuncs.com',
];

// 缓存策略：浏览器缓存 1 天，CDN 缓存 7 天
const CACHE_MAX_AGE = 86400;        // 1 day
const CDN_MAX_AGE = 604800;          // 7 days

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let imageUrl = searchParams.get('url');
  const width = searchParams.get('w');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // 安全校验：只允许白名单域名
  try {
    const parsed = new URL(imageUrl);
    if (!ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
      console.warn('[image-proxy] Blocked non-whitelisted host:', parsed.hostname);
      return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // 如果传了宽度参数，追加 OSS 处理参数
  if (width) {
    const w = parseInt(width, 10);
    if (!isNaN(w) && w > 0 && w <= 1200) {
      const sep = imageUrl.includes('?') ? '&' : '?';
      imageUrl += `${sep}x-oss-process=image/resize,m_fixed,w_${w}/format,webp/quality,q_80`;
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'shendiao-image-proxy/1.0',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error('[image-proxy] Upstream error:', response.status, imageUrl);
      return NextResponse.json(
        { error: 'Image fetch failed', status: response.status },
        { status: 502 }
      );
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, s-maxage=${CDN_MAX_AGE}, immutable`,
        'CDN-Cache-Control': `max-age=${CDN_MAX_AGE}`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    console.error('[image-proxy] Fetch error:', err.message);
    return NextResponse.json(
      { error: 'Image fetch timeout or network error' },
      { status: 504 }
    );
  }
}
