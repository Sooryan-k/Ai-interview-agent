import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Home-screen icon: the full lockup (mark + wordmark + AI badge), which is
 * legible at 180px. Built from Satori-friendly divs rather than SVG <text>,
 * which next/og does not render.
 */
export default function AppleIcon() {
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
          gap: 6,
          background: "#4f46e5",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <svg
          width="82"
          height="82"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" fill="#fff" />
        </svg>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: -1,
            lineHeight: 1,
          }}
        >
          dryrun
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            color: "#4f46e5",
            borderRadius: 999,
            padding: "3px 12px",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          AI
        </div>
      </div>
    ),
    { ...size }
  );
}
