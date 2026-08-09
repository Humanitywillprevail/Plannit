"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthError } from "@supabase/supabase-js";

// 로컬/개발 환경에서 Supabase(Auth) 서버 자체에 연결이 안 될 때
// "fetch failed" 같은 원문 대신 원인을 알 수 있는 메시지를 보여준다.
function authErrorMessage(error: AuthError, fallback: string): string {
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return "인증 서버에 연결할 수 없습니다. 로컬 Supabase가 실행 중인지 확인해주세요 (npx supabase start).";
  }
  return error.message || fallback;
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(authErrorMessage(error, "회원가입에 실패했습니다."))}`);
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
    const message =
      error.name === "AuthRetryableFetchError" || error.status === 0
        ? authErrorMessage(error, "로그인에 실패했습니다.")
        : "이메일 또는 비밀번호가 올바르지 않습니다.";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  redirect("/semesters");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
