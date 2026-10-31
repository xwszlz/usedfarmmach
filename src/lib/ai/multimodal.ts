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
import { downloadGuardedImage } from "@/lib/net/download-image";
import { IMAGE_FETCH_TIMEOUT_MS, MAX_IMAGE_BYTES } from "@/lib/net/ssrf-guard";

/** 图片下载失败时的日志截断长度，避免把整条 base64 / 超长签名 URL 打满日志 */
const ERROR_MESSAGE_MAX_LEN = 80;

/**
 * 下载阶段允许的**最小**单图超时（1s）。
 *
 * 预算见底时算出来的「剩余」可能是 0 或负数，`AbortSignal.timeout(0)` 会立刻 abort，
 * 只会得到一条没有信息量的失败日志；收窄到 1s 至少留一个真实请求窗口。
 * 与 `ssrf-guard.MIN_IMAGE_FETCH_TIMEOUT_MS` 同值（那里是最终兜底，这里是调用方裁剪口径）。
 */
const MIN_IMAGE_DOWNLOAD_MS = 1_000;

/** `downloadImageAsBase64` 的可选参数 */
export interface DownloadImageOptions {
  /** 本次抓取超时（毫秒）。不传时沿用出网守卫默认的 20s */
  timeoutMs?: number;
}

/**
 * 下载公开 URL 图片并转成 base64（供豆包以 data URI 形式接收）。
 *
 * 为什么必须转 base64：豆包服务端抓取公开图片 URL 会超时失败
 * （`InvalidParameter: Timeout while downloading url`），
 * 因此统一在服务端先下载、再以 `data:{mime};base64,...` 形式传入。
 *
 * 失败时向上抛错，由调用方（`buildDoubaoContent`）决定跳过该图而非中断整条链路。
 *
 * @param url 公开图片地址（只接受 http(s)；`data:` 由调用方在更外层处理）
 * @param options.timeoutMs 单图超时；不传时行为与旧版完全一致（守卫默认 20s）
 */
export async function downloadImageAsBase64(
  url: string,
  options: DownloadImageOptions = {}
): Promise<{ mimeType: string; data: string }> {
  // 出网守卫：url 来自请求体（deep-analysis / sales-strategy 的 imageUrls），
  // 不过守卫就是一条"服务器代取任意地址、再以 base64 回吐并送进模型"的通道。
  // 送模型场景：12MB 上限（与既有视觉链路口径一致）
  const { buffer, contentType } = await downloadGuardedImage(url, {
    maxBytes: MAX_IMAGE_BYTES,
    ...(typeof options?.timeoutMs === "number" ? { timeoutMs: options.timeoutMs } : {}),
  });
  return { mimeType: contentType.split(";")[0], data: buffer.toString("base64") };
}

/**
 * `buildDoubaoContent` 的可选预算参数。
 *
 * 背景（线上故障）：旧实现 3 张图**串行**下载、每张 20s，最坏 60s 全部花在下载上，
 * 而下载之后还有 3 次 LLM 调用 —— 总墙钟最坏 900s，远超 nginx `proxy_read_timeout` 330s
 * ⇒ `.cn` 用户必然看到 504（HTML）。本组参数让「下载阶段」也被总预算约束住。
 */
export interface BuildDoubaoContentOptions {
  /**
   * 下载阶段的**绝对截止时间戳**（`Date.now()` 口径，毫秒）。
   * 每张图的超时 = `min(perImageTimeoutMs, 该截止时刻 - now)`。
   */
  downloadDeadlineMs?: number;
  /**
   * 下载阶段的**相对预算**（毫秒），与实际 `now + downloadBudgetMs` 取更早的那个截止时刻。
   * 二者都不传 → 行为与旧版一致（每张图 20s）。
   */
  downloadBudgetMs?: number;
  /** 单张图超时上限，默认 `IMAGE_FETCH_TIMEOUT_MS`(20s) */
  perImageTimeoutMs?: number;
}

/**
 * 构建豆包API的多模态消息内容
 *
 * 注意 1（图片）：豆包服务端下载公开图片 URL 会超时失败
 * （InvalidParameter: Timeout while downloading url），
 * 因此这里统一在服务端先下载并转成 base64 data URI 再传入。
 * data: 开头的输入本身就是 base64，直接透传。
 *
 * 注意 2（图片并发）：多张图**并行**下载（`Promise.allSettled`），任一张失败只丢那一张，
 * 不影响同批其他图，也不中断整条链路（既有降级语义不变）；
 * 但**拼接顺序严格保持入参顺序**，否则模型看到的图序会随机变。
 *
 * 注意 3（视频）：视频仍以 video_url 形式透传，该格式未在 .cn 生产环境验证过，
 * 若豆包侧不支持或抓取失败，会抛错并被上层 catch 记入 errors 后降级到备用模型，
 * 不会阻断整条链路。视频支持保留。
 *
 * @param images 图片列表：`data:` 开头的 base64 data URI 或公开 http(s) URL
 * @param videos 视频列表：公开 http(s) URL
 * @param prompt 文本部分（已含语言指令的完整 prompt）
 * @param options 下载阶段预算（不传时行为与旧版一致）
 * @returns 豆包 `messages[].content` 数组：text + image_url… + video_url…
 */
export async function buildDoubaoContent(
  images: string[],
  videos: string[],
  prompt: string,
  options: BuildDoubaoContentOptions = {}
): Promise<Array<Record<string, unknown>>> {
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: prompt },
  ];

  const perImageCap =
    typeof options?.perImageTimeoutMs === "number" && options.perImageTimeoutMs > 0
      ? options.perImageTimeoutMs
      : IMAGE_FETCH_TIMEOUT_MS;

  // 下载阶段截止时刻 = min(调用方给的绝对 deadline, now + 相对预算)；都没传 → 无总闸（旧行为）
  const deadlineCandidates: number[] = [];
  if (typeof options?.downloadDeadlineMs === "number" && Number.isFinite(options.downloadDeadlineMs)) {
    deadlineCandidates.push(options.downloadDeadlineMs);
  }
  if (typeof options?.downloadBudgetMs === "number" && options.downloadBudgetMs > 0) {
    deadlineCandidates.push(Date.now() + options.downloadBudgetMs);
  }
  const downloadDeadline =
    deadlineCandidates.length > 0 ? Math.min(...deadlineCandidates) : Number.POSITIVE_INFINITY;
  const hasDeadline = Number.isFinite(downloadDeadline);

  // ── 先按入参顺序分类：data URI 直接透传，http(s) 进并发下载队列 ──
  type ImageSlot =
    | { kind: "ready"; part: Record<string, unknown> }
    | { kind: "download"; url: string };
  const slots: ImageSlot[] = images.map((url) =>
    url.startsWith("data:")
      ? { kind: "ready", part: { type: "image_url", image_url: { url } } }
      : { kind: "download", url }
  );

  const downloadIndexes: number[] = [];
  const downloadUrls: string[] = [];
  slots.forEach((slot, index) => {
    if (slot.kind === "download") {
      downloadIndexes.push(index);
      downloadUrls.push(slot.url);
    }
  });

  if (downloadUrls.length > 0) {
    const settled = await Promise.allSettled(
      downloadUrls.map((url) => {
        const remaining = hasDeadline ? downloadDeadline - Date.now() : Number.POSITIVE_INFINITY;
        // 预算已耗尽：不再发起新请求，直接按"这张图失败"处理（带已下载的图继续）
        if (hasDeadline && remaining < MIN_IMAGE_DOWNLOAD_MS) {
          return Promise.reject(
            new Error(`下载阶段预算已耗尽（剩余 ${Math.max(0, remaining)}ms），跳过该图`)
          );
        }
        const timeoutMs = hasDeadline
          ? Math.max(MIN_IMAGE_DOWNLOAD_MS, Math.min(perImageCap, remaining))
          : perImageCap;
        return downloadImageAsBase64(url, { timeoutMs });
      })
    );

    settled.forEach((outcome, i) => {
      const url = downloadUrls[i];
      if (outcome.status === "fulfilled") {
        slots[downloadIndexes[i]] = {
          kind: "ready",
          part: {
            type: "image_url",
            image_url: { url: `data:${outcome.value.mimeType};base64,${outcome.value.data}` },
          },
        };
        return;
      }
      const reason = outcome.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      console.warn(
        `[Multimodal] 下载图片失败 ${url}:`,
        message.substring(0, ERROR_MESSAGE_MAX_LEN)
      );
    });
  }

  // 按原始顺序拼接（失败的图已在上面被丢弃，不会打乱其余图的相对顺序）
  for (const slot of slots) {
    if (slot.kind === "ready") content.push(slot.part);
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
