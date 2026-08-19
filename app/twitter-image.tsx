import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: "#0a0a0a",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 84,
              height: 84,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#4f46e5",
              borderRadius: 20,
            }}
          >
            <svg
              width="52"
              height="52"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.3"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" fill="#fff" />
            </svg>
          </div>
          <div style={{ fontSize: 68, fontWeight: 700, color: "#fff" }}>
            dryrun AI
          </div>
        </div>
        <div style={{ fontSize: 32, color: "#a1a1aa", textAlign: "center" }}>
          Every interview, rehearsed. Free, forever.
        </div>
      </div>
    ),
    { ...size }
  );
}
