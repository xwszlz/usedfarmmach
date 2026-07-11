import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export const runtime = "edge";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          fontWeight: 900,
          background: "linear-gradient(135deg, #15803d 0%, #16a34a 100%)",
          color: "white",
          borderRadius: "6px",
        }}
      >
        AT
      </div>
    ),
    { ...size }
  );
}
