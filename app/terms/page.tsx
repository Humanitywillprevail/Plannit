import type { Metadata } from "next";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "이용약관 | Plannit",
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

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <PageHeader
        title="이용약관"
        subtitle="시행일자: 2026년 8월 12일"
        backHref="/"
        backLabel="홈으로"
      />
      <Card className="space-y-6">
        <Section title="제1조 (목적)">
          <p>
            이 약관은 Plannit(이하 &quot;회사&quot;)가 제공하는 학기별
            기록·역량 분석 서비스(이하 &quot;서비스&quot;)의 이용과 관련하여
            회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을
            규정함을 목적으로 합니다.
          </p>
        </Section>

        <Section title="제2조 (정의)">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              &quot;서비스&quot;란 회사가 제공하는 학기·과목·과제 등 학업 및
              활동 기록 저장, 역량 분석 및 관련 제반 서비스를 의미합니다.
            </li>
            <li>
              &quot;회원&quot;이란 이 약관에 동의하고 이메일 인증을 완료하여
              서비스를 이용하는 자를 말합니다.
            </li>
            <li>
              &quot;콘텐츠&quot;란 회원이 서비스 이용 과정에서 등록하는 기록,
              텍스트, 첨부파일 등 일체의 정보를 의미합니다.
            </li>
          </ul>
        </Section>

        <Section title="제3조 (약관의 효력 및 변경)">
          <p>이 약관은 서비스 화면에 게시하여 공지함으로써 효력이 발생합니다.</p>
          <p>
            회사는 관련 법령을 위반하지 않는 범위에서 약관을 개정할 수
            있으며, 개정 시 적용일자 및 개정사유를 명시하여 최소 7일 전(이용자에게
            불리한 경우 30일 전)부터 공지합니다.
          </p>
        </Section>

        <Section title="제4조 (이용계약의 성립)">
          <p>
            이용계약은 이용자가 약관에 동의하고 이메일·비밀번호를 입력하여
            가입을 신청한 후, 이메일 인증 링크를 통해 인증을 완료함으로써
            성립합니다.
          </p>
          <p>
            회사는 타인의 정보를 도용했거나, 허위 정보를 기재했거나, 기타
            회사가 정한 이용신청 요건을 충족하지 못한 신청에 대해서는 승낙을
            거부하거나 사후에 이용계약을 해지할 수 있습니다.
          </p>
        </Section>

        <Section title="제5조 (서비스의 제공 및 변경)">
          <ul className="list-disc space-y-1 pl-5">
            <li>학기·과목·성적 기록 및 평균 계산</li>
            <li>과제·시험·프로젝트 등 활동 기록 저장 및 첨부파일 첨부</li>
            <li>기록 내용 기반 역량 분석 결과 제공</li>
          </ul>
          <p>
            회사는 서비스의 내용을 변경할 수 있으며, 변경 시 사전에
            공지합니다. 무료로 제공되는 서비스는 운영상 필요에 따라 수정,
            중단, 변경될 수 있으며 관련 법령에 특별한 규정이 없는 한 별도의
            보상을 하지 않습니다.
          </p>
        </Section>

        <Section title="제6조 (서비스 이용시간 및 중단)">
          <p>
            서비스는 연중무휴 24시간 제공을 원칙으로 하되, 시스템 점검, 서버
            장애 등 불가피한 사유가 있는 경우 일시 중단될 수 있습니다.
          </p>
        </Section>

        <Section title="제7조 (회원의 의무)">
          <p>회원은 다음 행위를 하여서는 안 됩니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>가입 신청 또는 정보 변경 시 허위 내용 등록</li>
            <li>타인의 정보 도용</li>
            <li>회사 및 제3자의 저작권 등 지적재산권 침해</li>
            <li>회사 및 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
            <li>
              외설 또는 폭력적인 내용, 기타 공서양속에 반하는 정보를 게시하는
              행위
            </li>
          </ul>
          <p>
            회원은 자신이 업로드하는 콘텐츠(기록, 첨부파일 등)에 대한 모든
            권리와 책임을 부담하며, 제3자의 권리를 침해해서는 안 됩니다.
            또한 자신의 계정 정보를 스스로 관리해야 하며 이를 제3자가
            이용하게 해서는 안 됩니다.
          </p>
        </Section>

        <Section title="제8조 (콘텐츠의 저작권)">
          <p>
            회원이 서비스 내에 등록한 콘텐츠에 대한 저작권은 해당 콘텐츠의
            저작자인 회원에게 귀속됩니다. 회사는 서비스 운영, 전시, 전송,
            배포, 홍보 목적으로 회원의 별도 동의 없이 콘텐츠를 사용하지
            않으며, 활용이 필요한 경우 사전에 동의를 얻습니다.
          </p>
        </Section>

        <Section title="제9조 (계약해지 및 이용제한)">
          <p>
            회원은 언제든지 서비스 내 설정을 통해 이용계약 해지(회원 탈퇴)를
            신청할 수 있으며, 회사는 관련 법령이 정하는 바에 따라 이를
            즉시 처리합니다.
          </p>
          <p>
            회사는 회원이 제7조의 의무를 위반한 경우, 사전 통지 후 서비스
            이용을 제한하거나 이용계약을 해지할 수 있습니다.
          </p>
        </Section>

        <Section title="제10조 (면책조항)">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              회사는 천재지변, 불가항력적 사유로 서비스를 제공할 수 없는
              경우 책임이 면제됩니다.
            </li>
            <li>회사는 회원의 귀책사유로 인한 서비스 이용 장애에 대해 책임지지 않습니다.</li>
            <li>
              회사는 회원이 서비스에 게재한 정보, 자료, 콘텐츠의 신뢰도,
              정확성 등에 대해 책임지지 않습니다.
            </li>
            <li>
              본 서비스는 학업·활동 기록의 보조 도구이며, 회사는 역량 분석
              결과의 정확성이나 특정 목적에의 적합성을 보증하지 않습니다.
            </li>
          </ul>
        </Section>

        <Section title="제11조 (준거법 및 재판관할)">
          <p>
            이 약관과 관련하여 회사와 회원 간에 발생한 분쟁에 대해서는
            대한민국 법을 준거법으로 하며, 관할 법원은 민사소송법상의 관할
            법원으로 합니다.
          </p>
        </Section>

        <p className="border-t border-line pt-4 text-sm text-ink-muted">
          부칙: 이 약관은 2026년 8월 12일부터 시행됩니다.
        </p>
      </Card>
    </main>
  );
}
