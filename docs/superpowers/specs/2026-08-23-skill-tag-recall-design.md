# Skill-tag recall (hide AI portfolio/report UI, add tag-based recall)

Date: 2026-08-23
Status: approved, ready for implementation plan

## Context

The AI-driven strength report (`/report`), job-gap analysis, and AI
portfolio-narrative generation (`/portfolio`) are being deprioritized in the
UI — not deleted. All code, DB models (`Portfolio`, `PortfolioRecord`, the 6
narrative fields on `Record`), and API calls (Haiku competency scoring,
Sonnet narrative generation, job-gap prompts) stay exactly as they are, so
the feature can be re-enabled later with zero rebuild cost. Only the
navigation links that expose them are removed.

In their place: a lightweight way to tag a record with the competencies it
demonstrates, and pull matching records back up later by tag — "record
something once, find it again fast," instead of the heavier
AI-report/portfolio framing that hasn't yet proven its value (see
`project-plannit-overview` memory: "concrete analysis is unproven until the
text→competency mapping logic is designed").

This is a straightforward UI/product-surface change, not a new subsystem —
the user supplied a complete, ordered spec (below, translated) and this doc
mainly records the implementation decisions needed to turn it into a plan.

## Original request (translated)

1. **Hide, don't delete.** Remove the "강점 리포트" / "포트폴리오" buttons from
   the semester-list screen. Leave `/report` and `/portfolio` routes,
   pages, and their AI API calls in the codebase untouched — just make them
   unreachable via links.
2. **Lighten the add-record form.** Of the six fields under the "포트폴리오용
   상세 입력 (선택)" accordion, drop 배경/목적, 과정, 결과물, 성장한 점 from the
   form (keep the DB columns). Drop 소개(요약) — content is now carried
   solely by the existing "내용" field. Replace 나의 역량 with a tag picker
   (item 3). Final form: 유형 + 내용 + 역량 태그 + 첨부파일.
3. **New skillTags picker.** Reuse the 12 fixed competency categories from
   the strength report as multi-select toggle tags, plus a "직접 추가" custom
   tag input. (Optional, later: Haiku pre-suggests 2-3 tags from the
   content as a non-judgmental sorting aid, not evaluation language.)
4. **New "역량별 보기" tab** on the semester-list screen, alongside the
   existing "학기별 보기". Lists the 12(+custom) tags; clicking one shows
   every record carrying that tag, with its semester/course context.
5. **Copy button** on record cards, in both the semester-detail view and
   the skill view: copies the record's 내용 to the clipboard with a toast.

## Decisions

- **`skillTags` is a plain `String[]` column on `Record`**, not a join to
  the existing `Competency` master table. The picker's 12 presets are the
  competency *names* from `COMPETENCY_DICTIONARY`
  (`lib/analysis/keywordDictionary.ts`) reused as plain option labels —
  not a foreign key. This keeps custom tags and preset tags symmetric (both
  are just strings in the array), which is exactly what the "역량별 보기"
  grouping needs, and avoids coupling the new lightweight tagging feature
  to the AI-analysis data model it's explicitly meant to sit apart from.
- **Step 2 and step 3 are split, per the user's own staged/testable
  request.** Step 2 removes the four heavy fields and temporarily flattens
  "나의 역량" out of the now-single-field accordion into a plain textarea
  (accordion removed — collapsing one field serves no purpose). Step 3
  then replaces that textarea with the real tag picker and adds the
  `skillTags` column. This means step 2 alone is a smaller, fully working,
  independently verifiable diff.
- **Spec deviation — "record card" location.** The request says the copy
  button (and, by extension, the place records are browsable) belongs on
  "the semester-detail screen." In the actual app, the semester-detail
  screen (`app/semesters/[semesterId]/page.tsx`) lists *courses*, not
  *records* — records only render as cards one level deeper, on the course
  -detail page (`app/courses/[courseId]/page.tsx`). The plan applies the
  copy button (and, in step 3, the skillTags badges) to the course-detail
  record cards instead, since that's where record cards actually exist.
  The other target, the new skill-view list (step 4), is unaffected by
  this note.
- **역량별 보기 as a server-rendered tab, no client state.** Implemented via
  `?view=skill&tag=...` search params on `/semesters` (same async
  `searchParams` pattern already used by `app/portfolio/[id]/edit/page.tsx`),
  with plain `<Link>`s for both the view toggle and tag selection. Matches
  this codebase's existing server-heavy style (no client router needed for
  simple list filtering) and needs no new client component.
- **No test framework exists in this repo** (`package.json` has no `test`
  script; no `*.test.*`/`*.spec.*` files). Verification for every task
  uses `tsc --noEmit` + `eslint` + `next build`, plus a manual/browser
  check — the same method the last three shipped features
  (job-gap-analysis, portfolio-narrative-generation, job-targeted-portfolio)
  used, per project memory.
- **Toast is a minimal inline affordance**, not a new global toast system —
  a small client component swaps its own label to "복사됐어요" for ~1.5s
  after a successful `navigator.clipboard.writeText`. No app-wide toast
  infrastructure exists yet and one isn't justified for a single button.
- **Item 3's optional Haiku tag-suggestion assist is out of scope for this
  plan.** The user explicitly marked it "선택, 나중에 해도 됨" (optional, can
  be done later). Not included as a task; revisit after 1-5 ship and get
  used for a while.

## Data model change

```prisma
model Record {
  // ...unchanged fields...
  skillTags String[] @default([])
}
```

One migration, additive only (default `[]`, no backfill needed — existing
rows just get an empty array).

## Out of scope

- Deleting or modifying anything under `app/report/`, `app/portfolio/`,
  `lib/actions/portfolio(s).ts`, `lib/analysis/analyzeJobRole.ts`,
  `lib/analysis/generateNarrative.ts`, or the `Portfolio`/`PortfolioRecord`
  models.
- The Haiku tag-suggestion assist (see above).
- Any change to the `Competency`/`CourseCompetency` analysis pipeline.
