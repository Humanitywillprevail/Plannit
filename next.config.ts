import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 로그인 여부와 무관한 화면(랜딩, 로그인/회원가입 폼)을 정적으로 프리렌더하고
  // 쿠키/searchParams에 의존하는 부분만 Suspense로 스트리밍하기 위해 활성화.
  cacheComponents: true,
  experimental: {
    serverActions: {
      // Codespaces/Gitpod처럼 origin과 forwarded host가 다른 프록시 환경에서
      // Server Actions가 차단되지 않도록 허용 도메인을 등록한다.
      allowedOrigins: ["localhost:3000", "*.app.github.dev", "*.gitpod.io"],
      // 기본 1MB로는 포트폴리오 이미지/PDF 첨부가 대부분 막힌다.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
