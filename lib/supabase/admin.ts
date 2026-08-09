import "server-only";
import { createClient } from "@supabase/supabase-js";

// service-role(secret) 키를 쓰는 관리자 클라이언트 — 절대 클라이언트로 내려보내지 않는다.
// 스토리지 업로드처럼 세션/쿠키가 필요 없는 서버 전용 작업에만 사용.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
