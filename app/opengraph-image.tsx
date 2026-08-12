import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Plannit — 학기별 커리어 기록 & 역량 분석 서비스";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 로고 자체에 워드마크/한글 태그라인이 이미 래스터로 박혀 있어서,
// satori에 한글 폰트를 따로 임베드하지 않고도 정확히 렌더링된다.
const logoData = await readFile(
  join(process.cwd(), "public/plannit_logo_final.png"),
  "base64"
);
const logoSrc = `data:image/png;base64,${logoData}`;
const LOGO_WIDTH = 900;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 880) / 2720);

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <img src={logoSrc} width={LOGO_WIDTH} height={LOGO_HEIGHT} alt="" />
      </div>
    ),
    { ...size }
  );
}
