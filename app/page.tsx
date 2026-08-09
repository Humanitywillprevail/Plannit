import Link from "next/link";
import { CalendarDays, Sigma, Paperclip } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import GradeBadge from "@/components/ui/GradeBadge";

const FEATURES = [
  {
    icon: CalendarDays,
    title: "학기별 기록",
    description: "과목마다 과제, 시험, 발표 등 한 일을 그때그때 남겨두세요.",
  },
  {
    icon: Sigma,
    title: "자동 평균 계산",
    description: "학점과 성적만 입력하면 학기 평균이 자동으로 계산돼요.",
  },
  {
    icon: Paperclip,
    title: "포트폴리오용 첨부파일",
    description: "결과물 이미지나 문서를 기록에 붙여 나중에 그대로 꺼내 쓰세요.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-3xl px-6 pt-16 pb-12 text-center">
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
          학기별로 내가 한 일을
          <br />
          기록하고 정리하는 공간
        </h1>
        <p className="mt-4 text-ink-secondary">
          과목, 성적, 과제 기록을 한곳에 모아두면 포트폴리오와 자기소개서를 쓸 때 바로 꺼내 쓸 수 있어요.
        </p>
        <div className="mt-8">
          <Link href="/signup">
            <Button size="lg">무료로 시작하기</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 pb-16">
        <Card className="pointer-events-none select-none">
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="text-lg font-semibold">2026-1학기</p>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-accent">
              평균 4.12
            </span>
          </div>
          <ul className="space-y-1.5">
            <li className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-ink-secondary">자료구조</span>
              <GradeBadge grade="A+" className="shrink-0" />
            </li>
            <li className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-ink-secondary">데이터베이스</span>
              <GradeBadge grade="A0" className="shrink-0" />
            </li>
          </ul>
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm">
              <Badge className="mr-2 align-middle">과제</Badge>
              팀 프로젝트 API 설계 문서 작성
            </p>
          </div>
        </Card>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <span className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Icon className="size-4.5" />
              </span>
              <p className="mb-1 font-semibold">{title}</p>
              <p className="text-sm text-ink-secondary">{description}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
