# Job-Role Gap Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user type a target job role and get category-level feedback on which of their existing 12 competency categories fall short of what that role typically needs — computed fresh per request, never persisted.

**Architecture:** One new LLM call rates the 12 fixed competency categories' importance for a free-text job role (mirrors `analyzeCourse.ts`'s pattern, structured-output-only, no free-text fields). A pure function compares that against the user's already-computed `CourseCompetency` data (normalized onto the same 1-5 scale) and produces template-generated Korean feedback — no second LLM call for the comparison. A Server Action orchestrates both and returns ephemeral state to a client component via React's `useActionState`, so results render without a database write or a page reload losing the input.

**Tech Stack:** Next.js 16 (App Router, Cache Components), Prisma 7 (Postgres, read-only for this feature), `ai` SDK v6 + `@ai-sdk/anthropic` (direct Anthropic billing, not AI Gateway), React 19's `useActionState`.

**Spec:** `docs/superpowers/specs/2026-08-20-job-gap-analysis-design.md`

## Global Constraints

- No new Prisma models or migrations — this feature only reads `CourseCompetency` and calls an LLM; nothing is written to the database.
- The required-profile LLM call uses `anthropic("claude-haiku-4-5-20251001")` — the exact model string already used in `lib/analysis/analyzeCourse.ts` — not Sonnet (this is structured 12-way classification, not prose) and not AI Gateway (this project calls Anthropic directly everywhere).
- The LLM output schema has no free-text field beyond the fixed competency key and a 1-5 integer — no "reason," no "recommended companies/postings." This is a hard requirement, not a style preference: it's what makes hallucinated specifics structurally impossible.
- Gap comparison and feedback-sentence generation are pure code (template strings, like `lib/analysis/report.ts`'s `buildCompetencyReport`) — never a second LLM call.
- Results are never persisted. No caching, no history.
- The required-profile LLM call only fires on explicit form submission — never on page load, never automatically (same principle as `generatePendingNarratives` in the portfolio feature).
- Cold-start gate: if the user has `CourseCompetency` rows for fewer than 2 distinct courses, the page shows an empty state instead of the form — no analysis is offered at all.
- This repo has no automated test framework. Verification is `tsc --noEmit` + `eslint` + `next build` (the portfolio feature's final review caught a build-breaking bug — a synchronous export in a `"use server"` file — that `tsc`/`eslint` alone missed; `next build` is mandatory verification for any task touching a `"use server"` file or a new route) + manual exercise via a real browser session.
- Follow existing patterns: Server Actions in `lib/actions/*.ts` with `"use server"` at the top; page components use `requireUserId()` first and `export const instant = false` (see `app/report/page.tsx`, `app/portfolio/page.tsx`); UI built from the existing `components/ui/*` primitives (`Card`, `Badge`, `Button`, `PageHeader`, `EmptyState`) — no new UI primitives.

---

## File Structure

- `lib/analysis/analyzeCourse.ts` (modify) — export the existing `COMPETENCY_KEYS` const so it can be reused instead of re-derived.
- `lib/analysis/analyzeJobRole.ts` (new) — the LLM call rating competency importance for a job role.
- `lib/analysis/gapReport.ts` (new) — pure comparison + template feedback generation.
- `lib/actions/gapAnalysis.ts` (new) — Server Action orchestrating the above two, `useActionState`-compatible.
- `components/GapAnalysisForm.tsx` (new) — client component driving the action and rendering results.
- `app/gap-analysis/page.tsx` (new) — page with the cold-start gate.
- `app/semesters/page.tsx` (modify) — add a third nav button.

---

## Task 1: Job-role competency requirement LLM call

**Files:**
- Modify: `lib/analysis/analyzeCourse.ts`
- Create: `lib/analysis/analyzeJobRole.ts`

**Interfaces:**
- Consumes: `COMPETENCY_DICTIONARY` from `lib/analysis/keywordDictionary.ts` (already exists — 12 entries, each `{ key, name, category, keywords }`).
- Produces:
  - `analyzeCourse.ts` now exports `COMPETENCY_KEYS: [string, ...string[]]` (was previously an unexported local `const` — same value, just visible now).
  - `type JobRoleCompetencyRequirement = { competencyKey: string; importance: number }` (`importance` is 1-5).
  - `async function analyzeJobRoleRequirements(jobRole: string): Promise<JobRoleCompetencyRequirement[]>` — throws on failure (network/API error); does not catch internally. Consumed by Task 3.

- [ ] **Step 1: Export `COMPETENCY_KEYS` from `analyzeCourse.ts`**

In `lib/analysis/analyzeCourse.ts`, change:

```ts
const COMPETENCY_KEYS = COMPETENCY_DICTIONARY.map((c) => c.key) as [
  string,
  ...string[],
];
```

to:

```ts
export const COMPETENCY_KEYS = COMPETENCY_DICTIONARY.map((c) => c.key) as [
  string,
  ...string[],
];
```

That is the only change to this file — everything else in it stays as-is.

- [ ] **Step 2: Write `lib/analysis/analyzeJobRole.ts`**

```ts
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { COMPETENCY_DICTIONARY } from "./keywordDictionary";
import { COMPETENCY_KEYS } from "./analyzeCourse";

export type JobRoleCompetencyRequirement = {
  competencyKey: string;
  importance: number;
};

const REQUIREMENT_SCHEMA = z.object({
  requirements: z
    .array(
      z.object({
        competencyKey: z.enum(COMPETENCY_KEYS),
        importance: z.number().int().min(1).max(5),
      })
    )
    .length(COMPETENCY_DICTIONARY.length),
});

function buildPrompt(jobRole: string): string {
  const dictionaryList = COMPETENCY_DICTIONARY.map(
    (c) => `- ${c.key} (${c.name}, ${c.category})`
  ).join("\n");

  return `아래는 한 대학생이 입사를 목표로 하는 직무다. 이 직무에서 일반적으로
얼마나 중요하게 여겨지는 역량인지를, 아래 역량 목록 12개 각각에 대해 평가하라.

직무: ${jobRole}

역량 목록:
${dictionaryList}

규칙:
- 특정 회사나 채용 공고를 참고하지 말고, 이 직무가 일반적으로 요구하는 역량이
  무엇인지 일반적인 직무 지식을 바탕으로 판단할 것.
- importance는 1~5 사이 정수로, 그 역량이 이 직무에서 얼마나 중요한지를 나타냄.
  전혀 관련 없으면 1, 핵심 역량이면 5.
- 위 12개 역량 전부에 대해 각각 하나씩 평가할 것 (일부만 고르거나 생략하지 말 것).`;
}

// 직무명(자유 텍스트)에 대해 12개 고정 역량 각각의 중요도를 LLM으로 판단한다.
// 실제 채용 공고나 회사를 참고하지 않고 일반적인 직무 지식으로만 판단하며,
// 스키마에 자유 텍스트 필드가 없어 구체적 사실을 지어낼 수 있는 여지가 없다.
export async function analyzeJobRoleRequirements(
  jobRole: string
): Promise<JobRoleCompetencyRequirement[]> {
  const { output } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    output: Output.object({ schema: REQUIREMENT_SCHEMA }),
    prompt: buildPrompt(jobRole),
  });

  return output.requirements;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint lib/analysis/analyzeCourse.ts lib/analysis/analyzeJobRole.ts`
Expected: no errors.

- [ ] **Step 4: Manual smoke check against the real API**

There's no test/mock infra in this repo for LLM calls (same as `analyzeCourse.ts`/`generateNarrative.ts` have none). Create a throwaway script, run it, then delete it (do not commit it):

```bash
cat > /tmp/smoke-jobrole.ts <<'EOF'
import { analyzeJobRoleRequirements } from "../workspaces/codespaces-blank/lib/analysis/analyzeJobRole";

analyzeJobRoleRequirements("백엔드 개발자").then((r) => {
  console.log(JSON.stringify(r, null, 2));
  console.log("count:", r.length);
});
EOF
npx tsx /tmp/smoke-jobrole.ts
rm /tmp/smoke-jobrole.ts
```

Expected: prints an array of 12 objects, each with `competencyKey` (one of the 12 dictionary keys) and `importance` (integer 1-5). For "백엔드 개발자" specifically, expect `programming` and `logical-thinking` to score relatively high (4-5) and something like `language`/`presentation` to score lower — if the results look inverted or nonsensical, the prompt likely needs adjustment before moving on. `count: 12` must hold (the `.length(12)` schema constraint enforces this at the API level — if it ever fails, the call throws before you see output, so a thrown error here IS a real signal, not a smoke-test artifact to ignore).

- [ ] **Step 5: Commit**

```bash
git add lib/analysis/analyzeCourse.ts lib/analysis/analyzeJobRole.ts
git commit -m "Add LLM job-role competency requirement analysis"
```

---

## Task 2: Gap comparison + template feedback (`lib/analysis/gapReport.ts`)

**Files:**
- Create: `lib/analysis/gapReport.ts`

**Interfaces:**
- Consumes: `JobRoleCompetencyRequirement` from Task 1 (`lib/analysis/analyzeJobRole.ts`); `COMPETENCY_DICTIONARY` from `lib/analysis/keywordDictionary.ts`.
- Produces:
  - `type GapItem = { key: string; name: string; category: string; importance: number; currentStrength: number; message: string }`
  - `type GapReport = { jobRole: string; items: GapItem[]; summaryParagraph: string }`
  - `type CurrentCompetencyRow = { score: number; competency: { key: string; name: string; category: string | null }; course: { id: number } }` — the shape Task 3's Prisma query must produce.
  - `function buildGapReport(currentRows: CurrentCompetencyRow[], requirements: JobRoleCompetencyRequirement[], jobRole: string): GapReport` — pure, synchronous, no I/O. Consumed by Task 3.

- [ ] **Step 1: Write the file**

```ts
import { COMPETENCY_DICTIONARY } from "./keywordDictionary";
import type { JobRoleCompetencyRequirement } from "./analyzeJobRole";

export type GapItem = {
  key: string;
  name: string;
  category: string;
  importance: number;
  currentStrength: number;
  message: string;
};

export type GapReport = {
  jobRole: string;
  items: GapItem[];
  summaryParagraph: string;
};

export type CurrentCompetencyRow = {
  score: number;
  competency: { key: string; name: string; category: string | null };
  course: { id: number };
};

function joinKoreanList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]}, ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} 그리고 ${items[items.length - 1]}`;
}

function buildGapMessage(name: string, currentStrength: number): string {
  if (currentStrength === 0) {
    return `${name} 관련 경험이 아직 기록에 없어요. 이 역량이 이 직무에서 중요하게 여겨지는 만큼, 관련 활동을 기록해보면 좋아요.`;
  }
  return `${name} 역량이 기록에 드러나긴 하지만, 이 직무가 요구하는 수준에는 아직 못 미쳐요. 관련 경험을 조금 더 쌓아보면 좋아요.`;
}

// CourseCompetency의 원점수(과목당 1~5)를 그대로 합산하면 과목 수가 많은
// 사용자일수록 무조건 유리해진다. "그 역량이 등장했을 때 평균적으로 얼마나
// 강하게 나타나는가"로 정규화해서, LLM이 매기는 직무 요구도(1~5)와 같은
// 척도로 비교할 수 있게 만든다. 한 번도 안 나온 역량은 0.
function computeCurrentStrength(
  currentRows: CurrentCompetencyRow[]
): Map<string, number> {
  const totals = new Map<string, { sum: number; courseIds: Set<number> }>();

  for (const row of currentRows) {
    const key = row.competency.key;
    const existing = totals.get(key);
    if (existing) {
      existing.sum += row.score;
      existing.courseIds.add(row.course.id);
    } else {
      totals.set(key, { sum: row.score, courseIds: new Set([row.course.id]) });
    }
  }

  const strength = new Map<string, number>();
  for (const [key, { sum, courseIds }] of totals) {
    strength.set(key, sum / courseIds.size);
  }
  return strength;
}

const MIN_IMPORTANCE_TO_FLAG = 3;
const MAX_GAP_ITEMS = 5;

export function buildGapReport(
  currentRows: CurrentCompetencyRow[],
  requirements: JobRoleCompetencyRequirement[],
  jobRole: string
): GapReport {
  const currentStrength = computeCurrentStrength(currentRows);
  const dictionaryByKey = new Map(
    COMPETENCY_DICTIONARY.map((c) => [c.key, c])
  );

  const candidates = requirements
    .map((req) => {
      const dict = dictionaryByKey.get(req.competencyKey);
      if (!dict) return null;
      const strength = currentStrength.get(req.competencyKey) ?? 0;
      return {
        key: req.competencyKey,
        name: dict.name,
        category: dict.category ?? "기타",
        importance: req.importance,
        currentStrength: strength,
        gap: req.importance - strength,
      };
    })
    .filter(
      (c): c is NonNullable<typeof c> =>
        c !== null && c.gap > 0 && c.importance >= MIN_IMPORTANCE_TO_FLAG
    )
    .sort((a, b) => b.gap - a.gap)
    .slice(0, MAX_GAP_ITEMS);

  const items: GapItem[] = candidates.map((c) => ({
    key: c.key,
    name: c.name,
    category: c.category,
    importance: c.importance,
    currentStrength: c.currentStrength,
    message: buildGapMessage(c.name, c.currentStrength),
  }));

  const summaryParagraph =
    items.length === 0
      ? `${jobRole} 직무가 요구하는 역량을 지금까지의 기록만으로도 고르게 갖추고 있어요.`
      : `${jobRole} 직무와 비교했을 때, ${joinKoreanList(
          items.slice(0, 3).map((i) => i.name)
        )} 관련 경험이 상대적으로 부족해요. 아래 내용을 참고해서 관련 기록을 쌓아보세요.`;

  return { jobRole, items, summaryParagraph };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint lib/analysis/gapReport.ts`
Expected: no errors.

- [ ] **Step 4: Manual verification with a throwaway script (no API call needed — this is pure logic)**

```bash
cat > /tmp/smoke-gapreport.ts <<'EOF'
import { buildGapReport } from "../workspaces/codespaces-blank/lib/analysis/gapReport";

// 사용자는 "programming"만 두 과목에서 강하게(5,5) 드러남, 나머지는 전무.
const currentRows = [
  { score: 5, competency: { key: "programming", name: "프로그래밍/개발", category: "기술" }, course: { id: 1 } },
  { score: 5, competency: { key: "programming", name: "프로그래밍/개발", category: "기술" }, course: { id: 2 } },
];

const requirements = [
  { competencyKey: "programming", importance: 5 },
  { competencyKey: "data-analysis", importance: 4 },
  { competencyKey: "logical-thinking", importance: 4 },
  { competencyKey: "teamwork", importance: 2 }, // importance < 3, must never appear in items
  { competencyKey: "quantitative", importance: 3 },
  { competencyKey: "research", importance: 1 },
  { competencyKey: "writing", importance: 1 },
  { competencyKey: "presentation", importance: 1 },
  { competencyKey: "creativity", importance: 1 },
  { competencyKey: "project-management", importance: 1 },
  { competencyKey: "design-engineering", importance: 1 },
  { competencyKey: "language", importance: 1 },
];

const report = buildGapReport(currentRows, requirements, "백엔드 개발자");
console.log(JSON.stringify(report, null, 2));
console.log("programming excluded (no gap):", !report.items.some((i) => i.key === "programming"));
console.log("teamwork excluded (importance < 3):", !report.items.some((i) => i.key === "teamwork"));
console.log("data-analysis included (gap=4, currentStrength=0):", report.items.some((i) => i.key === "data-analysis" && i.currentStrength === 0));
EOF
npx tsx /tmp/smoke-gapreport.ts
rm /tmp/smoke-gapreport.ts
```

Expected: both boolean lines print `true`. `programming` (importance 5, currentStrength 5) has gap 0, correctly excluded. `teamwork` (importance 2) is below `MIN_IMPORTANCE_TO_FLAG`, correctly excluded even though its gap would be positive. `data-analysis` (importance 4, currentStrength 0 — never appears in `currentRows`) should be in `items` with `currentStrength: 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/analysis/gapReport.ts
git commit -m "Add pure gap comparison and template feedback generation"
```

---

## Task 3: Server Action (`lib/actions/gapAnalysis.ts`)

**Files:**
- Create: `lib/actions/gapAnalysis.ts`

**Interfaces:**
- Consumes: `analyzeJobRoleRequirements` (Task 1); `buildGapReport`, `type GapReport`, `type CurrentCompetencyRow` (Task 2); `requireUserId` (`lib/auth/session.ts`); `prisma` (`lib/db/client.ts`).
- Produces:
  - `type GapAnalysisState = { status: "idle" } | { status: "error"; message: string } | { status: "result"; report: GapReport }`
  - `async function analyzeJobGap(prevState: GapAnalysisState, formData: FormData): Promise<GapAnalysisState>` — a Server Action matching React's `useActionState(action, initialState)` contract (prevState first, FormData second). Consumed by Task 4.

- [ ] **Step 1: Write the file**

```ts
"use server";

import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import { analyzeJobRoleRequirements } from "@/lib/analysis/analyzeJobRole";
import { buildGapReport, type GapReport } from "@/lib/analysis/gapReport";

export type GapAnalysisState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "result"; report: GapReport };

// 결과를 DB에 저장하지 않는다 — 매 제출마다 새로 계산해서 페이지에만 보여준다
// (spec 참고: 직무명이 자유 텍스트라 캐싱 적중률이 낮고, 이번 라운드에서는
// "분석 이력"도 요구사항이 아니다). useActionState와 맞물려 동작하도록
// (prevState, formData) 시그니처를 그대로 따른다.
export async function analyzeJobGap(
  prevState: GapAnalysisState,
  formData: FormData
): Promise<GapAnalysisState> {
  const userId = await requireUserId();

  const jobRole = String(formData.get("jobRole") ?? "").trim();
  if (!jobRole) {
    return { status: "error", message: "직무를 입력해주세요." };
  }

  const currentRows = await prisma.courseCompetency.findMany({
    where: { course: { userId } },
    include: {
      competency: { select: { key: true, name: true, category: true } },
      course: { select: { id: true } },
    },
  });

  try {
    const requirements = await analyzeJobRoleRequirements(jobRole);
    const report = buildGapReport(currentRows, requirements, jobRole);
    return { status: "result", report };
  } catch (error) {
    console.error(`analyzeJobGap: "${jobRole}" 분석 실패:`, error);
    return {
      status: "error",
      message: "분석 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.",
    };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint lib/actions/gapAnalysis.ts`
Expected: no errors.

- [ ] **Step 4: Confirm every export in this file is async, and prove it with `next build`**

This is the exact bug that broke the portfolio feature's build (a synchronous helper co-located in a `"use server"` file, only caught at final whole-branch review because no task-level verification ran a real build). Inspect by hand first: this file only exports `analyzeJobGap`, which is `async` — there is no other `export` in this file, and no `portfolioEligibleWhere`-style query-filter helper to accidentally add here (if a future change ever needs one, it must go in a plain, non-`"use server"` module, not this file). Then confirm it for real, not just by inspection:

Run: `npx next build`
Expected: build succeeds with no "Server Actions must be async functions" error anywhere in the output. (At this point in the plan `/gap-analysis` doesn't exist yet, so this build check is purely about `lib/actions/gapAnalysis.ts` compiling cleanly as a `"use server"` module — Task 5 repeats this check once the route exists too, since a clean module-level build here doesn't guarantee the page that imports it is wired correctly.)

- [ ] **Step 5: Commit**

```bash
git add lib/actions/gapAnalysis.ts
git commit -m "Add analyzeJobGap server action"
```

---

## Task 4: Client component (`components/GapAnalysisForm.tsx`)

**Files:**
- Create: `components/GapAnalysisForm.tsx`

**Interfaces:**
- Consumes: `analyzeJobGap`, `type GapAnalysisState` (Task 3); `Card`, `Badge`, `Button` (`components/ui/*`, pre-existing).
- Produces: the `<GapAnalysisForm />` component, consumed by Task 5's page.

- [ ] **Step 1: Write the file**

```tsx
"use client";

import { useActionState } from "react";
import { analyzeJobGap, type GapAnalysisState } from "@/lib/actions/gapAnalysis";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

const INITIAL_STATE: GapAnalysisState = { status: "idle" };

export default function GapAnalysisForm() {
  const [state, formAction, pending] = useActionState(
    analyzeJobGap,
    INITIAL_STATE
  );

  return (
    <div>
      <Card className="mb-6">
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input
            name="jobRole"
            required
            placeholder="예: 백엔드 개발자"
            className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "분석 중..." : "갭 분석하기"}
          </Button>
        </form>
      </Card>

      {state.status === "error" && (
        <p className="mb-6 text-sm text-danger">{state.message}</p>
      )}

      {state.status === "result" && (
        <>
          <Card className="mb-6">
            <p className="leading-relaxed text-ink-secondary">
              {state.report.summaryParagraph}
            </p>
          </Card>

          {state.report.items.length > 0 && (
            <ul className="space-y-3">
              {state.report.items.map((item) => (
                <Card as="li" key={item.key}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 className="font-semibold">{item.name}</h2>
                    <Badge>{item.category}</Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-ink-secondary">
                    {item.message}
                  </p>
                </Card>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`useActionState` is a stable React 19 export — this repo is on React 19.2.8, confirmed in `package.json`.)

- [ ] **Step 3: Lint**

Run: `npx eslint components/GapAnalysisForm.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/GapAnalysisForm.tsx
git commit -m "Add GapAnalysisForm client component"
```

(No standalone manual verification for this task in isolation — it's not reachable from any route until Task 5 wires it into a page. Task 5's manual verification step covers this component's actual behavior.)

---

## Task 5: Page (`app/gap-analysis/page.tsx`)

**Files:**
- Create: `app/gap-analysis/page.tsx`

**Interfaces:**
- Consumes: `GapAnalysisForm` (Task 4); `requireUserId` (`lib/auth/session.ts`); `prisma` (`lib/db/client.ts`); `PageHeader`, `EmptyState`, `Button` (`components/ui/*`).
- Produces: the `/gap-analysis` route. Linked from Task 6.

- [ ] **Step 1: Write the file**

```tsx
import Link from "next/link";
import { Target } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import GapAnalysisForm from "@/components/GapAnalysisForm";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function GapAnalysisPage() {
  const userId = await requireUserId();

  const eligibleCourses = await prisma.courseCompetency.findMany({
    where: { course: { userId } },
    select: { courseId: true },
    distinct: ["courseId"],
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title="직무 갭 분석"
        backHref="/semesters"
        backLabel="학기 리스트"
      />

      {eligibleCourses.length < 2 ? (
        <EmptyState
          icon={<Target className="size-5" />}
          message="아직 분석할 기록이 부족해요. 과목을 2개 이상 등록하면 갭분석을 이용할 수 있어요."
          action={
            <Link href="/semesters">
              <Button variant="secondary" size="sm">
                과목 추가하러 가기
              </Button>
            </Link>
          }
        />
      ) : (
        <GapAnalysisForm />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint app/gap-analysis/page.tsx`
Expected: no errors.

- [ ] **Step 4: `next build` — mandatory for this task**

Run: `npx next build`
Expected: build succeeds; `/gap-analysis` appears as a dynamic (`ƒ`) route in the build output, same as `/portfolio` and `/portfolio/pdf`. No "Server Actions must be async functions" or any other error mentioning `lib/actions/gapAnalysis.ts`.

- [ ] **Step 5: Manual verification via dev server**

A dev server may already be running on port 3000 from earlier work — reuse it if so (do not start a second one on the same port); otherwise `npm run dev`. In a real browser (this Codespace's forwarded `*.app.github.dev` URL):

1. As a user account with fewer than 2 courses' worth of competency data (or a fresh account): visit `/gap-analysis`, confirm the "아직 분석할 기록이 부족해요" empty state renders with a working "과목 추가하러 가기" link.
2. As a user with 2+ courses that have competency data: visit `/gap-analysis`, confirm the job-role input form renders instead.
3. Submit a job role (e.g. "백엔드 개발자"). Confirm the button shows "분석 중..." and is disabled while pending, then a summary paragraph and (if any) gap cards appear with Korean text, no `undefined`/`[object Object]`.
4. Submit an empty job role (clear the input, bypass `required` via devtools if needed, or just confirm the browser's native required-field validation blocks it) — confirm this doesn't crash the page.

Expected: no server errors in the terminal running the dev server.

- [ ] **Step 6: Commit**

```bash
git add app/gap-analysis/page.tsx
git commit -m "Add /gap-analysis page"
```

---

## Task 6: Nav link from `/semesters`

**Files:**
- Modify: `app/semesters/page.tsx`

**Interfaces:**
- Consumes: nothing new — adds a third `<Link href="/gap-analysis">` next to the existing "강점 리포트"/"포트폴리오" buttons.

- [ ] **Step 1: Add the `Target` icon import**

In `app/semesters/page.tsx`, change:

```tsx
import { GraduationCap, Sparkles, BookOpen } from "lucide-react";
```

to:

```tsx
import { GraduationCap, Sparkles, BookOpen, Target } from "lucide-react";
```

- [ ] **Step 2: Add the third button**

Find the nav-buttons block (added earlier alongside the portfolio feature):

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
          <Link href="/gap-analysis">
            <Button variant="secondary" size="sm">
              <Target className="size-3.5" />
              직무 갭 분석
            </Button>
          </Link>
        </div>
      </div>
```

If the actual current content of `app/semesters/page.tsx` differs from the snippet above (e.g. button order or styling changed since this plan was written), match the existing two buttons' exact pattern rather than the snippet verbatim — the snippet reflects this file's state as of the portfolio feature's completion, immediately before this plan was written.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npx eslint app/semesters/page.tsx`
Expected: no errors.

- [ ] **Step 5: Manual verification**

In the browser, visit `/semesters` and confirm all three buttons render side by side, and the new one navigates to `/gap-analysis`.

- [ ] **Step 6: Commit**

```bash
git add app/semesters/page.tsx
git commit -m "Link to /gap-analysis from the semester list"
```

---

## After all tasks: report back, don't silently finish

This plan is implemented once Tasks 1-6 are all checked off and verified.
Whoever finishes this plan should say explicitly, in their final report:
"Job-role gap analysis is now implemented (`/gap-analysis`). The
`project-plannit-overview` memory should be updated to reflect that this
feature is live, and that the product-review punch list's priority #1 item
is done — priority #2 (AI draft-prefill for portfolio fields) is next."
This is outside the repo (a memory-file update in the coordinating
session), so it can't be a plan task, but it must not be dropped.
