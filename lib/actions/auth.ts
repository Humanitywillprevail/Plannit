"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { AuthError } from "@supabase/supabase-js";

// Supabase(Auth) 서버 자체에 연결이 안 될 때 "fetch failed" 같은 원문 대신
// 원인을 알 수 있는 메시지를 보여준다. (로컬 개발 중 supabase start를 안 띄웠거나,
// 배포 환경의 SUPABASE URL/키 설정이 잘못된 경우 등)
function authErrorMessage(error: AuthError, fallback: string): string {
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return "인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.";
  }
  return error.message || fallback;
}

// 로컬(localhost:3000)과 배포된 도메인 양쪽에서 이메일 확인 링크가 올바른
// 주소로 돌아오도록, 요청의 Origin을 그대로 emailRedirectTo로 넘긴다.
// Supabase 대시보드 > Authentication > URL Configuration의
// Redirect URLs 허용 목록에 두 주소(로컬/배포) 모두 등록해야 동작한다.
async function getOrigin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

export async function signup(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(`/signup?error=${encodeURIComponent("이메일과 비밀번호를 입력해주세요.")}`);
  }
  if (password.length < 6) {
    redirect(`/signup?error=${encodeURIComponent("비밀번호는 6자 이상이어야 합니다.")}`);
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(authErrorMessage(error, "회원가입에 실패했습니다."))}`);
  }

  // 이메일 확인이 켜져 있으면 signUp만으로는 세션이 생기지 않는다 —
  // 안내 화면을 보여주고, 확인 링크를 눌러야 /auth/confirm에서 로그인 처리된다.
  if (!data.session) {
    redirect(`/signup?sent=${encodeURIComponent(email)}`);
  }

  redirect("/semesters");
}

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("이메일과 비밀번호를 입력해주세요.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    let message: string;
    if (error.name === "AuthRetryableFetchError" || error.status === 0) {
      message = authErrorMessage(error, "로그인에 실패했습니다.");
    } else if (error.code === "email_not_confirmed") {
      message = "이메일 확인이 아직 안 됐어요. 받은 메일함의 확인 링크를 눌러주세요.";
    } else {
      message = "이메일 또는 비밀번호가 올바르지 않습니다.";
    }
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  redirect("/semesters");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
