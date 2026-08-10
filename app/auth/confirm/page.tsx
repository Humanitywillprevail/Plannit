"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";

// SMTP를 따로 설정하지 않으면 Supabase 기본 이메일 템플릿(자체 서버로 갔다가
// 돌아오는 링크)만 쓸 수 있다. 그 링크는 세션 토큰을 URL 해시(#access_token=...)에
// 담아 이 페이지로 돌려보내는데, 해시는 서버로 전달되지 않으므로 브라우저에서
// Supabase 클라이언트가 직접 읽어 세션을 만들고 쿠키에 반영해야 한다
// (createBrowserClient는 detectSessionInUrl이 기본 켜져 있어 마운트 시 자동 처리).
export default function ConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/semesters");
      } else {
        setStatus("error");
      }
    });
  }, [router]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-8">
      <Card className="text-center">
        {status === "loading" ? (
          <p className="text-sm text-ink-secondary">이메일 확인 중입니다...</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-danger">
              확인 링크가 만료되었거나 이미 사용된 링크예요.
            </p>
            <Link href="/login" className="text-sm text-accent hover:underline">
              로그인 페이지로 돌아가기
            </Link>
          </>
        )}
      </Card>
    </main>
  );
}
