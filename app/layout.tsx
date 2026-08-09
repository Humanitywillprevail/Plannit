import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Geist, Geist_Mono, Gowun_Batang } from "next/font/google";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "@/lib/actions/auth";
import Button from "@/components/ui/Button";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 헤드라인 전용 세리프. 데이터가 많은 화면은 계속 sans로 신뢰감 있게 유지하고,
// 랜딩 히어로/페이지 타이틀 등 "손맛"이 필요한 지점에만 쓴다.
const gowunBatang = Gowun_Batang({
  variable: "--font-gowun-batang",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Plannit",
  description: "학기별 커리어 기록 & 역량 분석 서비스",
};

// 로그인 여부에 따라 갈리는 부분만 별도 컴포넌트로 분리해 Suspense에 담는다.
// 나머지 헤더/레이아웃 뼈대는 쿠키를 읽지 않으므로 정적 셸로 프리렌더된다.
async function AuthNav() {
  const user = await getCurrentUser();

  return user ? (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-ink-secondary">{user.email}</span>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-lg px-2 py-1 text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
        >
          로그아웃
        </button>
      </form>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link href="/login">
        <Button variant="ghost" size="sm">
          로그인
        </Button>
      </Link>
      <Link href="/signup">
        <Button variant="secondary" size="sm">
          회원가입
        </Button>
      </Link>
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${gowunBatang.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-line bg-background/90 backdrop-blur-md">
          <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3.5">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/plannit-icon.png"
                alt=""
                width={28}
                height={28}
                className="rounded-lg"
                priority
              />
              <span>
                <span className="block font-display text-[17px] leading-tight font-bold tracking-tight">
                  Plannit
                </span>
                <span className="block text-[11px] leading-tight text-ink-muted">
                  학기별 기록장
                </span>
              </span>
            </Link>
            <Suspense fallback={<div className="h-8 w-[124px]" />}>
              <AuthNav />
            </Suspense>
          </nav>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
