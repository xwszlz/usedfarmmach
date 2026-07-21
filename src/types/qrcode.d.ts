declare module "qrcode" {
  export function toDataURL(
    text: string,
    options?: {
      width?: number;
      margin?: number;
      errorCorrectionLevel?: "L" | "M" | "Q" | "H";
      type?: string;
      quality?: number;
      color?: { dark?: string; light?: string };
    }
  ): Promise<string>;

  export function toCanvas(
    canvas: HTMLCanvasElement,
    text: string,
    options?: Record<string, any>
  ): Promise<void>;

  export function toString(text: string, options?: Record<string, any>): Promise<string>;
}
