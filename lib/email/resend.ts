import "server-only";
import { Resend } from "resend";

// 무료 플랜 기준 하루 100건 / 월 3,000건 전송 가능 (https://resend.com/docs/api-reference/errors).
// 도메인 인증 전에는 from을 onboarding@resend.dev로만 보낼 수 있다.
export function createResendClient() {
  return new Resend(process.env.RESEND_API_KEY!);
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const resend = createResendClient();
  const from = process.env.RESEND_FROM_EMAIL ?? "Plannit <onboarding@resend.dev>";

  const { data, error } = await resend.emails.send({ from, to, subject, html });

  if (error) {
    throw new Error(`Resend 이메일 발송 실패: ${error.message}`);
  }

  return data;
}
