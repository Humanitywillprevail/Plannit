# Portfolio narrative generation + PDF export

Date: 2026-08-20
Status: approved, ready for implementation plan

## Context

Plannit already lets users log per-course `Record`s (assignments, exams,
etc.) and, as of 2026-08-20, fill in six optional "7-stage story" fields
on each `Record` (`summary`/`background`/`process`/`outcome`/`growth`/
`competencyNote`) that were added specifically to feed a future
AI-written portfolio narrative. That prep work shipped without the
generation logic itself. This spec covers building that generation
logic plus a portfolio page and PDF export.

Product framing (see project memory `project-plannit-overview`): a
"portfolio" in this app is not a resume-style list of grades — it's an
AI-reconstructed narrative per activity/experience, following a fixed
7-stage structure (소개 → 배경/목적 → 진행한 일 → 과정 → 결과물 →
성장한 점 → 나의 역량), assembled from the record's `content` field
(진행한 일) plus the six structured fields.

## Scope decisions (from brainstorming)

- **Narrative granularity**: one `Record` → one narrative. A record is
  eligible once at least one of the six portfolio fields is filled (the
  same criterion the record list already uses to show the "포트폴리오
  상세 보기" toggle).
- **Generation trigger**: NOT automatic on page visit. The `/portfolio`
  page is a read-only Server Component that only displays already
  -generated narratives, plus a button for records that are eligible but
  not yet generated. Clicking the button runs a Server Action that
  generates all pending narratives in one pass, then the page
  revalidates and shows them. (Deviates from the initial "generate
  automatically on visit" idea — writes/LLM calls inside a Server
  Component's render path are not idiomatic in this Next.js version and
  we just fixed a related Cache Components bug elsewhere; a Server
  Action click keeps the same one-click feel while following the
  codebase's existing mutation pattern, e.g. `addRecord`.)
- **Model**: `claude-sonnet-5` (via `@ai-sdk/anthropic`, same provider
  wiring as `analyzeCourseCompetencies`, direct Anthropic billing — not
  AI Gateway, per existing project convention). Sonnet over Haiku
  because this is long-form prose a human will read, not a
  classification task.
- **PDF export**: a real server-generated PDF (not browser print), via
  `@react-pdf/renderer` (new dependency). One button, "전체 PDF
  다운로드", produces a single PDF containing every generated
  narrative — no per-narrative individual download in this round.
- **Korean font**: `@react-pdf/renderer` does not embed CJK glyphs by
  default. Must bundle a Korean font (Noto Sans KR, OFL-licensed, free
  to embed) and register it via `Font.register` before rendering, or
  the PDF will show missing/garbled glyphs for Korean text.

## Data model

Add one field to `Record` in `prisma/schema.prisma`:

```prisma
model Record {
  // ...existing fields...
  narrative Json? // LLM이 생성한 7단계 내러티브. null = 아직 생성 안 됨.
}
```

`narrative` shape (stored as JSON, not enforced by Prisma):

```ts
type RecordNarrative = {
  intro: string; // 소개: 한 줄 요약
  background: string; // 배경/목적
  process: string; // 과정: 액션 + 인사이트
  outcome: string; // 결과물
  growth: string; // 성장한 점
  competency: string; // 나의 역량
};
```

A new Prisma migration is required (`prisma migrate dev`).

## Components

### `lib/analysis/generateNarrative.ts`

Mirrors `lib/analysis/analyzeCourse.ts`'s shape:

- Input: a single record's `{ content, summary, background, process, outcome, growth, competencyNote }`.
- Prompt: gives the model the record's raw content plus whichever of the
  six fields are filled (omit empty ones from the prompt rather than
  sending blank lines), and asks it to write ONE connected narrative
  across the 7 stages in Korean, in first person, matching Plannit's
  existing tone (see `lib/analysis/report.ts` for reference voice).
- Output: `generateText({ model: anthropic("claude-sonnet-5"), output: Output.object({ schema }) })` with a zod schema matching `RecordNarrative` (6 required string fields).
- Returns `RecordNarrative`.

### `lib/actions/portfolio.ts` (new, `"use server"`)

`generatePendingNarratives(): Promise<void>`
- `requireUserId()`
- Find the user's eligible records missing a narrative: `narrative IS NULL AND (summary IS NOT NULL OR background IS NOT NULL OR process IS NOT NULL OR outcome IS NOT NULL OR growth IS NOT NULL OR competencyNote IS NOT NULL)`.
- For each, call `generateNarrative`; on failure, log and skip (same try/catch-and-skip pattern as `reanalyzeCourse` — one record's LLM failure must not block the others or the action as a whole).
- Persist successes via `prisma.record.update({ data: { narrative } })`.
- `revalidatePath("/portfolio")`.

### `app/portfolio/page.tsx` (new)

- `requireUserId()`, `export const instant = false` (same as `/report`, `/courses/[courseId]` — logged-in-only data, no static prerender benefit).
- Query: all of the user's eligible records (see criterion above), `include: { course: { select: { name: true } } }`, ordered `createdAt desc`.
- Split into `generated` (narrative != null) and `pending` (narrative == null) in JS.
- Render:
  - If `pending.length > 0`: a `Card` with a form (`action={generatePendingNarratives}`) and a submit button, "미생성 항목 {n}개 — 포트폴리오 만들기".
  - If `generated.length > 0`: "전체 PDF 다운로드" link to `/portfolio/pdf`, then a list of cards — one per generated record, course name + the 6 narrative sections as labeled paragraphs (reuse `PORTFOLIO_FIELD_OPTIONS` labels from `lib/types.ts`, mapped onto the narrative's 6 keys — note the narrative key names differ slightly from the input field names, e.g. `intro` vs `summary`, `competency` vs `competencyNote`, so this mapping needs an explicit lookup, not a shared array).
  - If both are empty: `EmptyState`, pointing back to a course page to fill in portfolio fields first.
- Add a "포트폴리오" nav entry point (from `/semesters` or the root layout — implementation plan should confirm where; `/report` is currently linked from `/semesters`, so add this alongside it).

### `app/portfolio/pdf/route.ts` (new, Route Handler)

- GET only.
- `requireUserId()`.
- Query the same "generated" set as the page (`narrative != null`, ordered the same way).
- Render via `@react-pdf/renderer`'s `renderToBuffer` (or `renderToStream`) — a `Document` with one `Page`/section per record: course name as a heading, then the 6 narrative sections with their Korean labels.
- Register the Noto Sans KR font once (module-level `Font.register`) before rendering.
- Respond with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="plannit-portfolio.pdf"`.
- If there are zero generated records, return 404 (nothing to export) rather than an empty PDF.

## Error handling

- Per-record LLM failure during generation: skip that record, log, continue with the rest (matches `reanalyzeCourse`). The record simply stays in "pending" and the user can retry by clicking the button again.
- PDF route: if Anthropic/db calls aren't involved (PDF rendering only reads already-persisted narratives), the main failure mode is `@react-pdf/renderer` itself throwing — let it surface as a 500; no special handling needed for a first pass.

## Testing

- No existing test suite in this repo to extend (none found under `app`/`lib`). Verification is manual: run `tsc --noEmit` + `eslint`, then exercise the flow in a real browser — fill in portfolio fields on a record, visit `/portfolio`, click generate, confirm narrative cards render, download the PDF and confirm Korean text renders correctly (this is the step most likely to silently fail if the font registration is wrong).

## Out of scope for this round

- Regenerating/editing an already-generated narrative (no "다시 생성" button yet).
- Per-narrative individual PDF download.
- Any job-role gap-analysis feature (separate, larger effort, still unscoped — see project memory).
