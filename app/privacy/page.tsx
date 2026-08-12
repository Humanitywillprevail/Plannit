import type { Metadata } from "next";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "개인정보처리방침 | Plannit",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-ink-secondary">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <PageHeader
        title="개인정보처리방침"
        subtitle="시행일자: 2026년 8월 12일"
        backHref="/"
        backLabel="홈으로"
      />
      <Card className="space-y-6">
        <p className="text-sm leading-relaxed text-ink-secondary">
          Plannit(이하 &quot;회사&quot; 또는 &quot;서비스&quot;)은 이용자의 개인정보를
          중요시하며, 「개인정보 보호법」 등 관련 법령을 준수합니다. 본 방침은
          이용자가 제공한 개인정보가 어떤 목적과 방식으로 이용되며, 보호를
          위해 어떤 조치가 취해지는지 안내합니다.
        </p>

        <Section title="1. 수집하는 개인정보 항목 및 수집 방법">
          <p>필수항목: 이메일 주소, 비밀번호(암호화 저장)</p>
          <p>
            서비스 이용 과정에서 이용자가 직접 입력하는 정보: 학기명,
            과목명·학점·성적, 과제/시험/프로젝트 등 기록 내용, 첨부파일(파일명,
            크기, 형식)
          </p>
          <p>
            자동 수집 정보: 로그인 세션 쿠키, 접속 로그, 서비스 이용 기록,
            분석 도구(Google Analytics, Vercel Analytics)를 통한 방문
            페이지·접속 기기 및 브라우저 정보·방문 경로
          </p>
          <p>수집 방법: 회원가입 및 이메일 인증, 서비스 이용 중 입력, 파일 업로드</p>
        </Section>

        <Section title="2. 개인정보의 수집 및 이용 목적">
          <ul className="list-disc space-y-1 pl-5">
            <li>회원 가입의사 확인, 본인 식별·인증, 회원제 서비스 제공</li>
            <li>학기별 학업·활동 기록 저장 및 역량 분석 결과 제공</li>
            <li>공지사항 전달, 부정 이용 방지 등 서비스 운영</li>
            <li>계정 복구 및 문의 응대</li>
          </ul>
        </Section>

        <Section title="3. 개인정보의 보유 및 이용기간">
          <p>
            회원 탈퇴 시 지체 없이 파기합니다. 다만 관계 법령에 따라 보존할
            필요가 있는 경우 해당 법령이 정한 기간 동안 보관합니다(예:
            통신비밀보호법에 따른 로그인 기록 3개월).
          </p>
        </Section>

        <Section title="4. 개인정보의 제3자 제공">
          <p>
            회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.
            다만 이용자가 사전에 동의했거나, 법령에 근거하여 수사기관이 법이
            정한 절차에 따라 요청한 경우는 예외로 합니다.
          </p>
        </Section>

        <Section title="5. 개인정보처리의 위탁 및 국외 이전">
          <p>
            회사는 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁하고
            있습니다.
          </p>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-black/[0.02] dark:bg-white/[0.03]">
                  <th className="px-3 py-2 font-medium">수탁업체</th>
                  <th className="px-3 py-2 font-medium">위탁업무 내용</th>
                  <th className="px-3 py-2 font-medium">보유·이용기간</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="px-3 py-2 align-top">Supabase, Inc.</td>
                  <td className="px-3 py-2 align-top">
                    회원 인증(이메일/비밀번호), 데이터베이스 및 첨부파일 저장·관리
                  </td>
                  <td className="px-3 py-2 align-top">
                    회원 탈퇴 또는 위탁계약 종료 시까지
                  </td>
                </tr>
                <tr className="border-b border-line">
                  <td className="px-3 py-2 align-top">Google LLC</td>
                  <td className="px-3 py-2 align-top">
                    Google Analytics를 통한 서비스 이용 통계 분석
                  </td>
                  <td className="px-3 py-2 align-top">위탁계약 종료 시까지</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 align-top">Vercel Inc.</td>
                  <td className="px-3 py-2 align-top">
                    서비스 호스팅, Vercel Analytics를 통한 트래픽·성능 분석
                  </td>
                  <td className="px-3 py-2 align-top">위탁계약 종료 시까지</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Supabase의 서버 인프라는 국외에 위치할 수 있으며, 이 경우
            이용자의 개인정보가 국외로 이전되어 처리됩니다. 회사는 관련
            법령이 정하는 안전성 확보조치를 갖춘 사업자와만 계약을
            체결합니다.
          </p>
        </Section>

        <Section title="6. 이용자의 권리와 행사방법">
          <p>
            이용자는 언제든지 자신의 개인정보를 조회·수정할 수 있으며, 회원
            탈퇴를 통해 수집·이용 동의를 철회할 수 있습니다. 권리 행사는
            아래 &quot;8. 개인정보 보호책임자&quot;의 연락처로 요청하실 수
            있습니다.
          </p>
        </Section>

        <Section title="7. 개인정보의 파기절차 및 방법">
          <p>
            개인정보의 처리 목적이 달성된 경우, 전자적 파일 형태의 정보는
            복구 및 재생이 불가능한 방법으로 즉시 삭제합니다.
          </p>
        </Section>

        <Section title="8. 개인정보 보호책임자">
          <p>성명: Plannit 운영자</p>
          <p>이메일: ljb05170517@gmail.com</p>
          <p>
            개인정보 관련 문의, 불만처리, 피해구제 등에 관한 사항은 위
            연락처로 문의하실 수 있습니다.
          </p>
        </Section>

        <Section title="9. 쿠키(Cookie)의 설치·운영 및 거부">
          <p>
            회사는 이용자에게 최적화된 서비스를 제공하기 위해 이용정보를
            저장하고 수시로 불러오는 &apos;쿠키(cookie)&apos;를 사용합니다.
          </p>
          <p>
            사용 목적: 이용자의 방문 페이지, 접속 빈도, 방문 경로 등을
            분석하여 서비스 개선 및 통계 작성에 활용합니다(Google Analytics,
            Vercel Analytics).
          </p>
          <p>
            거부 방법: 이용자는 웹브라우저의 설정 메뉴를 통해 쿠키 저장을
            거부할 수 있습니다. 다만 쿠키 저장을 거부할 경우 일부 서비스
            이용에 어려움이 있을 수 있습니다.
          </p>
        </Section>

        <Section title="10. 고지의 의무">
          <p>
            이 개인정보처리방침의 내용이 추가, 삭제 또는 수정되는 경우 적용
            최소 7일 전부터 서비스 내 공지사항을 통해 고지합니다.
          </p>
        </Section>

        <p className="border-t border-line pt-4 text-sm text-ink-muted">
          부칙: 이 방침은 2026년 8월 12일부터 시행됩니다.
        </p>
      </Card>
    </main>
  );
}
