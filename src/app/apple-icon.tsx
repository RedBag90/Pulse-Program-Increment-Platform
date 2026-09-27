import { ImageResponse } from "next/og";

/**
 * **Icon für „Zum Home-Bildschirm"** auf iPhone und iPad — dasselbe Motiv wie
 * `icon.svg` und das Logo der App-Leiste, als 180×180-PNG. Ohne Rundung: iOS
 * rundet selbst.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const ZAP =
  "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#155dfc",
      }}
    >
      <svg
        width="104"
        height="104"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={ZAP} />
      </svg>
    </div>,
    size,
  );
}
