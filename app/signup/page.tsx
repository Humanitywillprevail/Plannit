import { Suspense } from "react";
import Link from "next/link";
import { signup } from "@/lib/actions/auth";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

// searchParams는 요청 시점에만 알 수 있으므로 이 부분만 스트리밍하고,
// 폼 자체는 정적 셸로 프리렌더한다.
async function SignupError({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!error) return null;
  return <p className="text-sm text-danger">{error}</p>;
}

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-8">
      <h1 className="mb-6 text-center text-xl font-semibold">회원가입</h1>
      <Card>
        <form action={signup} className="space-y-3">
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
              비밀번호{" "}
              <span className="text-ink-muted">(6자 이상)</span>
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
            />
          </div>
          <Suspense fallback={null}>
            <SignupError searchParams={searchParams} />
          </Suspense>
          <Button type="submit" className="w-full">
            회원가입
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-ink-secondary">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-accent hover:underline">
          로그인
        </Link>
      </p>
    </main>
  );
}
