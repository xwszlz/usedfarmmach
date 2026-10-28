/**
 * 豆包（火山方舟 ARK）多模态消息构建 —— 公共模块
 *
 * 从 `src/app/api/agents/seller-helper/deep-analysis/route.ts` 原样抽出，
 * 供深度分析 / AI 销售策略 / AI 估值等所有需要「图片 + 视频 + 文本」输入的链路共用。
 * 抽出的动机：原先只有深度分析会正确处理「公开图片 URL 必须服务端转 base64」，
 * 其他链路各写一份就会重复踩同一个坑（豆包服务端下载公开 URL 超时）。
 *
 * 本模块只做消息体组装与图片下载，不持有任何模型参数 / 计费逻辑，可安全复用。
 */
import axios from "axios";

/** 单张图片下载超时（毫秒）；与深度分析原实现保持一致 */
const IMAGE_DOWNLOAD_TIMEOUT_MS = 20000;

/** 图片下载失败时的日志截断长度，避免把整条 base64 / 超长签名 URL 打满日志 */
const ERROR_MESSAGE_MAX_LEN = 80;

/**
 * 下载公开 URL 图片并转成 base64（供豆包以 data URI 形式接收）。
 *
 * 为什么必须转 base64：豆包服务端抓取公开图片 URL 会超时失败
 * （`InvalidParameter: Timeout while downloading url`），
 * 因此统一在服务端先下载、再以 `data:{mime};base64,...` 形式传入。
 *
 * 失败时向上抛错，由调用方（`buildDoubaoContent`）决定跳过该图而非中断整条链路。
 */
export async function downloadImageAsBase64(
  url: string
): Promise<{ mimeType: string; data: string }> {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: IMAGE_DOWNLOAD_TIMEOUT_MS,
  });
  const contentType = response.headers["content-type"] || "image/jpeg";
  const base64 = Buffer.from(new Uint8Array(response.data as ArrayBuffer)).toString("base64");
  return { mimeType: contentType.split(";")[0], data: base64 };
}

/**
 * 构建豆包API的多模态消息内容
 *
 * 注意 1（图片）：豆包服务端下载公开图片 URL 会超时失败
 * （InvalidParameter: Timeout while downloading url），
 * 因此这里统一在服务端先下载并转成 base64 data URI 再传入。
 * data: 开头的输入本身就是 base64，直接透传。
 *
 * 注意 2（视频）：视频仍以 video_url 形式透传，该格式未在 .cn 生产环境验证过，
 * 若豆包侧不支持或抓取失败，会抛错并被上层 catch 记入 errors 后降级到备用模型，
 * 不会阻断整条链路。视频支持保留。
 *
 * @param images 图片列表：`data:` 开头的 base64 data URI 或公开 http(s) URL
 * @param videos 视频列表：公开 http(s) URL
 * @param prompt 文本部分（已含语言指令的完整 prompt）
 * @returns 豆包 `messages[].content` 数组：text + image_url… + video_url…
 */
export async function buildDoubaoContent(
  images: string[],
  videos: string[],
  prompt: string
): Promise<Array<Record<string, unknown>>> {
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: prompt },
  ];

  // 图片：公开 URL 需服务端下载转 base64，下载失败则跳过该图不中断
  for (const url of images) {
    if (url.startsWith("data:")) {
      content.push({
        type: "image_url",
        image_url: { url },
      });
      continue;
    }
    try {
      const { mimeType, data } = await downloadImageAsBase64(url);
      content.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${data}` },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[Multimodal] 下载图片失败 ${url}:`,
        message.substring(0, ERROR_MESSAGE_MAX_LEN)
      );
    }
  }

  // 视频（豆包支持 video_url 类型）
  for (const url of videos) {
    content.push({
      type: "video_url",
      video_url: { url },
    });
  }

  return content;
}
