declare module "ali-oss" {
  interface OSSOptions {
    region: string;
    bucket: string;
    accessKeyId: string;
    accessKeySecret: string;
    endpoint?: string;
    timeout?: number;
    secure?: boolean;
  }

  export interface PutObjectResult {
    name: string;
    url?: string;
    res: {
      status: number;
      headers: Record<string, string>;
    };
  }

  class OSS {
    constructor(options: OSSOptions);
    put(name: string, file: Buffer | string | ReadableStream, options?: Record<string, any>): Promise<PutObjectResult>;
    get(name: string, options?: Record<string, any>): Promise<{ content: Buffer; res: { status: number } }>;
    delete(name: string, options?: Record<string, any>): Promise<{ res: { status: number } }>;
    list(query?: Record<string, any>, options?: Record<string, any>): Promise<any>;
    copy(from: string, to: string, options?: Record<string, any>): Promise<PutObjectResult>;
    head(name: string, options?: Record<string, any>): Promise<{ meta: any; res: { status: number } }>;
    signatureUrl(name: string, expires?: number): Promise<string>;
    getBucketInfo(): Promise<{ bucket: any; res: { status: number } }>;
  }

  export default OSS;
}
