import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Browser tab icon. Uses the logo's bullseye alone, at the logo's own
 * proportions — the full lockup renders as a featureless purple square at
 * 32px, because the rings and both words fall below a pixel of detail.
 * The stroke is thickened from the artwork's 1.875 to hold up at this size.
 */
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
          background: "#4f46e5",
          borderRadius: 7,
        }}
      >
        <svg
          width="23"
          height="23"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2.3"
        >
          <circle cx="12" cy="12" r="8.25" />
          <circle cx="12" cy="12" r="4.875" />
          <circle cx="12" cy="12" r="1.5" fill="#fff" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
