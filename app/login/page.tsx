import { Suspense } from "react";
import Link from "next/link";
import { login } from "@/lib/actions/auth";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Turnstile from "@/components/Turnstile";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

// searchParams는 요청 시점에만 알 수 있으므로 이 부분만 스트리밍하고,
// 폼 자체는 정적 셸로 프리렌더한다.
async function LoginError({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!error) return null;
  return <p className="text-sm text-danger">{error}</p>;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-8">
      <h1 className="mb-6 text-center text-xl font-semibold">로그인</h1>
      <Card>
        <form action={login} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-ink-secondary">
              이메일
            </label>
            <input
              name="email"
              type="email"
              required
              autoFocus
              className="w-full rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-secondary">
              비밀번호
            </label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
            />
          </div>
          <Turnstile siteKey={TURNSTILE_SITE_KEY} />
          <Suspense fallback={null}>
            <LoginError searchParams={searchParams} />
          </Suspense>
          <Button type="submit" className="w-full">
            로그인
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-ink-secondary">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          회원가입
        </Link>
      </p>
    </main>
  );
}
