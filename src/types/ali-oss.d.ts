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

  interface PutObjectResult {
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
    copy(from: string, to: name: string, options?: Record<string, any>): Promise<PutObjectResult>;
    head(name: string, options?: Record<string, any>): Promise<{ meta: any; res: { status: number } }>;
    signatureUrl(name: string, expires?: number): Promise<string>;
    getBucketInfo(): Promise<{ bucket: any; res: { status: number } }>;

    // STS
    static STS: typeof import("ali-oss/STS").default;

    // Static methods
    static parseXML(xml: string): any;
  }

  const OSS: typeof import("ali-oss").default;
  export default OSS;

  // Re-export submodules
  export const STS: typeof import("ali-oss/STS").default;
}

// Allow require() with ali-oss
declare module "ali-oss/*" {
  const value: any;
  export default value;
}
