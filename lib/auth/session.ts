import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// proxy.ts가 비로그인 접근을 이미 막지만, Server Action/Server Component는
// proxy 매처를 우회할 수 있으므로 각자 다시 검증한다 (Next.js 인증 가이드 권장 패턴).
// React.cache로 감싸 같은 요청 안에서는 layout과 page가 각자 호출해도
// Supabase Auth 서버 왕복이 한 번만 일어난다.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  return user.id;
}
