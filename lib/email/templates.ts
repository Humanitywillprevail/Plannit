export function signupConfirmationEmailHtml(confirmUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
      <h1 style="font-size: 20px; margin-bottom: 12px;">Plannit 이메일 인증</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #444;">
        아래 버튼을 눌러 이메일 인증을 완료하면 Plannit을 바로 사용할 수 있어요.
      </p>
      <a href="${confirmUrl}"
        style="display: inline-block; margin: 20px 0; padding: 10px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
        이메일 인증하기
      </a>
      <p style="font-size: 12px; color: #999; line-height: 1.6;">
        버튼이 눌리지 않으면 아래 링크를 브라우저에 붙여넣어주세요.<br />
        <a href="${confirmUrl}" style="color: #999; word-break: break-all;">${confirmUrl}</a>
      </p>
      <p style="font-size: 12px; color: #999; margin-top: 24px;">
        본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.
      </p>
    </div>
  `;
}
