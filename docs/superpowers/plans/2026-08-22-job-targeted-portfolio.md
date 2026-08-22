# Job-Targeted Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the all-records `/portfolio` page and the ephemeral `/gap-analysis` page with one persisted flow: a user picks a target job role, curates which recorded activities to include, saves that as a named `Portfolio`, and gets gap feedback + activity recommendations scoped to that specific selection.

**Architecture:** Two new Prisma models (`Portfolio`, `PortfolioRecord`) persist the selection. Gap analysis stays at `Course` granularity — the existing `analyzeJobRoleRequirements` (LLM) + `buildGapReport` (pure) pair runs unmodified, just fed a `CourseCompetency` query scoped to the courses touched by the portfolio's selected records instead of all of the user's courses. A new pure-code module (`recommendActivities`) finds courses outside the portfolio that would fill the biggest gaps — zero new LLM calls anywhere beyond the one already-existing job-role rating call. Narrative generation (`generateNarrative`) is unchanged, just triggered per-selection instead of account-wide.

**Tech Stack:** Next.js 16 (App Router, Cache Components), Prisma 7 (Postgres, adapter `@prisma/adapter-pg`), `ai` SDK v6 + `@ai-sdk/anthropic` (direct Anthropic billing, not AI Gateway), React 19 (`useActionState`, `useTransition`), `@react-pdf/renderer`.

**Spec:** `docs/superpowers/specs/2026-08-22-job-targeted-portfolio-design.md`

## Global Constraints

- Gap analysis reuses `CourseCompetency` at course granularity (Approach A from the spec) — no record-level competency analysis, no new LLM call for the comparison. The only LLM call in this whole feature is the existing `analyzeJobRoleRequirements` (Haiku), called once per "분석하기"/"다시 분석" click, never automatically.
- Activity recommendations are pure code (`lib/analysis/recommendActivities.ts`) — built entirely from existing `CourseCompetency` rows for courses *not yet* in the portfolio. No LLM call.
- `Portfolio.feedback` is a snapshot (JSON), only written by `analyzePortfolio`. Changing the record selection or job role does **not** auto-recompute it — it just goes stale until the user explicitly re-analyzes.
- Narrative generation (`generateNarrative`, unchanged) still only fires on explicit user action, never on page render, still capped at 5 records per call.
- This repo has no automated test framework. Verification is `npx tsc --noEmit` + `npx eslint <files>` + `npx next build` (mandatory for any task touching a `"use server"` file or a route — the portfolio narrative feature's final review caught a build-breaking synchronous export in a `"use server"` file that `tsc`/`eslint` alone missed) + manual exercise via a real browser session.
- Follow existing patterns: Server Actions in `lib/actions/*.ts` with `"use server"` at the top; every page component calls `requireUserId()` first and sets `export const instant = false`; every per-user query/mutation is scoped with `userId` in the `where` clause (ownership check via `findFirst({ where: { id, userId } })` before any mutation, `notFound()` if missing on pages); dynamic route `params` are `Promise<{...}>` (Next 16 convention — see `app/courses/[courseId]/page.tsx`); UI built only from existing `components/ui/*` primitives (`Card`, `Badge`, `Button`, `PageHeader`, `EmptyState`) — no new UI primitives.
- The `@react-pdf/renderer` Noto Sans KR remote-font-fetch setup (`Font.register` in the PDF route) is known-accepted fragility — carry it forward as-is, do not attempt to fix it as part of this work.

---

## File Structure

- `prisma/schema.prisma` (modify) — add `Portfolio`, `PortfolioRecord` models + `Record.portfolios` back-relation.
- `lib/analysis/recommendActivities.ts` (new) — pure-code activity recommendations.
- `lib/actions/portfolio.ts` (modify) — `generatePendingNarratives` gets an optional `recordIds` scoping param.
- `lib/actions/portfolios.ts` (new) — `createPortfolio`, `updatePortfolio`, `analyzePortfolio`, `deletePortfolio`.
- `lib/portfolio/pickerData.ts` (new) — shared query building the record-picker's grouped data, used by both the create and edit pages.
- `components/PortfolioRecordPicker.tsx` (new) — grouped checkbox list of pickable records.
- `components/PortfolioForm.tsx` (new) — name/job-role inputs + picker + submit, used by both create and edit.
- `components/PortfolioFeedbackPanel.tsx` (new) — renders a portfolio's feedback snapshot + "다시 분석" trigger.
- `app/portfolio/new/page.tsx` (new) — create flow.
- `app/portfolio/[id]/page.tsx` (new) — detail view.
- `app/portfolio/[id]/edit/page.tsx` (new) — edit flow.
- `app/portfolio/[id]/pdf/route.tsx` (new) — scoped PDF export, replaces `app/portfolio/pdf/route.tsx`.
- `app/portfolio/page.tsx` (rewrite) — list view, replaces the old all-records view.
- Removed (Task 14): `app/gap-analysis/`, `components/GapAnalysisForm.tsx`, `lib/actions/gapAnalysis.ts`, `components/GeneratePortfolioForm.tsx`, `app/portfolio/pdf/route.tsx`.
- `app/semesters/page.tsx` (modify, Task 14) — drop the "직무 갭 분석" nav button.

---

## Task 1: Prisma schema — `Portfolio` + `PortfolioRecord` models

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `prisma.portfolio` and `prisma.portfolioRecord` Prisma Client accessors, and `Record.portfolios: PortfolioRecord[]`. Consumed by every task from Task 4 onward.

- [ ] **Step 1: Add the models**

In `prisma/schema.prisma`, add after the `CourseCompetency` model:

```prisma
// 직무 타겟 포트폴리오. 사용자가 목표 직무 하나당 활동(Record)을 골라 담아서
// 저장하는 단위. 같은 활동이 여러 포트폴리오에 동시에 들어갈 수 있다
// (직무를 바꿔가며 여러 개 만드는 시나리오를 지원하기 위해 M:N으로 둔다).
model Portfolio {
  id            Int       @id @default(autoincrement())
  userId        String
  name          String
  targetJobRole String
  feedback      Json? // 마지막 analyzePortfolio 결과 스냅샷. null = 아직 분석 안 함.
  analyzedAt    DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  records       PortfolioRecord[]

  @@index([userId])
}

model PortfolioRecord {
  portfolioId Int
  recordId    Int
  portfolio   Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
  record      Record    @relation(fields: [recordId], references: [id], onDelete: Cascade)

  @@id([portfolioId, recordId])
}
```

- [ ] **Step 2: Add the back-relation on `Record`**

In `prisma/schema.prisma`, find the `Record` model's relation fields:

```prisma
  course         Course       @relation(fields: [courseId], references: [id], onDelete: Cascade)
  attachments    Attachment[]
```

Change to:

```prisma
  course         Course       @relation(fields: [courseId], references: [id], onDelete: Cascade)
  attachments    Attachment[]
  portfolios     PortfolioRecord[]
```

- [ ] **Step 3: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_portfolio`
Expected: a new folder appears under `prisma/migrations/` (e.g. `<timestamp>_add_portfolio`) containing `CREATE TABLE "Portfolio"` and `CREATE TABLE "PortfolioRecord"` statements; command exits 0; Prisma Client regenerates automatically as part of this command.

- [ ] **Step 4: Confirm the generated client has the new accessors**

Run: `npx tsc --noEmit`
Expected: no errors (this alone won't reference `prisma.portfolio` yet, but it confirms the schema change didn't break existing generated-type usage).

Run: `grep -c "model Portfolio" lib/generated/prisma/schema.prisma 2>/dev/null || grep -rl "PortfolioRecord" lib/generated/prisma/ | head -1`
Expected: some output confirming the generated client picked up the new models (exact file layout of the generated client isn't load-bearing — just confirm it's present somewhere under `lib/generated/prisma/`).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "Add Portfolio and PortfolioRecord models"
```

---

## Task 2: Pure-code activity recommendations (`lib/analysis/recommendActivities.ts`)

**Files:**
- Create: `lib/analysis/recommendActivities.ts`

**Interfaces:**
- Consumes: `GapItem` type from `lib/analysis/gapReport.ts` (already exists).
- Produces:
  - `type RecommendationCandidateRow = { score: number; competency: { key: string }; course: { id: number; name: string } }` — the shape Task 5's Prisma query must produce.
  - `type RecommendationItem = { courseId: number; courseName: string; competencyKey: string; competencyName: string; score: number; candidateRecordIds: number[] }`
  - `function recommendActivities(gapItems: GapItem[], otherCourseRows: RecommendationCandidateRow[], eligibleRecordsByCourse: Map<number, number[]>): RecommendationItem[]` — pure, synchronous. Consumed by Task 5.

- [ ] **Step 1: Write the file**

```ts
import type { GapItem } from "./gapReport";

export type RecommendationCandidateRow = {
  score: number;
  competency: { key: string };
  course: { id: number; name: string };
};

export type RecommendationItem = {
  courseId: number;
  courseName: string;
  competencyKey: string;
  competencyName: string;
  score: number;
  candidateRecordIds: number[];
};

const MAX_RECOMMENDATIONS = 3;
const MAX_GAPS_CONSIDERED = 2;
const MAX_PER_GAP = 2;

// 갭이 가장 큰 역량 1~2개에 대해, 아직 포트폴리오에 포함되지 않은 과목들 중
// 해당 역량 점수가 높은 과목을 추천한다. CourseCompetency 데이터만 사용하는
// 순수 계산 — 새 LLM 호출 없음. 매칭되는 과목이 없는 갭은 그냥 건너뛴다.
export function recommendActivities(
  gapItems: GapItem[],
  otherCourseRows: RecommendationCandidateRow[],
  eligibleRecordsByCourse: Map<number, number[]>
): RecommendationItem[] {
  const recommendations: RecommendationItem[] = [];

  for (const gap of gapItems.slice(0, MAX_GAPS_CONSIDERED)) {
    if (recommendations.length >= MAX_RECOMMENDATIONS) break;

    const matchingRows = otherCourseRows
      .filter((row) => row.competency.key === gap.key)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PER_GAP);

    for (const row of matchingRows) {
      if (recommendations.length >= MAX_RECOMMENDATIONS) break;
      recommendations.push({
        courseId: row.course.id,
        courseName: row.course.name,
        competencyKey: gap.key,
        competencyName: gap.name,
        score: row.score,
        candidateRecordIds: eligibleRecordsByCourse.get(row.course.id) ?? [],
      });
    }
  }

  return recommendations;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint lib/analysis/recommendActivities.ts`
Expected: no errors.

- [ ] **Step 4: Manual verification with a throwaway script (pure logic, no API call)**

```bash
cat > /tmp/smoke-recommend.ts <<'EOF'
import { recommendActivities } from "../workspaces/codespaces-blank/lib/analysis/recommendActivities";

const gapItems = [
  { key: "data-analysis", name: "데이터 분석", category: "기술", importance: 4, currentStrength: 0, message: "" },
  { key: "teamwork", name: "팀워크", category: "소프트스킬", importance: 3, currentStrength: 1, message: "" },
];

const otherCourseRows = [
  { score: 5, competency: { key: "data-analysis" }, course: { id: 10, name: "데이터베이스" } },
  { score: 3, competency: { key: "data-analysis" }, course: { id: 11, name: "통계학" } },
  { score: 2, competency: { key: "teamwork" }, course: { id: 12, name: "캡스톤" } },
  { score: 4, competency: { key: "programming" }, course: { id: 13, name: "무관한 과목" } },
];

const eligibleRecordsByCourse = new Map([
  [10, [101, 102]],
  [11, [103]],
  [12, [104]],
]);

const result = recommendActivities(gapItems, otherCourseRows, eligibleRecordsByCourse);
console.log(JSON.stringify(result, null, 2));
console.log("count === 3:", result.length === 3);
console.log("best data-analysis course first (id 10):", result[0].courseId === 10);
console.log("second data-analysis course is id 11:", result[1].courseId === 11);
console.log("teamwork course included (id 12):", result.some((r) => r.courseId === 12));
console.log("unrelated course (id 13) never appears:", !result.some((r) => r.courseId === 13));
EOF
npx tsx /tmp/smoke-recommend.ts
rm /tmp/smoke-recommend.ts
```

Expected: all five boolean lines print `true`. The two `data-analysis` courses (higher gap, `MAX_PER_GAP = 2`) both appear before the single `teamwork` course, and course 13 (unrelated competency) never appears.

- [ ] **Step 5: Commit**

```bash
git add lib/analysis/recommendActivities.ts
git commit -m "Add pure-code activity recommendation logic"
```

---

## Task 3: Scope `generatePendingNarratives` to specific records

**Files:**
- Modify: `lib/actions/portfolio.ts`

**Interfaces:**
- Produces: `generatePendingNarratives(recordIds?: number[]): Promise<void>` — when `recordIds` is provided, only those records (still capped at 5, still fail-soft per-record) are considered; when omitted, behavior is unchanged from today (used transitionally by the still-live `GeneratePortfolioForm.tsx` until Task 14 removes it). Consumed by Task 6.

- [ ] **Step 1: Modify the function**

In `lib/actions/portfolio.ts`, change:

```ts
export async function generatePendingNarratives(): Promise<void> {
  const userId = await requireUserId();

  const pending = await prisma.record.findMany({
    where: portfolioPendingWhere(userId),
    take: 5,
  });
```

to:

```ts
// recordIds가 주어지면 그 범위로만 좁혀서 처리한다 (포트폴리오 선택 화면에서
// 선택된 기록 중 narrative 없는 것만 생성할 때 사용). 생략하면 계정 전체
// 대상으로 동작한다 — 과거 호출부 호환을 위한 것일 뿐, 새 코드는 항상
// recordIds를 넘긴다.
export async function generatePendingNarratives(recordIds?: number[]): Promise<void> {
  const userId = await requireUserId();

  const pending = await prisma.record.findMany({
    where: recordIds
      ? { ...portfolioPendingWhere(userId), id: { in: recordIds } }
      : portfolioPendingWhere(userId),
    take: 5,
  });
```

Everything else in the file (the `for` loop, try/catch, `revalidatePath("/portfolio")`) stays unchanged.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`GeneratePortfolioForm.tsx` still calls `generatePendingNarratives()` with zero args — the new parameter is optional, so this must still compile.)

- [ ] **Step 3: Lint**

Run: `npx eslint lib/actions/portfolio.ts`
Expected: no errors.

- [ ] **Step 4: `next build`**

Run: `npx next build`
Expected: build succeeds, no error mentioning `lib/actions/portfolio.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/portfolio.ts
git commit -m "Scope generatePendingNarratives to an optional record ID list"
```

---

## Task 4: Portfolio CRUD actions (`createPortfolio`, `updatePortfolio`)

**Files:**
- Create: `lib/actions/portfolios.ts`

**Interfaces:**
- Consumes: `requireUserId` (`lib/auth/session.ts`); `prisma` (`lib/db/client.ts`); `portfolioEligibleWhere` (`lib/portfolio/queries.ts`, already exists).
- Produces:
  - `type PortfolioFormState = { status: "idle" } | { status: "error"; message: string }`
  - `async function createPortfolio(prevState: PortfolioFormState, formData: FormData): Promise<PortfolioFormState>` — redirects to `/portfolio/[id]` on success (never returns in that case). `useActionState`-compatible. Consumed by Task 9.
  - `async function updatePortfolio(prevState: PortfolioFormState, formData: FormData): Promise<PortfolioFormState>` — reads `portfolioId` from `formData`, redirects to `/portfolio/[id]` on success. Consumed by Task 11.

Both read a repeated `recordIds` form field via a shared private helper.

- [ ] **Step 1: Write the file**

```ts
"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { portfolioEligibleWhere } from "@/lib/portfolio/queries";

export type PortfolioFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

function readRecordIds(formData: FormData): number[] {
  return formData
    .getAll("recordIds")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
}

// 선택된 recordIds가 실제로 이 사용자의 "포트폴리오 대상" 기록인지 검증한다
// (클라이언트가 조작한 값을 그대로 믿지 않는다 — 다른 사용자 기록 ID를
// 끼워넣어도 이 카운트 비교에서 걸러진다).
async function validateRecordIds(userId: string, recordIds: number[]): Promise<boolean> {
  const eligibleCount = await prisma.record.count({
    where: { ...portfolioEligibleWhere(userId), id: { in: recordIds } },
  });
  return eligibleCount === recordIds.length;
}

export async function createPortfolio(
  prevState: PortfolioFormState,
  formData: FormData
): Promise<PortfolioFormState> {
  const userId = await requireUserId();

  const name = String(formData.get("name") ?? "").trim();
  const targetJobRole = String(formData.get("targetJobRole") ?? "").trim();
  const recordIds = readRecordIds(formData);

  if (!name || !targetJobRole) {
    return { status: "error", message: "이름과 목표 직무를 입력해주세요." };
  }
  if (recordIds.length === 0) {
    return { status: "error", message: "포함할 활동을 최소 1개 선택해주세요." };
  }
  if (!(await validateRecordIds(userId, recordIds))) {
    return { status: "error", message: "선택한 활동을 확인할 수 없어요. 다시 시도해주세요." };
  }

  const portfolio = await prisma.portfolio.create({
    data: {
      userId,
      name,
      targetJobRole,
      records: { create: recordIds.map((recordId) => ({ recordId })) },
    },
  });

  redirect(`/portfolio/${portfolio.id}`);
}

export async function updatePortfolio(
  prevState: PortfolioFormState,
  formData: FormData
): Promise<PortfolioFormState> {
  const userId = await requireUserId();

  const portfolioId = Number(formData.get("portfolioId"));
  const name = String(formData.get("name") ?? "").trim();
  const targetJobRole = String(formData.get("targetJobRole") ?? "").trim();
  const recordIds = readRecordIds(formData);

  if (!name || !targetJobRole) {
    return { status: "error", message: "이름과 목표 직무를 입력해주세요." };
  }
  if (recordIds.length === 0) {
    return { status: "error", message: "포함할 활동을 최소 1개 선택해주세요." };
  }

  const existing = await prisma.portfolio.findFirst({ where: { id: portfolioId, userId } });
  if (!existing) {
    return { status: "error", message: "포트폴리오를 찾을 수 없어요." };
  }
  if (!(await validateRecordIds(userId, recordIds))) {
    return { status: "error", message: "선택한 활동을 확인할 수 없어요. 다시 시도해주세요." };
  }

  await prisma.$transaction([
    prisma.portfolioRecord.deleteMany({ where: { portfolioId } }),
    prisma.portfolio.update({
      where: { id: portfolioId },
      data: {
        name,
        targetJobRole,
        records: { create: recordIds.map((recordId) => ({ recordId })) },
      },
    }),
  ]);

  redirect(`/portfolio/${portfolioId}`);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint lib/actions/portfolios.ts`
Expected: no errors.

- [ ] **Step 4: Confirm every export is async**

Inspect by hand: this file exports `createPortfolio` and `updatePortfolio`, both `async` — no other exports yet (Task 5 adds two more, both also `async`). Then confirm for real:

Run: `npx next build`
Expected: build succeeds, no "Server Actions must be async functions" error mentioning `lib/actions/portfolios.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/portfolios.ts
git commit -m "Add createPortfolio and updatePortfolio server actions"
```

---

## Task 5: Analysis + delete actions (`analyzePortfolio`, `deletePortfolio`)

**Files:**
- Modify: `lib/actions/portfolios.ts`

**Interfaces:**
- Consumes: `analyzeJobRoleRequirements` (`lib/analysis/analyzeJobRole.ts`, existing); `buildGapReport`, `type GapReport` (`lib/analysis/gapReport.ts`, existing); `recommendActivities`, `type RecommendationCandidateRow`, `type RecommendationItem` (Task 2); `portfolioEligibleWhere` (existing).
- Produces:
  - `type PortfolioFeedback = { summaryParagraph: string; gaps: GapReport["items"]; recommendations: RecommendationItem[] }` — the shape stored in `Portfolio.feedback` and read back on the detail page. Consumed by Task 8 and Task 10.
  - `async function analyzePortfolio(portfolioId: number): Promise<{ ok: true } | { ok: false; message: string }>` — ownership-checked, catches the LLM call's failure and returns it as a message rather than throwing. Consumed by Task 8.
  - `async function deletePortfolio(formData: FormData): Promise<void>` — matches `DeleteForm`'s `(formData: FormData) => Promise<void>` contract (`components/DeleteForm.tsx`, existing), reads `portfolioId` from `formData`. Consumed by Task 10.

- [ ] **Step 1: Add the imports and `analyzePortfolio`**

At the top of `lib/actions/portfolios.ts`, add to the existing imports:

```ts
import { revalidatePath } from "next/cache";
import { analyzeJobRoleRequirements } from "@/lib/analysis/analyzeJobRole";
import { buildGapReport, type GapReport } from "@/lib/analysis/gapReport";
import {
  recommendActivities,
  type RecommendationCandidateRow,
  type RecommendationItem,
} from "@/lib/analysis/recommendActivities";
```

Then append to the end of the file:

```ts
export type PortfolioFeedback = {
  summaryParagraph: string;
  gaps: GapReport["items"];
  recommendations: RecommendationItem[];
};

// Approach A (design spec): 역량 분석은 과목(Course) 단위로 그대로 재사용한다.
// 선택된 기록들이 속한 과목들로만 CourseCompetency를 좁혀서 buildGapReport에
// 넘기고, 추천은 "포트폴리오 밖 과목들" 중 부족한 역량 점수가 높은 과목을
// 순수 코드로 찾는다. 이 함수 안에서 새 LLM 호출은 analyzeJobRoleRequirements
// 단 하나뿐이다.
export async function analyzePortfolio(
  portfolioId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const userId = await requireUserId();

  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
    include: { records: { select: { recordId: true, record: { select: { courseId: true } } } } },
  });
  if (!portfolio) {
    return { ok: false, message: "포트폴리오를 찾을 수 없어요." };
  }

  const selectedCourseIds = [...new Set(portfolio.records.map((pr) => pr.record.courseId))];
  if (selectedCourseIds.length === 0) {
    return { ok: false, message: "선택된 활동이 없어서 분석할 수 없어요." };
  }

  const currentRows = await prisma.courseCompetency.findMany({
    where: { courseId: { in: selectedCourseIds } },
    include: {
      competency: { select: { key: true, name: true, category: true } },
      course: { select: { id: true } },
    },
  });

  try {
    const requirements = await analyzeJobRoleRequirements(portfolio.targetJobRole);
    const gapReport = buildGapReport(currentRows, requirements, portfolio.targetJobRole);

    const otherCourseRows: RecommendationCandidateRow[] = await prisma.courseCompetency.findMany({
      where: { course: { userId }, courseId: { notIn: selectedCourseIds } },
      select: {
        score: true,
        competency: { select: { key: true } },
        course: { select: { id: true, name: true } },
      },
    });

    const selectedRecordIds = new Set(portfolio.records.map((pr) => pr.recordId));
    const otherCourseIds = [...new Set(otherCourseRows.map((r) => r.course.id))];
    const eligibleOtherRecords = await prisma.record.findMany({
      where: { ...portfolioEligibleWhere(userId), courseId: { in: otherCourseIds } },
      select: { id: true, courseId: true },
    });

    const eligibleRecordsByCourse = new Map<number, number[]>();
    for (const record of eligibleOtherRecords) {
      if (selectedRecordIds.has(record.id)) continue;
      const list = eligibleRecordsByCourse.get(record.courseId) ?? [];
      list.push(record.id);
      eligibleRecordsByCourse.set(record.courseId, list);
    }

    const recommendations = recommendActivities(gapReport.items, otherCourseRows, eligibleRecordsByCourse);

    const feedback: PortfolioFeedback = {
      summaryParagraph: gapReport.summaryParagraph,
      gaps: gapReport.items,
      recommendations,
    };

    await prisma.portfolio.update({
      where: { id: portfolioId },
      data: { feedback, analyzedAt: new Date() },
    });

    revalidatePath(`/portfolio/${portfolioId}`);
    return { ok: true };
  } catch (error) {
    console.error(`analyzePortfolio: portfolio ${portfolioId} 분석 실패:`, error);
    return {
      ok: false,
      message: "분석 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.",
    };
  }
}

export async function deletePortfolio(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const portfolioId = Number(formData.get("portfolioId"));

  const portfolio = await prisma.portfolio.findFirst({ where: { id: portfolioId, userId } });
  if (!portfolio) return;

  await prisma.portfolio.delete({ where: { id: portfolioId } });
  redirect("/portfolio");
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Confirms `data: { feedback, analyzedAt: new Date() }` type-checks against the `Json?` column — same pattern already used for `Record.narrative` in `lib/actions/portfolio.ts`, no explicit `Prisma.InputJsonValue` cast needed.)

- [ ] **Step 3: Lint**

Run: `npx eslint lib/actions/portfolios.ts`
Expected: no errors.

- [ ] **Step 4: `next build`**

Run: `npx next build`
Expected: build succeeds, no error mentioning `lib/actions/portfolios.ts`. All four exports (`createPortfolio`, `updatePortfolio`, `analyzePortfolio`, `deletePortfolio`) are `async` — this file has no synchronous export, avoiding the bug class the portfolio narrative feature hit.

- [ ] **Step 5: Manual smoke check against the real API**

This calls the real Anthropic API (same call `analyzeJobRoleRequirements` already makes, already smoke-tested in the gap-analysis plan) — no isolated script is practical here since `analyzePortfolio` needs a real `Portfolio` row with `requireUserId()` satisfied. Defer full manual verification of this function to Task 8's browser walkthrough (once the detail page can trigger it via `PortfolioFeedbackPanel`). For now, just confirm the build passed (Step 4) and move on.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/portfolios.ts
git commit -m "Add analyzePortfolio and deletePortfolio server actions"
```

---

## Task 6: Record picker (`components/PortfolioRecordPicker.tsx`)

**Files:**
- Create: `components/PortfolioRecordPicker.tsx`

**Interfaces:**
- Consumes: `generatePendingNarratives` (Task 3); `Card`, `Badge`, `Button` (`components/ui/*`, existing).
- Produces:
  - `type PickerRecord = { id: number; content: string; hasNarrative: boolean }`
  - `type PickerCourse = { id: number; name: string; records: PickerRecord[] }`
  - `type PickerSemester = { id: number; name: string; courses: PickerCourse[] }`
  - `<PortfolioRecordPicker semesters initialSelectedIds? />` — renders checkboxes named `recordIds` (values are record IDs) inside whatever `<form>` the parent renders. Consumed by Task 7.

- [ ] **Step 1: Write the file**

```tsx
"use client";

import { useTransition } from "react";
import { generatePendingNarratives } from "@/lib/actions/portfolio";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

export type PickerRecord = { id: number; content: string; hasNarrative: boolean };
export type PickerCourse = { id: number; name: string; records: PickerRecord[] };
export type PickerSemester = { id: number; name: string; courses: PickerCourse[] };

// name="recordIds"인 체크박스만 렌더링한다 — 실제 <form>과 submit 버튼은
// 이 컴포넌트를 감싸는 부모(PortfolioForm)가 갖고 있다. narrative 생성
// 버튼은 별도 <form> 없이 서버 액션을 직접 호출한다 (같은 폼 안에 중첩된
// <form>을 넣을 수 없어서).
export default function PortfolioRecordPicker({
  semesters,
  initialSelectedIds = [],
}: {
  semesters: PickerSemester[];
  initialSelectedIds?: number[];
}) {
  const [pending, startTransition] = useTransition();
  const selected = new Set(initialSelectedIds);

  return (
    <div className="space-y-4">
      {semesters.map((semester) => (
        <div key={semester.id}>
          <p className="mb-2 text-sm font-semibold text-ink-secondary">{semester.name}</p>
          <div className="space-y-3">
            {semester.courses.map((course) => (
              <Card key={course.id}>
                <p className="mb-2 font-semibold">{course.name}</p>
                <ul className="space-y-2">
                  {course.records.map((record) => (
                    <li key={record.id} className="flex items-start justify-between gap-3">
                      <label className="flex flex-1 items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="recordIds"
                          value={record.id}
                          defaultChecked={selected.has(record.id)}
                          className="mt-0.5"
                        />
                        <span className="line-clamp-2">{record.content}</span>
                      </label>
                      {record.hasNarrative ? (
                        <Badge>작성됨</Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              await generatePendingNarratives([record.id]);
                            })
                          }
                        >
                          {pending ? "생성 중..." : "생성 필요"}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint components/PortfolioRecordPicker.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/PortfolioRecordPicker.tsx
git commit -m "Add PortfolioRecordPicker client component"
```

(No standalone manual verification — not reachable from any route until Task 9 wires it in via `PortfolioForm`.)

---

## Task 7: Shared form wrapper (`components/PortfolioForm.tsx`)

**Files:**
- Create: `components/PortfolioForm.tsx`

**Interfaces:**
- Consumes: `PortfolioRecordPicker`, `type PickerSemester` (Task 6); `PortfolioFormState` (Task 4); `Card`, `Button` (`components/ui/*`, existing).
- Produces: `<PortfolioForm action initialName? initialJobRole? hiddenFields? semesters initialSelectedIds? submitLabel />` — a single component reused by both the create page (Task 9, bound to `createPortfolio`) and the edit page (Task 11, bound to `updatePortfolio` with a hidden `portfolioId` field).

- [ ] **Step 1: Write the file**

```tsx
"use client";

import { useActionState } from "react";
import PortfolioRecordPicker, { type PickerSemester } from "@/components/PortfolioRecordPicker";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { PortfolioFormState } from "@/lib/actions/portfolios";

const INITIAL_STATE: PortfolioFormState = { status: "idle" };

export default function PortfolioForm({
  action,
  initialName = "",
  initialJobRole = "",
  hiddenFields = {},
  semesters,
  initialSelectedIds = [],
  submitLabel,
}: {
  action: (prevState: PortfolioFormState, formData: FormData) => Promise<PortfolioFormState>;
  initialName?: string;
  initialJobRole?: string;
  hiddenFields?: Record<string, string | number>;
  semesters: PickerSemester[];
  initialSelectedIds?: number[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      {Object.entries(hiddenFields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}

      <Card>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">이름</label>
            <input
              name="name"
              required
              defaultValue={initialName}
              placeholder="예: 백엔드 개발자용 포트폴리오"
              className="w-full rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">목표 직무</label>
            <input
              name="targetJobRole"
              required
              defaultValue={initialJobRole}
              placeholder="예: 백엔드 개발자"
              className="w-full rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>
      </Card>

      <PortfolioRecordPicker semesters={semesters} initialSelectedIds={initialSelectedIds} />

      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "저장 중..." : submitLabel}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint components/PortfolioForm.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/PortfolioForm.tsx
git commit -m "Add shared PortfolioForm component for create and edit flows"
```

---

## Task 8: Feedback panel (`components/PortfolioFeedbackPanel.tsx`)

**Files:**
- Create: `components/PortfolioFeedbackPanel.tsx`

**Interfaces:**
- Consumes: `analyzePortfolio`, `type PortfolioFeedback` (Task 5); `Card`, `Badge`, `Button` (`components/ui/*`, existing).
- Produces: `<PortfolioFeedbackPanel portfolioId feedback analyzedAt />`. Consumed by Task 10.

- [ ] **Step 1: Write the file**

```tsx
"use client";

import { useState, useTransition } from "react";
import { analyzePortfolio, type PortfolioFeedback } from "@/lib/actions/portfolios";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

function formatAnalyzedAt(date: Date | null): string {
  if (!date) return "아직 분석 전";
  return `마지막 분석: ${new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)}`;
}

export default function PortfolioFeedbackPanel({
  portfolioId,
  feedback,
  analyzedAt,
}: {
  portfolioId: number;
  feedback: PortfolioFeedback | null;
  analyzedAt: Date | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAnalyze() {
    setError(null);
    startTransition(async () => {
      const result = await analyzePortfolio(portfolioId);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <Card className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-secondary">{formatAnalyzedAt(analyzedAt)}</p>
        <Button size="sm" variant="secondary" disabled={pending} onClick={handleAnalyze}>
          {pending ? "분석 중..." : analyzedAt ? "다시 분석" : "분석하기"}
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {feedback && (
        <div className="space-y-4">
          <p className="leading-relaxed text-ink-secondary">{feedback.summaryParagraph}</p>

          {feedback.gaps.length > 0 && (
            <ul className="space-y-3">
              {feedback.gaps.map((item) => (
                <Card as="li" key={item.key} padded={false} className="p-4">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <h3 className="font-semibold">{item.name}</h3>
                    <Badge>{item.category}</Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-ink-secondary">{item.message}</p>
                </Card>
              ))}
            </ul>
          )}

          {feedback.recommendations.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">이런 활동을 추가해보세요</p>
              <ul className="space-y-2">
                {feedback.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-ink-secondary">
                    <span className="font-medium text-foreground">{rec.courseName}</span>
                    {" — "}
                    {rec.competencyName} 관련 활동이 있어요
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint components/PortfolioFeedbackPanel.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/PortfolioFeedbackPanel.tsx
git commit -m "Add PortfolioFeedbackPanel component"
```

---

## Task 9: Shared picker data + create page (`app/portfolio/new/page.tsx`)

**Files:**
- Create: `lib/portfolio/pickerData.ts`
- Create: `app/portfolio/new/page.tsx`

**Interfaces:**
- Consumes: `portfolioEligibleWhere` (`lib/portfolio/queries.ts`, existing); `type PickerSemester` (Task 6); `PortfolioForm` (Task 7); `createPortfolio` (Task 4).
- Produces: `async function buildPickerSemesters(userId: string): Promise<PickerSemester[]>` — grouped, pre-filtered (only semesters/courses with at least one pickable record) data for the picker. Consumed by Task 11.

- [ ] **Step 1: Write `lib/portfolio/pickerData.ts`**

```ts
import { prisma } from "@/lib/db/client";
import { portfolioEligibleWhere } from "@/lib/portfolio/queries";
import type { PickerSemester } from "@/components/PortfolioRecordPicker";

// PortfolioRecordPicker에 넘길 데이터를 만든다. "포트폴리오 대상"이 될 수
// 있는 기록이 하나도 없는 과목/학기는 아예 빼서, 고를 게 없는 빈 카드가
// 뜨지 않게 한다.
export async function buildPickerSemesters(userId: string): Promise<PickerSemester[]> {
  const semesters = await prisma.semester.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      courses: {
        orderBy: { createdAt: "asc" },
        include: {
          records: {
            where: portfolioEligibleWhere(userId),
            orderBy: { createdAt: "desc" },
            select: { id: true, content: true, narrative: true },
          },
        },
      },
    },
  });

  return semesters
    .map((s) => ({
      id: s.id,
      name: s.name,
      courses: s.courses
        .filter((c) => c.records.length > 0)
        .map((c) => ({
          id: c.id,
          name: c.name,
          records: c.records.map((r) => ({
            id: r.id,
            content: r.content,
            hasNarrative: r.narrative !== null,
          })),
        })),
    }))
    .filter((s) => s.courses.length > 0);
}
```

- [ ] **Step 2: Write `app/portfolio/new/page.tsx`**

```tsx
import Link from "next/link";
import { requireUserId } from "@/lib/auth/session";
import { buildPickerSemesters } from "@/lib/portfolio/pickerData";
import { createPortfolio } from "@/lib/actions/portfolios";
import PortfolioForm from "@/components/PortfolioForm";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function NewPortfolioPage() {
  const userId = await requireUserId();
  const semesters = await buildPickerSemesters(userId);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader title="새 포트폴리오 만들기" backHref="/portfolio" backLabel="포트폴리오 목록" />

      {semesters.length === 0 ? (
        <EmptyState
          message="아직 포트폴리오에 담을 수 있는 활동이 없어요. 과목 상세 페이지에서 기록의 '포트폴리오용 상세 입력'을 채워주세요."
          action={
            <Link href="/semesters">
              <Button variant="secondary" size="sm">
                학기 리스트로 가기
              </Button>
            </Link>
          }
        />
      ) : (
        <PortfolioForm action={createPortfolio} semesters={semesters} submitLabel="만들기" />
      )}
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npx eslint lib/portfolio/pickerData.ts app/portfolio/new/page.tsx`
Expected: no errors.

- [ ] **Step 5: `next build`**

Run: `npx next build`
Expected: build succeeds; `/portfolio/new` appears as a dynamic (`ƒ`) route.

- [ ] **Step 6: Commit**

```bash
git add lib/portfolio/pickerData.ts app/portfolio/new/page.tsx
git commit -m "Add portfolio picker data helper and /portfolio/new page"
```

(Full manual verification — submitting the form and landing somewhere real — is deferred to Task 10, since `/portfolio/[id]` doesn't exist until then and `createPortfolio`'s `redirect()` would currently 404.)

---

## Task 10: Detail page (`app/portfolio/[id]/page.tsx`)

**Files:**
- Create: `app/portfolio/[id]/page.tsx`

**Interfaces:**
- Consumes: `deletePortfolio`, `type PortfolioFeedback` (Task 5); `PortfolioFeedbackPanel` (Task 8); `NARRATIVE_SECTION_LABELS`, `type RecordNarrative` (`lib/analysis/generateNarrative.ts`, existing); `DeleteForm` (`components/DeleteForm.tsx`, existing).
- Produces: the `/portfolio/[id]` route.

- [ ] **Step 1: Write the file**

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { NARRATIVE_SECTION_LABELS, type RecordNarrative } from "@/lib/analysis/generateNarrative";
import { deletePortfolio, type PortfolioFeedback } from "@/lib/actions/portfolios";
import PortfolioFeedbackPanel from "@/components/PortfolioFeedbackPanel";
import DeleteForm from "@/components/DeleteForm";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const portfolioId = Number(id);
  const userId = await requireUserId();

  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
    include: {
      records: {
        include: { record: { include: { course: { select: { name: true } } } } },
      },
    },
  });

  if (!portfolio) notFound();

  const feedback = portfolio.feedback as unknown as PortfolioFeedback | null;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title={portfolio.name}
        subtitle={portfolio.targetJobRole}
        backHref="/portfolio"
        backLabel="포트폴리오 목록"
        action={
          <div className="flex items-center gap-2">
            <Link href={`/portfolio/${portfolio.id}/edit`}>
              <Button variant="secondary" size="sm">
                수정
              </Button>
            </Link>
            <a href={`/portfolio/${portfolio.id}/pdf`}>
              <Button variant="secondary" size="sm">
                PDF 다운로드
              </Button>
            </a>
            <DeleteForm
              action={deletePortfolio}
              hiddenFields={{ portfolioId: portfolio.id }}
              confirmMessage="이 포트폴리오를 삭제할까요?"
            />
          </div>
        }
      />

      <PortfolioFeedbackPanel portfolioId={portfolio.id} feedback={feedback} analyzedAt={portfolio.analyzedAt} />

      {portfolio.records.length === 0 ? (
        <EmptyState message="선택된 활동이 모두 삭제됐어요. 수정에서 활동을 다시 골라주세요." />
      ) : (
        <ul className="space-y-4">
          {portfolio.records.map(({ record }) => {
            const narrative = record.narrative as unknown as RecordNarrative | null;
            return (
              <Card as="li" key={record.id}>
                <h2 className="mb-3 font-semibold">{record.course.name}</h2>
                {narrative ? (
                  <div className="space-y-3">
                    {NARRATIVE_SECTION_LABELS.map(({ key, label }) => (
                      <div key={key}>
                        <p className="text-xs text-ink-secondary">{label}</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{narrative[key]}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted">아직 이야기로 만들지 않았어요. 수정에서 생성할 수 있어요.</p>
                )}
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

Run: `npx eslint app/portfolio/\[id\]/page.tsx`
Expected: no errors.

- [ ] **Step 4: `next build`**

Run: `npx next build`
Expected: build succeeds; `/portfolio/[id]` appears as a dynamic route.

- [ ] **Step 5: Manual verification via dev server**

A dev server may already be running on port 3000 — reuse it if so; otherwise `npm run dev`. In a real browser (this Codespace's forwarded `*.app.github.dev` URL, per `project-plannit-turnstile-codespaces` memory):

1. Visit `/portfolio/new`, fill in name + job role, select at least one record across two different courses, submit. Confirm it redirects to `/portfolio/[id]` and the page renders the header, an "분석하기" button (no `analyzedAt` yet), and the selected records' narratives (or the "아직 이야기로 만들지 않았어요" placeholder for ones without narrative yet).
2. Click "분석하기". Confirm the button shows "분석 중..." and is disabled while pending, then a summary paragraph appears, plus gap cards if applicable (Korean text, no `undefined`).
3. Click "삭제", confirm the browser's confirm dialog appears; confirming it redirects to `/portfolio` and the portfolio is gone.

Expected: no server errors in the terminal running the dev server.

- [ ] **Step 6: Commit**

```bash
git add "app/portfolio/[id]/page.tsx"
git commit -m "Add portfolio detail page"
```

---

## Task 11: Edit page (`app/portfolio/[id]/edit/page.tsx`)

**Files:**
- Create: `app/portfolio/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `buildPickerSemesters` (Task 9); `updatePortfolio` (Task 4); `PortfolioForm` (Task 7).
- Produces: the `/portfolio/[id]/edit` route.

- [ ] **Step 1: Write the file**

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { buildPickerSemesters } from "@/lib/portfolio/pickerData";
import { updatePortfolio } from "@/lib/actions/portfolios";
import PortfolioForm from "@/components/PortfolioForm";
import PageHeader from "@/components/ui/PageHeader";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function EditPortfolioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const portfolioId = Number(id);
  const userId = await requireUserId();

  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
    include: { records: { select: { recordId: true } } },
  });
  if (!portfolio) notFound();

  const semesters = await buildPickerSemesters(userId);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title="포트폴리오 수정"
        backHref={`/portfolio/${portfolio.id}`}
        backLabel="포트폴리오로 돌아가기"
      />
      <PortfolioForm
        action={updatePortfolio}
        initialName={portfolio.name}
        initialJobRole={portfolio.targetJobRole}
        hiddenFields={{ portfolioId: portfolio.id }}
        semesters={semesters}
        initialSelectedIds={portfolio.records.map((r) => r.recordId)}
        submitLabel="저장"
      />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint app/portfolio/\[id\]/edit/page.tsx`
Expected: no errors.

- [ ] **Step 4: `next build`**

Run: `npx next build`
Expected: build succeeds; `/portfolio/[id]/edit` appears as a dynamic route.

- [ ] **Step 5: Manual verification via dev server**

1. From a portfolio's detail page (`/portfolio/[id]`), click "수정". Confirm the form pre-fills the existing name, job role, and checked records.
2. Uncheck one record, add another, change the job role text, save. Confirm it redirects back to `/portfolio/[id]` and the record list reflects the new selection.
3. Confirm the feedback panel still shows the *previous* analysis snapshot (stale, unchanged) until "다시 분석" is clicked — this is expected per the spec, not a bug.
4. Submit with zero records checked — confirm it shows the "포함할 활동을 최소 1개 선택해주세요" error and does not save.

- [ ] **Step 6: Commit**

```bash
git add "app/portfolio/[id]/edit/page.tsx"
git commit -m "Add portfolio edit page"
```

---

## Task 12: Scoped PDF export (`app/portfolio/[id]/pdf/route.tsx`)

**Files:**
- Create: `app/portfolio/[id]/pdf/route.tsx`

**Interfaces:**
- Consumes: `NARRATIVE_SECTION_LABELS`, `type RecordNarrative` (`lib/analysis/generateNarrative.ts`, existing).
- Produces: the `/portfolio/[id]/pdf` route (`GET`).

- [ ] **Step 1: Write the file**

```tsx
import { NextResponse } from "next/server";
import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const portfolioId = Number(id);
  const userId = await requireUserId();

  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
    include: {
      records: {
        include: { record: { include: { course: { select: { name: true } } } } },
      },
    },
  });

  if (!portfolio) {
    return NextResponse.json({ error: "포트폴리오를 찾을 수 없습니다." }, { status: 404 });
  }

  const generated = portfolio.records.map((pr) => pr.record).filter((r) => r.narrative !== null);

  if (generated.length === 0) {
    return NextResponse.json({ error: "생성된 포트폴리오 내용이 없습니다." }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    <Document>
      {generated.map((r) => {
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

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="plannit-portfolio.pdf"',
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint app/portfolio/\[id\]/pdf/route.tsx`
Expected: no errors.

- [ ] **Step 4: `next build`**

Run: `npx next build`
Expected: build succeeds; `/portfolio/[id]/pdf` appears as a dynamic route.

- [ ] **Step 5: Manual verification via dev server**

From a portfolio's detail page with at least one record that has a generated narrative, click "PDF 다운로드". Confirm a PDF downloads, opens, shows Korean text correctly (not garbled/missing glyphs), and contains **only** this portfolio's selected + generated records — not every record on the account (create or use a second portfolio with a different selection to confirm the scoping, if convenient).

- [ ] **Step 6: Commit**

```bash
git add "app/portfolio/[id]/pdf/route.tsx"
git commit -m "Add scoped PDF export for a single portfolio"
```

---

## Task 13: Rewrite the list page (`app/portfolio/page.tsx`)

**Files:**
- Modify: `app/portfolio/page.tsx`

**Interfaces:**
- Produces: the rewritten `/portfolio` route — list of the user's saved portfolios, replacing the old all-records view.

- [ ] **Step 1: Replace the file's contents**

```tsx
import Link from "next/link";
import { BookOpen, Target } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function PortfolioListPage() {
  const userId = await requireUserId();

  // 콜드 스타트 게이트: 옛 /gap-analysis와 동일한 기준(역량 분석된 과목 2개
  // 미만이면 아예 시작을 막는다) — 근거가 거의 없는 상태에서 만든 포트폴리오는
  // 갭 분석 결과도 사실상 노이즈이기 때문.
  const eligibleCourses = await prisma.courseCompetency.findMany({
    where: { course: { userId } },
    select: { courseId: true },
    distinct: ["courseId"],
  });

  if (eligibleCourses.length < 2) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <PageHeader title="포트폴리오" backHref="/semesters" backLabel="학기 리스트" />
        <EmptyState
          icon={<Target className="size-5" />}
          message="아직 분석할 기록이 부족해요. 과목을 2개 이상 등록하면 포트폴리오를 만들 수 있어요."
          action={
            <Link href="/semesters">
              <Button variant="secondary" size="sm">
                과목 추가하러 가기
              </Button>
            </Link>
          }
        />
      </main>
    );
  }

  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title="포트폴리오"
        backHref="/semesters"
        backLabel="학기 리스트"
        action={
          <Link href="/portfolio/new">
            <Button size="sm">새 포트폴리오 만들기</Button>
          </Link>
        }
      />

      {portfolios.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-5" />}
          message="아직 만든 포트폴리오가 없어요. 목표 직무를 정하고 활동을 골라 첫 포트폴리오를 만들어보세요."
        />
      ) : (
        <ul className="space-y-3">
          {portfolios.map((p) => (
            <li key={p.id}>
              <Link href={`/portfolio/${p.id}`}>
                <Card className="transition-colors hover:border-line-strong">
                  <p className="text-lg font-semibold">{p.name}</p>
                  <p className="text-sm text-ink-secondary">{p.targetJobRole}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {p.analyzedAt
                      ? `마지막 분석: ${new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(p.analyzedAt)}`
                      : "아직 분석 전"}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
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

- [ ] **Step 4: `next build`**

Run: `npx next build`
Expected: build succeeds.

- [ ] **Step 5: Manual verification via dev server — full click-through**

This is the first point where the whole flow exists end to end. In the browser:

1. As a user account with fewer than 2 competency-scored courses: visit `/portfolio`, confirm the cold-start empty state renders (same message/link as the old `/gap-analysis` used to show).
2. As a user with 2+ such courses and zero saved portfolios: confirm the "아직 만든 포트폴리오가 없어요" empty state + "새 포트폴리오 만들기" button.
3. Create a portfolio (as in Task 10's walkthrough), confirm it now appears as a card on `/portfolio` with its name, job role, and "마지막 분석" status.
4. Click into it, edit it, delete it — confirm each round-trips back to `/portfolio` correctly and the list reflects the change.

Expected: no server errors in the terminal running the dev server.

- [ ] **Step 6: Commit**

```bash
git add app/portfolio/page.tsx
git commit -m "Rewrite /portfolio as a list of saved job-targeted portfolios"
```

---

## Task 14: Remove superseded surfaces + update nav

**Files:**
- Delete: `app/gap-analysis/` (entire directory), `components/GapAnalysisForm.tsx`, `lib/actions/gapAnalysis.ts`, `components/GeneratePortfolioForm.tsx`, `app/portfolio/pdf/route.tsx`
- Modify: `lib/actions/portfolio.ts` (tighten `generatePendingNarratives`'s parameter now that its only caller always passes one)
- Modify: `app/semesters/page.tsx`

**Interfaces:**
- Produces: nothing new — this is cleanup. `generatePendingNarratives`'s signature becomes `(recordIds: number[]): Promise<void>` (required, since `GeneratePortfolioForm.tsx` — the only zero-arg caller — is deleted in this task).

- [ ] **Step 1: Delete the superseded files**

```bash
git rm -r app/gap-analysis
git rm components/GapAnalysisForm.tsx
git rm lib/actions/gapAnalysis.ts
git rm components/GeneratePortfolioForm.tsx
git rm app/portfolio/pdf/route.tsx
```

- [ ] **Step 2: Tighten `generatePendingNarratives`'s parameter**

In `lib/actions/portfolio.ts`, change:

```ts
export async function generatePendingNarratives(recordIds?: number[]): Promise<void> {
  const userId = await requireUserId();

  const pending = await prisma.record.findMany({
    where: recordIds
      ? { ...portfolioPendingWhere(userId), id: { in: recordIds } }
      : portfolioPendingWhere(userId),
    take: 5,
  });
```

to:

```ts
export async function generatePendingNarratives(recordIds: number[]): Promise<void> {
  const userId = await requireUserId();

  const pending = await prisma.record.findMany({
    where: { ...portfolioPendingWhere(userId), id: { in: recordIds } },
    take: 5,
  });
```

- [ ] **Step 3: Update the `/semesters` nav row**

In `app/semesters/page.tsx`, change the import:

```tsx
import { GraduationCap, Sparkles, BookOpen, Target } from "lucide-react";
```

to:

```tsx
import { GraduationCap, Sparkles, BookOpen } from "lucide-react";
```

And remove the third button, leaving just the two:

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

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors — confirms nothing still imports any of the deleted files.

- [ ] **Step 5: Lint**

Run: `npx eslint lib/actions/portfolio.ts app/semesters/page.tsx`
Expected: no errors.

- [ ] **Step 6: `next build` — full project build**

Run: `npx next build`
Expected: build succeeds. Route list no longer includes `/gap-analysis` or `/portfolio/pdf`; includes `/portfolio`, `/portfolio/new`, `/portfolio/[id]`, `/portfolio/[id]/edit`, `/portfolio/[id]/pdf`.

- [ ] **Step 7: Manual verification via dev server**

Visit `/semesters`, confirm only two nav buttons render ("강점 리포트", "포트폴리오") and there's no dangling link anywhere in the app to `/gap-analysis`. Visit `/gap-analysis` directly — confirm it 404s.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Remove gap-analysis and old all-records portfolio surfaces"
```

---

## After all tasks: report back, don't silently finish

This plan is implemented once Tasks 1-14 are all checked off and verified.
Whoever finishes this plan should say explicitly, in their final report:
"The job-targeted portfolio feature is now implemented, replacing both
`/gap-analysis` and the old all-records `/portfolio`. The
`project-plannit-overview` memory should be updated to reflect this —
including that priority #2 from the 2026-08-20 product review (AI
draft-prefill for the portfolio's 6 detail fields) is still separate,
still unbuilt, and now the next open item." This is outside the repo (a
memory-file update in the coordinating session), so it can't be a plan
task, but it must not be dropped.
