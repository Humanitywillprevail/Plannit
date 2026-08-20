import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { sendEmail } from "@/lib/email/resend";
import { signupConfirmationEmailHtml } from "@/lib/email/templates";

// Supabase 대시보드 > Authentication > Hooks > "Send Email" 훅이 회원가입/비밀번호
// 재설정 등 인증 메일을 보낼 때마다 이 엔드포인트를 호출한다. 여기서 직접 Resend로
// 발송하면 Supabase 기본 이메일 대신 우리 템플릿/발신 도메인을 쓸 수 있다.
// 설정 방법: 훅 활성화 시 표시되는 URL(.../api/auth/send-email)과 시크릿을
// SEND_EMAIL_HOOK_SECRET에 등록.
type SendEmailHookPayload = {
  user: { email: string };
  email_data: {
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
  };
};

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  const hookSecret = (process.env.SEND_EMAIL_HOOK_SECRET ?? "").replace("v1,whsec_", "");
  const wh = new Webhook(hookSecret);

  let event: SendEmailHookPayload;
  try {
    event = wh.verify(payload, headers) as SendEmailHookPayload;
  } catch {
    return NextResponse.json(
      { error: { http_code: 401, message: "서명이 유효하지 않습니다." } },
      { status: 401 }
    );
  }

  const { user, email_data } = event;

  // 지금은 회원가입 확인 메일만 커스텀 발송한다. 다른 유형(비밀번호 재설정 등)은
  // 아직 템플릿이 없으니 Supabase 기본 발송 경로로 넘긴다.
  if (email_data.email_action_type !== "signup") {
    return NextResponse.json({});
  }

  const confirmUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${email_data.redirect_to}`;

  try {
    await sendEmail({
      to: user.email,
      subject: "Plannit 이메일 인증을 완료해주세요",
      html: signupConfirmationEmailHtml(confirmUrl),
    });
  } catch {
    return NextResponse.json(
      { error: { http_code: 500, message: "이메일 발송에 실패했습니다." } },
      { status: 500 }
    );
  }

  return NextResponse.json({});
}
