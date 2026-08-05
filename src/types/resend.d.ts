/**
 * resend 运行时类型声明占位（阶段 1）。
 *
 * 生产环境由 package.json 声明的 "resend": "^4.0.0" 在 `npm install` 时安装，
 * 本文件仅为本地 `tsc --noEmit` 与编辑器补全提供最小类型，使静态/动态 import
 * 可被解析。声明仅覆盖本仓库实际使用的 Resend Node SDK 子集（emails.send）。
 *
 * 注意：provider.ts 中 ResendProvider 对 resend 采用「延迟动态 import」，
 * 仅在 RESEND_API_KEY 存在、真正构造 provider 并发信时才加载本模块，
 * 因此本地开发（未安装 resend 且未配置 key）走 ConsoleProvider 降级，不会触发
 * 模块解析失败。
 */
declare module "resend" {
  /** 发送参数（覆盖本仓库用到的字段） */
  export interface ResendSendParams {
    from: string;
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    reply_to?: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
  }

  /** 发送响应 */
  export interface ResendSendResponse {
    data: { id: string } | null;
    error: { message?: string; name?: string } | null;
  }

  /** Resend Node SDK 主类 */
  export class Resend {
    constructor(apiKey: string);
    readonly emails: {
      send(params: ResendSendParams): Promise<ResendSendResponse>;
    };
  }
}
