# Skill-tag recall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the AI strength-report/portfolio UI (keep the code/DB live), lighten the add-record form, and replace free-text "나의 역량" with a reusable `skillTags` picker + a tag-based "역량별 보기" recall view + a copy button on record cards.

**Architecture:** Five sequential, independently-shippable UI/data changes on top of the existing Next.js App Router + Prisma/Postgres stack. No new subsystems — one additive `String[]` column on `Record`, one new small client component per UI primitive (tag picker, copy button), and a server-rendered `?view=skill&tag=...` tab on the existing `/semesters` page (same async-`searchParams` pattern already used by `app/portfolio/[id]/edit/page.tsx`).

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 7 / Postgres (Supabase-hosted), Tailwind (project's existing `text-ink-secondary`/`border-line`/`bg-accent` token classes), lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-08-23-skill-tag-recall-design.md`

## Global Constraints

- Do not delete or modify anything under `app/report/`, `app/portfolio/`, `lib/actions/portfolio.ts`, `lib/actions/portfolios.ts`, `lib/analysis/analyzeJobRole.ts`, `lib/analysis/generateNarrative.ts`, `lib/analysis/gapReport.ts`, `lib/portfolio/`, `components/Portfolio*.tsx`, or the `Portfolio`/`PortfolioRecord` Prisma models — these must keep working exactly as-is, just unlinked from navigation.
- Do not delete the `Record.summary`/`background`/`process`/`outcome`/`growth` columns or the `PORTFOLIO_FIELD_OPTIONS` constant in `lib/types.ts` — schema and existing display code for already-filled records stay.
- This repo has **no test framework** (no `test` script, no `*.test.*`/`*.spec.*` files). Every task's verification is `npx tsc --noEmit` + `npm run lint` + `npm run build`, plus a manual/browser check — the same method used for the last three shipped features (see project memory). Do not introduce a test framework as part of this plan.
- Match existing code style: Korean UI copy and Korean domain comments (only where genuinely non-obvious), English identifiers, the existing `Card`/`Button`/`Badge`/`EmptyState`/`PageHeader` UI primitives, uncontrolled `<form action={serverAction}>` + hidden-input patterns (see `components/RecordTypeField.tsx`) rather than client-side fetch calls.
- Copy button placement deviates from the literal spec wording ("semester-detail screen") — apply it to the **course-detail** record cards (`app/courses/[courseId]/page.tsx`) instead, since that's where record cards actually render in this app (the semester-detail screen only lists courses). See spec's "Spec deviation" note.

---

### Task 1: Hide the AI report/portfolio nav links

**Files:**
- Modify: `app/semesters/page.tsx:1-47`

**Interfaces:**
- No new interfaces. Purely removes two `<Link>`+`<Button>` blocks and their now-unused imports.

- [ ] **Step 1: Remove the nav buttons and their now-unused imports**

In `app/semesters/page.tsx`, change the imports from:

```tsx
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import GradeBadge from "@/components/ui/GradeBadge";
import Button from "@/components/ui/Button";
import QuickAddSemester from "@/components/QuickAddSemester";
import { GraduationCap, Sparkles, BookOpen } from "lucide-react";
```

to:

```tsx
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import GradeBadge from "@/components/ui/GradeBadge";
import QuickAddSemester from "@/components/QuickAddSemester";
import { GraduationCap } from "lucide-react";
```

Then change the header block from:

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

to:

```tsx
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">학기 리스트</h1>
      </div>
```

`Link` (from `next/link`) stays imported — still used below for the semester cards.

- [ ] **Step 2: Verify**

Run:
```bash
npx tsc --noEmit
npm run lint
npm run build
```
Expected: all three pass with no errors (no unused-import lint warnings, no type errors).

Then start the dev server (`npm run dev`) and open `/semesters` in a browser: confirm the "강점 리포트" and "포트폴리오" buttons are gone from the header, and confirm `/report` and `/portfolio` still load fine when navigated to directly by URL (they're hidden, not broken).

- [ ] **Step 3: Commit**

```bash
git add app/semesters/page.tsx
git commit -m "hide AI report/portfolio nav links, keep routes intact"
```

---

### Task 2: Lighten the add-record form

**Files:**
- Modify: `app/courses/[courseId]/page.tsx:157-175`

**Interfaces:**
- No schema or action changes. `addRecord` (`lib/actions/records.ts`) already treats every `PORTFOLIO_FIELD_OPTIONS` field as optional via `readOptionalField` (missing form field → `null`), so removing fields from the form JSX requires no server-side change.

- [ ] **Step 1: Replace the accordion with a flat "나의 역량" textarea**

In `app/courses/[courseId]/page.tsx`, replace:

```tsx
            <details className="rounded-lg border border-line px-3 py-2">
              <summary className="cursor-pointer text-sm text-ink-secondary">
                포트폴리오용 상세 입력 (선택)
              </summary>
              <div className="mt-3 space-y-3">
                {PORTFOLIO_FIELD_OPTIONS.map((field) => (
                  <div key={field.value}>
                    <label className="mb-1 block text-sm text-ink-secondary">
                      {field.label}
                    </label>
                    <textarea
                      name={field.value}
                      rows={2}
                      className="w-full rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
                    />
                  </div>
                ))}
              </div>
            </details>
```

with:

```tsx
            <div>
              <label className="mb-1 block text-sm text-ink-secondary">
                나의 역량
              </label>
              <textarea
                name="competencyNote"
                rows={2}
                className="w-full rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
              />
            </div>
```

Leave the `PORTFOLIO_FIELD_OPTIONS` import and the record-list "포트폴리오 상세 보기" `<details>` viewer further down in the same file untouched — that block reads already-saved records (including old ones with 배경/과정/결과물/성장한점/소개 filled in) and is out of scope for this task.

- [ ] **Step 2: Verify**

Run:
```bash
npx tsc --noEmit
npm run lint
npm run build
```
Expected: all pass.

In the browser, open any course detail page: confirm the "포트폴리오용 상세 입력 (선택)" accordion is gone and a plain, always-visible "나의 역량" textarea appears between "내용" and "첨부파일". Add a record with just 내용 + 나의 역량 filled in, submit, and confirm it saves (appears in the list below) without errors.

- [ ] **Step 3: Commit**

```bash
git add app/courses/[courseId]/page.tsx
git commit -m "flatten add-record form: drop heavy portfolio fields, keep skill note"
```

---

### Task 3: skillTags picker (replaces the "나의 역량" textarea)

**Files:**
- Modify: `prisma/schema.prisma` (add `skillTags` to `Record`)
- Create: migration via `prisma migrate dev` (generates its own directory under `prisma/migrations/`)
- Modify: `lib/types.ts` (add `SKILL_TAG_PRESETS`)
- Create: `components/SkillTagField.tsx`
- Modify: `app/courses/[courseId]/page.tsx` (swap textarea for the picker; show tag badges on saved records)
- Modify: `lib/actions/records.ts` (read `skillTags` from the form, save to `Record`)

**Interfaces:**
- Produces: `SkillTagField({ presets: string[], initialSelected?: string[] })` — client component, renders hidden `<input name="skillTags">` per selected tag so a wrapping `<form action={addRecord}>` picks them up via `FormData.getAll("skillTags")`.
- Produces: `SKILL_TAG_PRESETS: string[]` exported from `lib/types.ts`.
- Consumes: `COMPETENCY_DICTIONARY` from `lib/analysis/keywordDictionary.ts` (existing, unchanged — array of `{ key, name, category, keywords }`).

- [ ] **Step 1: Add the `skillTags` column**

In `prisma/schema.prisma`, in the `Record` model, add a line right after `narrative`:

```prisma
  narrative      Json? // LLM이 생성한 7단계 내러티브({ intro, background, process, outcome, growth, competency }). null = 아직 생성 안 됨.
  skillTags      String[]          @default([]) // 역량 태그. 강점 리포트의 12개 프리셋 + 사용자 커스텀 태그가 섞여 들어간다.
  createdAt      DateTime          @default(now())
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add_record_skill_tags
```
Expected: migration applies cleanly against the dev DB (same Supabase Postgres instance used elsewhere in this repo) and regenerates the Prisma client. Confirm no errors in the output.

- [ ] **Step 3: Add the preset list**

In `lib/types.ts`, add an import and a new export:

```ts
import { COMPETENCY_DICTIONARY } from "@/lib/analysis/keywordDictionary";
```

at the top of the file, and at the end:

```ts
// 역량 태그 선택 UI의 프리셋. 강점 리포트가 쓰는 12개 역량 사전을 그대로 재사용한다.
export const SKILL_TAG_PRESETS = COMPETENCY_DICTIONARY.map((c) => c.name);
```

- [ ] **Step 4: Create the tag picker component**

Create `components/SkillTagField.tsx`:

```tsx
"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function SkillTagField({
  presets,
  initialSelected = [],
}: {
  presets: string[];
  initialSelected?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [customInput, setCustomInput] = useState("");

  function toggle(tag: string) {
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function addCustomTag() {
    const tag = customInput.trim();
    if (!tag || selected.includes(tag)) return;
    setSelected((prev) => [...prev, tag]);
    setCustomInput("");
  }

  const customTags = selected.filter((t) => !presets.includes(t));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((tag) => {
          const active = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
              }`}
            >
              {tag}
            </button>
          );
        })}
        {customTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className="rounded-full border border-accent bg-accent px-3 py-1 text-xs font-medium text-accent-ink"
          >
            {tag} ✕
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustomTag();
            }
          }}
          placeholder="직접 추가"
          className="w-32 rounded-lg border border-line bg-transparent px-3 py-1 text-sm outline-none focus:border-accent"
        />
        <Button type="button" variant="ghost" size="sm" onClick={addCustomTag}>
          추가
        </Button>
      </div>

      {selected.map((tag) => (
        <input key={tag} type="hidden" name="skillTags" value={tag} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Wire the picker into the add-record form**

In `app/courses/[courseId]/page.tsx`, add imports:

```tsx
import SkillTagField from "@/components/SkillTagField";
```

and add `SKILL_TAG_PRESETS` to the existing `@/lib/types` import:

```tsx
import {
  RECORD_TYPE_OPTIONS,
  recordTypeLabel,
  GRADE_OPTIONS,
  SELF_RATING_OPTIONS,
  PORTFOLIO_FIELD_OPTIONS,
  SKILL_TAG_PRESETS,
} from "@/lib/types";
```

Replace the flat "나의 역량" textarea added in Task 2:

```tsx
            <div>
              <label className="mb-1 block text-sm text-ink-secondary">
                나의 역량
              </label>
              <textarea
                name="competencyNote"
                rows={2}
                className="w-full rounded-lg border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
              />
            </div>
```

with:

```tsx
            <div>
              <label className="mb-1 block text-sm text-ink-secondary">
                역량 태그
              </label>
              <SkillTagField presets={SKILL_TAG_PRESETS} />
            </div>
```

- [ ] **Step 6: Save `skillTags` in the server action**

In `lib/actions/records.ts`, in `addRecord`, after the `content` line add:

```ts
  const skillTags = Array.from(
    new Set(
      formData
        .getAll("skillTags")
        .map((t) => String(t).trim())
        .filter(Boolean)
    )
  );
```

and change the `record.create` call from:

```ts
  const record = await prisma.record.create({
    data: { userId, courseId, type, content, ...portfolioFields },
  });
```

to:

```ts
  const record = await prisma.record.create({
    data: { userId, courseId, type, content, skillTags, ...portfolioFields },
  });
```

- [ ] **Step 7: Show saved tags on the record cards**

In `app/courses/[courseId]/page.tsx`, in the record list, add tag badges right after the content/type paragraph (before the "포트폴리오 상세 보기" `<details>`):

```tsx
                  {r.skillTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.skillTags.map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                    </div>
                  )}
```

(`Badge` is already imported in this file.)

- [ ] **Step 8: Verify**

Run:
```bash
npx tsc --noEmit
npm run lint
npm run build
```
Expected: all pass.

In the browser, open a course detail page: confirm the "역량 태그" picker shows the 12 preset pills, clicking one toggles it (highlighted), typing a custom tag and clicking "추가" adds it as a removable chip. Submit a record with 2 presets + 1 custom tag selected, and confirm the new record card shows all three as badges.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/types.ts components/SkillTagField.tsx app/courses/\[courseId\]/page.tsx lib/actions/records.ts
git commit -m "add skillTags picker, replacing free-text competency note"
```

---

### Task 4: "역량별 보기" tab on the semester-list screen

**Files:**
- Modify: `app/semesters/page.tsx`

**Interfaces:**
- Consumes: `SKILL_TAG_PRESETS` (from Task 3, `lib/types.ts`), `prisma.record.findMany` with the `skillTags: { has: tag }` Postgres array filter.
- Produces: two internal (non-exported) async components in the same file, `SemesterView` and `SkillView`, both taking `{ userId: string }` (+ `tag?: string` for `SkillView`) — purely a within-file decomposition, not consumed elsewhere.

- [ ] **Step 1: Restructure the page into tabs**

Replace the full contents of `app/semesters/page.tsx` with:

```tsx
import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/session";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import GradeBadge from "@/components/ui/GradeBadge";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import QuickAddSemester from "@/components/QuickAddSemester";
import { GraduationCap, Tags } from "lucide-react";
import { computeGpa, formatGpa } from "@/lib/gpa";
import { SKILL_TAG_PRESETS } from "@/lib/types";

// 로그인 사용자 전용 데이터라 정적 프리렌더 이점이 없다 — instant-navigation 검증에서 제외.
export const instant = false;

export default async function SemestersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; tag?: string }>;
}) {
  const userId = await requireUserId();
  const { view: viewParam, tag } = await searchParams;
  const view = viewParam === "skill" ? "skill" : "semester";

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">학기 리스트</h1>
      </div>

      <div className="mb-6 flex gap-2">
        <Link href="/semesters">
          <Button variant={view === "semester" ? "secondary" : "ghost"} size="sm">
            학기별 보기
          </Button>
        </Link>
        <Link href="/semesters?view=skill">
          <Button variant={view === "skill" ? "secondary" : "ghost"} size="sm">
            역량별 보기
          </Button>
        </Link>
      </div>

      {view === "skill" ? (
        <SkillView userId={userId} tag={tag} />
      ) : (
        <SemesterView userId={userId} />
      )}
    </main>
  );
}

async function SemesterView({ userId }: { userId: string }) {
  const semesters = await prisma.semester.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      courses: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, grade: true, credit: true },
      },
    },
  });

  return (
    <>
      <div className="mb-4">
        <QuickAddSemester />
      </div>

      {semesters.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-5" />}
          message="아직 추가된 학기가 없어요. 위 버튼으로 첫 학기를 만들어보세요."
        />
      ) : (
        <ul className="space-y-3">
          {semesters.map((s) => {
            const gpa = computeGpa(s.courses);
            return (
              <li key={s.id}>
                <Link href={`/semesters/${s.id}`}>
                  <Card className="transition-colors hover:border-line-strong">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <p className="text-lg font-semibold">{s.name}</p>
                      <span
                        className={`shrink-0 text-sm font-semibold tabular-nums ${gpa === null ? "text-ink-muted" : "text-accent"}`}
                      >
                        평균 {formatGpa(gpa)}
                      </span>
                    </div>
                    {s.courses.length === 0 ? (
                      <p className="text-sm text-ink-muted">
                        아직 등록된 과목이 없어요.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {s.courses.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="truncate text-ink-secondary">
                              {c.name}
                            </span>
                            <GradeBadge grade={c.grade} className="shrink-0" />
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

async function SkillView({ userId, tag }: { userId: string; tag?: string }) {
  const records = await prisma.record.findMany({
    where: { userId },
    select: { skillTags: true },
  });
  const customTags = Array.from(
    new Set(
      records.flatMap((r) => r.skillTags).filter((t) => !SKILL_TAG_PRESETS.includes(t))
    )
  ).sort();
  const allTags = [...SKILL_TAG_PRESETS, ...customTags];

  const taggedRecords = tag
    ? await prisma.record.findMany({
        where: { userId, skillTags: { has: tag } },
        orderBy: { createdAt: "desc" },
        include: { course: { include: { semester: true } } },
      })
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {allTags.map((t) => (
          <Link key={t} href={`/semesters?view=skill&tag=${encodeURIComponent(t)}`}>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
                tag === t
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
              }`}
            >
              {t}
            </span>
          </Link>
        ))}
      </div>

      {!tag && (
        <p className="text-sm text-ink-muted">
          태그를 선택하면 관련 기록을 모아볼 수 있어요.
        </p>
      )}

      {tag &&
        (taggedRecords.length === 0 ? (
          <EmptyState
            icon={<Tags className="size-5" />}
            message={`"${tag}" 태그가 달린 기록이 아직 없어요.`}
          />
        ) : (
          <ul className="space-y-2">
            {taggedRecords.map((r) => (
              <Card as="li" key={r.id} padded>
                <p className="mb-1 text-xs text-ink-muted">
                  {r.course.semester.name} · {r.course.name}
                </p>
                <p className="text-sm">{r.content}</p>
                {r.skillTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.skillTags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </ul>
        ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run:
```bash
npx tsc --noEmit
npm run lint
npm run build
```
Expected: all pass.

In the browser: open `/semesters`, confirm "학기별 보기" is active by default and shows the existing semester list unchanged. Click "역량별 보기" — confirm the 12 preset tags render (plus any custom tags you added in Task 3's testing) as pills, and clicking one filters to matching records showing their semester/course context and tags. Click a tag with no records and confirm the empty state renders. Click "학기별 보기" again to confirm it switches back cleanly.

- [ ] **Step 3: Commit**

```bash
git add app/semesters/page.tsx
git commit -m "add 역량별 보기 tab to the semester-list screen"
```

---

### Task 5: Copy button on record cards

**Files:**
- Create: `components/CopyRecordButton.tsx`
- Modify: `app/courses/[courseId]/page.tsx` (record list header row)
- Modify: `app/semesters/page.tsx` (`SkillView`'s record card)

**Interfaces:**
- Produces: `CopyRecordButton({ content: string })` — client component, self-contained (no props beyond the text to copy, no external toast system).

- [ ] **Step 1: Create the copy button**

Create `components/CopyRecordButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import Button from "@/components/ui/Button";

export default function CopyRecordButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없는 환경 — 조용히 무시
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="size-3.5" />
          복사됐어요
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
          복사
        </>
      )}
    </Button>
  );
}
```

- [ ] **Step 2: Add it to the course-detail record cards**

In `app/courses/[courseId]/page.tsx`, add the import:

```tsx
import CopyRecordButton from "@/components/CopyRecordButton";
```

Change the record card's header row from:

```tsx
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <p>
                      <Badge className="mr-2 align-middle">
                        {recordTypeLabel(r.type)}
                      </Badge>
                      {r.content}
                    </p>
                    <DeleteForm
                      action={deleteRecord}
                      hiddenFields={{ id: r.id }}
                      confirmMessage="이 기록을 삭제할까요? 첨부파일도 함께 삭제됩니다."
                      className="shrink-0 rounded-lg px-2 py-1 text-xs text-danger hover:bg-danger/10"
                    />
                  </div>
```

to:

```tsx
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <p>
                      <Badge className="mr-2 align-middle">
                        {recordTypeLabel(r.type)}
                      </Badge>
                      {r.content}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <CopyRecordButton content={r.content} />
                      <DeleteForm
                        action={deleteRecord}
                        hiddenFields={{ id: r.id }}
                        confirmMessage="이 기록을 삭제할까요? 첨부파일도 함께 삭제됩니다."
                        className="rounded-lg px-2 py-1 text-xs text-danger hover:bg-danger/10"
                      />
                    </div>
                  </div>
```

- [ ] **Step 3: Add it to the 역량별 보기 record cards**

In `app/semesters/page.tsx`, add the import:

```tsx
import CopyRecordButton from "@/components/CopyRecordButton";
```

In `SkillView`, change:

```tsx
              <Card as="li" key={r.id} padded>
                <p className="mb-1 text-xs text-ink-muted">
                  {r.course.semester.name} · {r.course.name}
                </p>
                <p className="text-sm">{r.content}</p>
                {r.skillTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.skillTags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                )}
              </Card>
```

to:

```tsx
              <Card as="li" key={r.id} padded>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-1 text-xs text-ink-muted">
                      {r.course.semester.name} · {r.course.name}
                    </p>
                    <p className="text-sm">{r.content}</p>
                  </div>
                  <CopyRecordButton content={r.content} />
                </div>
                {r.skillTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.skillTags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                )}
              </Card>
```

- [ ] **Step 4: Verify**

Run:
```bash
npx tsc --noEmit
npm run lint
npm run build
```
Expected: all pass.

In the browser: on a course detail page, click "복사" on a record card — the button label should switch to "복사됐어요" for about 1.5 seconds, then revert; paste somewhere (e.g. the URL bar) to confirm the correct 내용 text was copied. Repeat the same check on `/semesters?view=skill&tag=...` for a tagged record.

- [ ] **Step 5: Commit**

```bash
git add components/CopyRecordButton.tsx app/courses/\[courseId\]/page.tsx app/semesters/page.tsx
git commit -m "add copy-to-clipboard button to record cards"
```
