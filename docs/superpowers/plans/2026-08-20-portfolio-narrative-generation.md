# Portfolio Narrative Generation + PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users turn their filled-in "7-stage" record fields into an AI-written narrative, view them on a `/portfolio` page, and download the whole set as one PDF.

**Architecture:** A new `narrative` JSON column on `Record` stores the generated 6-section text. A Server Action generates narratives for all pending (field-filled, narrative-missing) records on button click — no automatic generation during page render. A read-only `/portfolio` page displays what's generated. A PDF route handler renders already-generated narratives with `@react-pdf/renderer`, registering a remotely-fetched Korean font so Korean text doesn't break.

**Tech Stack:** Next.js 16 (App Router, Cache Components), Prisma 7 (Postgres), `ai` SDK v6 + `@ai-sdk/anthropic` (direct Anthropic billing, not AI Gateway), `@react-pdf/renderer` (new dependency).

**Spec:** `docs/superpowers/specs/2026-08-20-portfolio-narrative-generation-design.md`

## Global Constraints

- Model for narrative generation is `claude-sonnet-5` via `anthropic("claude-sonnet-5")` — not haiku, not AI Gateway (this project calls Anthropic directly everywhere; see `lib/analysis/analyzeCourse.ts`).
- Narrative generation is **never** triggered inside a Server Component's render (page load). It only runs inside the `generatePendingNarratives` Server Action, triggered by a form submit.
- PDF export produces one combined PDF for all generated narratives — no per-narrative individual download in this round.
- `@react-pdf/renderer` does not embed CJK glyphs by default — the Korean font (Noto Sans KR) MUST be registered via `Font.register` before any Korean text is rendered, or output is broken/missing glyphs.
- This repo has no automated test framework (verified: no `test`/`jest`/`vitest` scripts, no `__tests__` or `*.test.ts` files anywhere in `app`/`lib`). Verification steps in this plan are `tsc --noEmit` + `eslint` + manual exercise via the dev server, matching how `analyzeCourse.ts`/`reanalyze.ts` were verified — do not introduce a new test framework as part of this feature.
- Follow existing patterns: Server Actions live in `lib/actions/*.ts` with `"use server"`; per-record LLM failures are caught and skipped, never allowed to fail the whole action (see `lib/analysis/reanalyze.ts`).

---

## File Structure

- `prisma/schema.prisma` — add `narrative Json?` to `Record`.
- `lib/analysis/generateNarrative.ts` (new) — LLM call that turns one record's fields into a 6-section narrative. Exports `RecordNarrative` type, `NARRATIVE_SECTION_LABELS`, `generateNarrative()`.
- `lib/actions/portfolio.ts` (new) — `portfolioEligibleWhere()` (shared Prisma filter) and the `generatePendingNarratives()` Server Action.
- `app/portfolio/page.tsx` (new) — read-only display + "포트폴리오 만들기" button for pending records.
- `app/semesters/page.tsx` (modify) — add a nav button to `/portfolio`, alongside the existing `/report` button.
- `app/portfolio/pdf/route.tsx` (new — `.tsx` because it renders JSX) — GET handler streaming back a combined PDF.
- `package.json` (modify) — add `@react-pdf/renderer`.

---

## Task 1: Add `narrative` field to `Record` and migrate

**Files:**
- Modify: `prisma/schema.prisma`
- Create (via CLI, not by hand): a new file under `prisma/migrations/`

**Interfaces:**
- Produces: `Record.narrative` — Prisma `Json?` column. Later tasks read/write it as `RecordNarrative | null` (defined in Task 2) via a cast, and filter on it using `Prisma.DbNull` (Prisma's sentinel for "column is SQL NULL", as opposed to `Prisma.JsonNull` which means "column holds the JSON literal `null`" — these are different in Prisma and using the wrong one silently returns zero rows).

- [ ] **Step 1: Add the field to the schema**

In `prisma/schema.prisma`, inside `model Record { ... }`, add one line after `competencyNote`:

```prisma
model Record {
  id             Int          @id @default(autoincrement())
  userId         String
  courseId       Int
  type           String
  content        String
  summary        String?
  background     String?
  process        String?
  outcome        String?
  growth         String?
  competencyNote String?
  narrative      Json? // LLM이 생성한 7단계 내러티브({ intro, background, process, outcome, growth, competency }). null = 아직 생성 안 됨.
  createdAt      DateTime     @default(now())
  course         Course       @relation(fields: [courseId], references: [id], onDelete: Cascade)
  attachments    Attachment[]

  @@index([userId])
}
```

- [ ] **Step 2: Format the schema**

Run: `npx prisma format`

- [ ] **Step 3: Create and apply the migration**

Run: `npx prisma migrate dev --name add_record_narrative`

Expected: a new folder appears under `prisma/migrations/` and the CLI prints "Your database is now in sync with your schema."

- [ ] **Step 4: Regenerate the Prisma client**

Run: `npx prisma generate`

Expected: "Generated Prisma Client ... to ./lib/generated/prisma"

- [ ] **Step 5: Verify the type is visible**

Run: `npx tsc --noEmit`

Expected: no errors (there's no code referencing `narrative` yet, so this just confirms the client regenerated cleanly).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "Add narrative field to Record for portfolio generation"
```

---

## Task 2: Narrative generation core (`lib/analysis/generateNarrative.ts`)

**Files:**
- Create: `lib/analysis/generateNarrative.ts`

**Interfaces:**
- Consumes: `generateText`/`Output` from `ai`, `anthropic` from `@ai-sdk/anthropic`, `z` from `zod` (all already dependencies — see `lib/analysis/analyzeCourse.ts` for the identical import pattern).
- Produces:
  - `type RecordNarrative = { intro: string; background: string; process: string; outcome: string; growth: string; competency: string }`
  - `const NARRATIVE_SECTION_LABELS: { key: keyof RecordNarrative; label: string }[]` — Korean labels in display order, consumed by both `app/portfolio/page.tsx` (Task 4) and `app/portfolio/pdf/route.tsx` (Task 6).
  - `type NarrativeInput = { content: string; summary: string | null; background: string | null; process: string | null; outcome: string | null; growth: string | null; competencyNote: string | null }` — shape matches the six `Record` fields plus `content`, using the **input** field names (`competencyNote`, `summary`), which differ from the **output** narrative's key names (`competency`, `intro`) — this asymmetry is intentional (input fields mirror the DB column names; output keys mirror the 7-stage vocabulary) and both later tasks must use the correct set for the right side.
  - `async function generateNarrative(input: NarrativeInput): Promise<RecordNarrative>` — throws on LLM/network failure; callers must catch (Task 3 does).

- [ ] **Step 1: Write the file**

```ts
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

export type RecordNarrative = {
  intro: string;
  background: string;
  process: string;
  outcome: string;
  growth: string;
  competency: string;
};

// 화면(app/portfolio/page.tsx)과 PDF(app/portfolio/pdf/route.tsx)가 공유하는
// 표시 순서 + 한글 라벨. 여기 한 곳에서만 정의한다.
export const NARRATIVE_SECTION_LABELS: { key: keyof RecordNarrative; label: string }[] = [
  { key: "intro", label: "소개" },
  { key: "background", label: "배경/목적" },
  { key: "process", label: "과정" },
  { key: "outcome", label: "결과물" },
  { key: "growth", label: "성장한 점" },
  { key: "competency", label: "나의 역량" },
];

const NARRATIVE_SCHEMA = z.object({
  intro: z.string(),
  background: z.string(),
  process: z.string(),
  outcome: z.string(),
  growth: z.string(),
  competency: z.string(),
});

export type NarrativeInput = {
  content: string;
  summary: string | null;
  background: string | null;
  process: string | null;
  outcome: string | null;
  growth: string | null;
  competencyNote: string | null;
};

function buildPrompt(input: NarrativeInput): string {
  const lines = [`진행한 일: ${input.content}`];
  if (input.summary) lines.push(`소개(한 줄 요약): ${input.summary}`);
  if (input.background) lines.push(`배경/목적: ${input.background}`);
  if (input.process) lines.push(`과정: ${input.process}`);
  if (input.outcome) lines.push(`결과물: ${input.outcome}`);
  if (input.growth) lines.push(`성장한 점: ${input.growth}`);
  if (input.competencyNote) lines.push(`나의 역량: ${input.competencyNote}`);

  return `아래는 한 대학생이 어떤 학업 활동에 대해 남긴 메모다. 이 메모를 재료로 삼아,
사람이 읽었을 때 자연스러운 하나의 이야기로 느껴지도록 7단계 구조의 자기소개용 포트폴리오
문단을 1인칭으로 작성하라. 메모에 없는 내용을 지어내지 말고, 메모에 있는 사실만 활용해서
문장을 다듬고 이어 붙여라.

메모:
${lines.join("\n")}

작성할 항목 (각 항목은 한 문단):
- intro: 이 활동을 한 줄로 소개
- background: 왜 이 활동을 하게 됐는지
- process: 어떤 행동을 했고 어떤 인사이트를 얻었는지
- outcome: 최종적으로 만들어낸 것
- growth: 이 경험으로 성장한 점
- competency: 느낀 점, 배운 점, 다짐`;
}

// 한 Record의 필드를 7단계 구조의 서사형 텍스트로 재구성한다.
// 실패 시 그대로 throw — 호출부(lib/actions/portfolio.ts)가 기록 단위로 catch한다.
export async function generateNarrative(input: NarrativeInput): Promise<RecordNarrative> {
  const { output } = await generateText({
    model: anthropic("claude-sonnet-5"),
    output: Output.object({ schema: NARRATIVE_SCHEMA }),
    prompt: buildPrompt(input),
  });

  return output;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint lib/analysis/generateNarrative.ts`
Expected: no errors.

- [ ] **Step 4: Manual smoke check against the real API**

This calls the real Anthropic API once to confirm the prompt/schema actually works end to end — there's no mock/test infra in this repo to fake it (same as `analyzeCourse.ts` has no test). Create a throwaway script, run it, then delete it (do not commit it):

```bash
cat > /tmp/smoke-narrative.ts <<'EOF'
import { generateNarrative } from "../workspaces/codespaces-blank/lib/analysis/generateNarrative";

generateNarrative({
  content: "데이터 분석 수업 팀 프로젝트에서 서울시 공공자전거 이용 데이터를 분석해 대여소 배치를 제안했다.",
  summary: "공공자전거 대여소 배치 최적화 제안",
  background: "실제 데이터로 도시 문제를 풀어보고 싶어서 팀 프로젝트 주제로 선택했다.",
  process: "pandas로 시간대별 이용 패턴을 분석하고, 대여소별 수요-공급 격차를 계산했다.",
  outcome: "수요 대비 공급 부족 상위 10개 대여소를 찾아 재배치안을 발표자료로 정리했다.",
  growth: "raw 데이터를 정제하는 데 생각보다 시간이 오래 걸린다는 걸 배웠다.",
  competencyNote: "데이터 분석 역량에 자신감이 붙었다.",
}).then((r) => console.log(JSON.stringify(r, null, 2)));
EOF
npx tsx /tmp/smoke-narrative.ts
rm /tmp/smoke-narrative.ts
```

Expected: prints a JSON object with all six keys (`intro`, `background`, `process`, `outcome`, `growth`, `competency`) as non-empty Korean strings, no thrown error. If it throws an auth/model error, check `ANTHROPIC_API_KEY` in `.env.local` and that `claude-sonnet-5` is a valid model id for the configured `@ai-sdk/anthropic` version before proceeding.

- [ ] **Step 5: Commit**

```bash
git add lib/analysis/generateNarrative.ts
git commit -m "Add LLM narrative generation for portfolio records"
```

---

## Task 3: Server Action (`lib/actions/portfolio.ts`)

**Files:**
- Create: `lib/actions/portfolio.ts`

**Interfaces:**
- Consumes: `generateNarrative`, `NarrativeInput` from Task 2 (`lib/analysis/generateNarrative.ts`); `requireUserId` from `lib/auth/session.ts`; `prisma` from `lib/db/client.ts`; `Prisma` namespace from `@/lib/generated/prisma/client` (for `Prisma.RecordWhereInput` type and the `Prisma.DbNull` runtime sentinel).
- Produces:
  - `function portfolioEligibleWhere(userId: string): Prisma.RecordWhereInput` — consumed by `app/portfolio/page.tsx` (Task 4) and `app/portfolio/pdf/route.tsx` (Task 6). Matches records where `userId` matches AND at least one of the six portfolio fields is non-null (same "eligible" criterion the record list already uses for its own "포트폴리오 상세 보기" toggle in `app/courses/[courseId]/page.tsx`).
  - `async function generatePendingNarratives(): Promise<void>` — a Server Action (used directly as a `<form action={...}>` target), used by `app/portfolio/page.tsx` (Task 4).

- [ ] **Step 1: Write the file**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireUserId } from "@/lib/auth/session";
import { generateNarrative } from "@/lib/analysis/generateNarrative";

// 6개 상세필드 중 하나라도 채워진 기록만 "포트폴리오 대상"으로 본다 —
// app/courses/[courseId]/page.tsx의 "포트폴리오 상세 보기" 토글과 동일한 기준.
export function portfolioEligibleWhere(userId: string): Prisma.RecordWhereInput {
  return {
    userId,
    OR: [
      { summary: { not: null } },
      { background: { not: null } },
      { process: { not: null } },
      { outcome: { not: null } },
      { growth: { not: null } },
      { competencyNote: { not: null } },
    ],
  };
}

// 대상 기록 중 아직 narrative가 없는 것만 생성한다. 버튼 클릭으로만 호출되며,
// 페이지 렌더링 중에는 절대 호출하지 않는다 (Next.js Server Component에서
// LLM 호출 + DB 쓰기를 하면 안 되는 이유는 app/layout.tsx의 connection() 관련
// 커밋 참고 — 비슷한 부류의 문제라 애초에 피한다).
export async function generatePendingNarratives(): Promise<void> {
  const userId = await requireUserId();

  const pending = await prisma.record.findMany({
    where: {
      ...portfolioEligibleWhere(userId),
      narrative: { equals: Prisma.DbNull },
    },
  });

  for (const record of pending) {
    try {
      const narrative = await generateNarrative({
        content: record.content,
        summary: record.summary,
        background: record.background,
        process: record.process,
        outcome: record.outcome,
        growth: record.growth,
        competencyNote: record.competencyNote,
      });
      await prisma.record.update({
        where: { id: record.id },
        data: { narrative },
      });
    } catch (error) {
      // 개별 기록의 생성 실패가 나머지를 막으면 안 된다 (reanalyzeCourse와 동일 패턴).
      // 다음에 버튼을 다시 누르면 재시도된다.
      console.error(`generatePendingNarratives: record ${record.id} 생성 실패:`, error);
    }
  }

  revalidatePath("/portfolio");
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `Prisma.DbNull` reports a type error, confirm the import is `import { Prisma } from "@/lib/generated/prisma/client"` — the same module `lib/db/client.ts` imports `PrismaClient` from — not `@prisma/client`.)

- [ ] **Step 3: Lint**

Run: `npx eslint lib/actions/portfolio.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/portfolio.ts
git commit -m "Add generatePendingNarratives server action"
```

---

## Task 4: Portfolio page (`app/portfolio/page.tsx`)

**Files:**
- Create: `app/portfolio/page.tsx`

**Interfaces:**
- Consumes: `portfolioEligibleWhere`, `generatePendingNarratives` (Task 3); `RecordNarrative`, `NARRATIVE_SECTION_LABELS` (Task 2); `requireUserId` (`lib/auth/session.ts`); `prisma` (`lib/db/client.ts`); `Card`, `Button`, `PageHeader`, `EmptyState` (`components/ui/*`, all pre-existing — see `app/report/page.tsx` for the same set used the same way).
- Produces: the `/portfolio` route. No exports consumed by later tasks except the URL path `/portfolio` (linked from Task 5) and `/portfolio/pdf` (Task 6, referenced here as a plain `<a href>`, not a Next `<Link>`, since it's a file download rather than a client-side navigation).

- [ ] **Step 1: Write the file**

```tsx
import { BookOpen, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { portfolioEligibleWhere, generatePendingNarratives } from "@/lib/actions/portfolio";
import { NARRATIVE_SECTION_LABELS, type RecordNarrative } from "@/lib/analysis/generateNarrative";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function PortfolioPage() {
  const userId = await requireUserId();

  const records = await prisma.record.findMany({
    where: portfolioEligibleWhere(userId),
    orderBy: { createdAt: "desc" },
    include: { course: { select: { name: true } } },
  });

  const generated = records.filter((r) => r.narrative !== null);
  const pending = records.filter((r) => r.narrative === null);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title="포트폴리오"
        backHref="/semesters"
        backLabel="학기 리스트"
        action={
          generated.length > 0 ? (
            <a href="/portfolio/pdf">
              <Button variant="secondary" size="sm">
                전체 PDF 다운로드
              </Button>
            </a>
          ) : undefined
        }
      />

      {pending.length > 0 && (
        <Card className="mb-6">
          <form
            action={generatePendingNarratives}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-ink-secondary">
              아직 이야기로 만들지 않은 기록이 {pending.length}개 있어요.
            </p>
            <Button type="submit" size="sm">
              <Sparkles className="size-3.5" />
              포트폴리오 만들기
            </Button>
          </form>
        </Card>
      )}

      {generated.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-5" />}
          message="과목 상세 페이지에서 기록을 작성할 때 '포트폴리오용 상세 입력'을 채우면 이 자리에 포트폴리오가 채워져요."
        />
      ) : (
        <ul className="space-y-4">
          {generated.map((r) => {
            const narrative = r.narrative as unknown as RecordNarrative;
            return (
              <Card as="li" key={r.id}>
                <h2 className="mb-3 font-semibold">{r.course.name}</h2>
                <div className="space-y-3">
                  {NARRATIVE_SECTION_LABELS.map(({ key, label }) => (
                    <div key={key}>
                      <p className="text-xs text-ink-secondary">{label}</p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {narrative[key]}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint app/portfolio/page.tsx`
Expected: no errors.

- [ ] **Step 4: Manual verification via dev server**

Run: `npm run dev` (if not already running), then in a real browser (this Codespace's forwarded `*.app.github.dev` URL — see project memory on Turnstile/Codespaces if login fails):
1. Fill in at least one portfolio field on an existing record (`/courses/[id]`).
2. Visit `/portfolio`. Confirm the "포트폴리오 만들기" button appears with the correct pending count.
3. Click it. Confirm the page updates (after the action completes) to show a narrative card with all 6 Korean section labels and non-empty text.

Expected: no server errors in the terminal running `npm run dev`; the card's text is not `undefined`/`[object Object]`.

- [ ] **Step 5: Commit**

```bash
git add app/portfolio/page.tsx
git commit -m "Add /portfolio page"
```

---

## Task 5: Nav link from `/semesters`

**Files:**
- Modify: `app/semesters/page.tsx`

**Interfaces:**
- Consumes: nothing new — this only adds a `<Link href="/portfolio">` next to the existing `<Link href="/report">`.

- [ ] **Step 1: Add the `BookOpen` icon import**

In `app/semesters/page.tsx`, change:

```tsx
import { GraduationCap, Sparkles } from "lucide-react";
```

to:

```tsx
import { GraduationCap, Sparkles, BookOpen } from "lucide-react";
```

- [ ] **Step 2: Add the button next to "강점 리포트"**

Find this block (around line 31-39):

```tsx
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">학기 리스트</h1>
        <Link href="/report">
          <Button variant="secondary" size="sm">
            <Sparkles className="size-3.5" />
            강점 리포트
          </Button>
        </Link>
      </div>
```

Replace it with:

```tsx
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">학기 리스트</h1>
        <div className="flex items-center gap-2">
          <Link href="/report">
            <Button variant="secondary" size="sm">
              <Sparkles className="size-3.5" />
              강점 리포트
            </Button>
          </Link>
          <Link href="/portfolio">
            <Button variant="secondary" size="sm">
              <BookOpen className="size-3.5" />
              포트폴리오
            </Button>
          </Link>
        </div>
      </div>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npx eslint app/semesters/page.tsx`
Expected: no errors.

- [ ] **Step 5: Manual verification**

In the browser, visit `/semesters` and confirm both buttons render side by side and the new one navigates to `/portfolio`.

- [ ] **Step 6: Commit**

```bash
git add app/semesters/page.tsx
git commit -m "Link to /portfolio from the semester list"
```

---

## Task 6: PDF export (`app/portfolio/pdf/route.tsx`)

**Files:**
- Modify: `package.json` (add dependency)
- Create: `app/portfolio/pdf/route.tsx`

**Interfaces:**
- Consumes: `portfolioEligibleWhere` (Task 3); `NARRATIVE_SECTION_LABELS`, `RecordNarrative` (Task 2); `requireUserId`, `prisma`, `Prisma` (same as Task 3); `Document`, `Page`, `Text`, `View`, `StyleSheet`, `Font`, `renderToBuffer` from `@react-pdf/renderer`.
- Produces: `GET /portfolio/pdf` — streams back `application/pdf` or a 404 JSON error if nothing is generated yet. Linked from Task 4's page via a plain `<a href="/portfolio/pdf">`.

- [ ] **Step 1: Install the dependency**

Run: `npm install @react-pdf/renderer`

Expected: `package.json` and `package-lock.json` (or equivalent) updated, no peer dependency warnings (project uses React 19.2.8; `@react-pdf/renderer` 4.x declares `^19.0.0` support).

- [ ] **Step 2: Write the route handler**

Note the file extension is `.tsx`, not `.ts` — it contains JSX.

```tsx
import { NextResponse } from "next/server";
import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireUserId } from "@/lib/auth/session";
import { portfolioEligibleWhere } from "@/lib/actions/portfolio";
import { NARRATIVE_SECTION_LABELS, type RecordNarrative } from "@/lib/analysis/generateNarrative";

// @react-pdf/renderer는 한글 글리프를 기본 내장하지 않는다 — 등록 안 하면 한글이
// 깨지거나 안 나온다. Google Fonts CSS2 API에서 받은 실제 TTF 직링크
// (Noto Sans KR, OFL 라이선스, 임베드 가능). 모듈 로드 시 한 번만 등록한다.
Font.register({
  family: "NotoSansKR",
  src: "https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLQ.ttf",
});

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "NotoSansKR", fontSize: 11 },
  courseTitle: { fontSize: 16, marginBottom: 12 },
  section: { marginBottom: 10 },
  sectionLabel: { fontSize: 9, color: "#666666", marginBottom: 2 },
  sectionBody: { lineHeight: 1.5 },
});

export async function GET() {
  const userId = await requireUserId();

  const records = await prisma.record.findMany({
    where: {
      ...portfolioEligibleWhere(userId),
      narrative: { not: Prisma.DbNull },
    },
    orderBy: { createdAt: "desc" },
    include: { course: { select: { name: true } } },
  });

  if (records.length === 0) {
    return NextResponse.json(
      { error: "생성된 포트폴리오가 없습니다." },
      { status: 404 }
    );
  }

  const buffer = await renderToBuffer(
    <Document>
      {records.map((r) => {
        const narrative = r.narrative as unknown as RecordNarrative;
        return (
          <Page key={r.id} size="A4" style={styles.page}>
            <Text style={styles.courseTitle}>{r.course.name}</Text>
            {NARRATIVE_SECTION_LABELS.map(({ key, label }) => (
              <View key={key} style={styles.section}>
                <Text style={styles.sectionLabel}>{label}</Text>
                <Text style={styles.sectionBody}>{narrative[key]}</Text>
              </View>
            ))}
          </Page>
        );
      })}
    </Document>
  );

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="plannit-portfolio.pdf"',
    },
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npx eslint app/portfolio/pdf/route.tsx`
Expected: no errors.

- [ ] **Step 5: Manual verification — this is the step most likely to reveal a real problem**

With at least one narrative already generated (from Task 4's manual check), in the browser visit `/portfolio` and click "전체 PDF 다운로드". Open the downloaded file.

Expected: a PDF opens with one page per generated record, showing the course name and all 6 section labels/bodies **in readable Korean** (not boxes/tofu characters, not blank). If Korean text is missing/garbled, the font registration is the first thing to check — confirm the `Font.register` URL in Step 2 still resolves by running `curl -sI <url>` and checking for `HTTP/2 200` and `content-type: font/ttf`; if it 404s, re-fetch a current URL with `curl -s "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400"` and update the `src`.

Also confirm: visiting `/portfolio/pdf` directly with zero generated narratives (e.g. a fresh user, or via `curl` unauthenticated) returns 404, not a broken empty PDF.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app/portfolio/pdf/route.tsx
git commit -m "Add PDF export for the portfolio"
```

---

## After all tasks: report back, don't silently finish

This plan is implemented once Tasks 1-6 are all checked off and verified. There
is no Task 7 — but whoever finishes this plan should say explicitly, in their
final report: "Portfolio generation + PDF export is now implemented (`/portfolio`,
`app/portfolio/pdf/route.tsx`). The `project-plannit-overview` memory currently
says only the data-prep fields exist (as of the 2026-08-20 entry) — it should be
updated to reflect that generation is live." This is outside the repo (it's a
memory-file update in the coordinating session), so it can't be a plan task, but
it must not be dropped either.
