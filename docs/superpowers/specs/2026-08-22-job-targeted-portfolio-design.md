# Job-targeted portfolio (replaces `/portfolio` and `/gap-analysis`)

Date: 2026-08-22
Status: approved, ready for implementation plan

## Context

Both `/portfolio` (AI-generated narrative per record, all-records list + PDF
export) and `/gap-analysis` (free-text job role → gap feedback, ephemeral)
shipped 2026-08-20 (see project memory `project-plannit-overview`). Using
them together surfaced a real product gap: an AI-written narrative for
every single activity isn't actually usable as "a portfolio" — a portfolio
is a curated, purposeful document built for a specific audience (a job
role), not a dump of everything the user ever recorded. Gap analysis was
also disconnected from portfolio-building: it told you what's missing in
the abstract, but had no way to act on that within the portfolio itself.

This round merges the two into one flow: pick a target job role, choose
which recorded activities to include, and get feedback on how well that
specific selection covers the role — plus concrete suggestions for which
other activities would help close the gaps. `/gap-analysis` and the old
all-records `/portfolio` are both replaced, not kept alongside this (user's
explicit call — two similar-but-different portfolio/gap surfaces would be
clutter).

The underlying building blocks are unchanged and fully reused: narrative
generation per record (`generateNarrative`), job-role competency importance
rating (`analyzeJobRoleRequirements`), and the gap comparison/template
feedback (`buildGapReport`). This spec is about the new selection +
persistence + recommendation layer wrapped around them.

## Decisions from brainstorming

- **Persisted, not ephemeral.** Unlike the old gap-analysis, a
  "portfolio" is now a saved `Portfolio` row a user can reopen, edit, and
  re-analyze — and can have several of (one per target job role). Chosen
  because the whole point is iterating on a curated selection over time,
  which a fire-and-forget page can't support.
- **Selection granularity is the `Record`** (individual activity), not the
  `Course`. This matches how narrative generation already works (one
  narrative per record) and how the user described the mental model:
  picking specific activities into a portfolio, not whole courses.
- **Gap analysis stays at `Course` granularity (reuses `CourseCompetency`
  as-is) — this is the one non-obvious design point.** `CourseCompetency`
  scores are per-course, not per-record. Two options were considered:
  - **A (chosen): reuse course-level scores, scoped to the courses touched
    by the selected records.** Zero new LLM calls — the existing
    `buildGapReport`/`analyzeJobRoleRequirements` pair runs unmodified,
    just fed a narrower `currentRows` query (filtered to the selected
    records' course IDs instead of all of the user's courses). The
    "which activities would help" recommendation is also pure code: look
    at `CourseCompetency` rows for courses *not yet* represented in the
    portfolio, matching the top gap competencies, and surface those. Trade-off:
    imprecise when only some of a course's records are selected — the
    portfolio gets credit for that course's full competency profile even
    if just one record from it is included. Accepted for MVP, same spirit
    as the imprecisions already accepted in the original gap-analysis spec
    (course-level averaging, no breadth weighting).
  - **B (rejected): new record-level competency analysis.** More
    accurate, but requires a new LLM call per record (or per selection),
    working against this project's repeatedly-stated cost-conscious
    design constraint (cumulative-summary structure, model tiering,
    direct Anthropic billing to control spend). Rejected on cost grounds.
- **Feedback is a snapshot, not live-computed on every view.** Stored on
  `Portfolio.feedback` (JSON) + `Portfolio.analyzedAt`, refreshed only via
  an explicit "다시 분석" action — same manual-trigger-only principle
  already applied to `generatePendingNarratives` and the old
  `analyzeJobGap`. Changing the selection or job role does not
  auto-recompute; the snapshot just goes stale until the user re-analyzes.
- **Recommendations are pure code, no new LLM call.** Built entirely from
  existing `CourseCompetency` data (see Approach A above) — the only LLM
  call anywhere in this feature is the existing job-role importance rating,
  unchanged from the old gap-analysis.
- **Narrative generation is unchanged**, just re-scoped: instead of a
  single "generate all pending" button across every eligible record,
  narrative generation is triggered for records missing one at
  selection time, scoped to what's actually selected.

## Data model

Two new models, one relation addition. New migration required.

```prisma
model Portfolio {
  id            Int      @id @default(autoincrement())
  userId        String
  name          String
  targetJobRole String
  feedback      Json?    // last analysis snapshot: { summaryParagraph, gaps: GapItem[], recommendations: RecommendationItem[] }
  analyzedAt    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
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

`Record` gets a new back-relation: `portfolios PortfolioRecord[]`. A record
can belong to multiple portfolios (same activity can support multiple
target roles). Deleting a `Record` or `Course` cascades through
`PortfolioRecord` automatically — a `Portfolio` can end up with 0 records
this way; that's an allowed, non-error state (see Error handling).

No migration needed for existing data — every `Record` with narrative data
generated under the old model remains valid and simply becomes a
selectable candidate for the new picker. Nothing is backfilled or deleted.

## Components

### New

**`lib/analysis/recommendActivities.ts`** — pure code, no LLM.
```ts
export type RecommendationItem = {
  courseId: number;
  courseName: string;
  competencyKey: string;
  competencyName: string;
  score: number;
  candidateRecordIds: number[]; // that course's portfolio-eligible records not yet in this portfolio
};

export function recommendActivities(
  gapItems: GapItem[],              // from buildGapReport, already sorted by gap size
  otherCourseRows: (CurrentCompetencyRow & { course: { id: number; name: string } })[], // CourseCompetency rows for courses NOT in the portfolio's course set
  eligibleRecordsByCourse: Map<number, number[]>, // courseId -> portfolio-eligible record IDs not already selected
): RecommendationItem[]
```
Takes the top 1-2 `GapItem`s, finds the highest-scoring non-portfolio
course for each competency key, returns up to 3 total recommendations. If
none of the user's other courses touch the missing competency, that gap
just doesn't produce a recommendation (not an error — see Error handling).

**`lib/actions/portfolios.ts`** (`"use server"`) — replaces
`lib/actions/gapAnalysis.ts`.
- `createPortfolio(prevState, formData)`: reads `name`, `targetJobRole`,
  `recordIds` (repeated form field) from `formData`; `requireUserId()`;
  creates `Portfolio` + `PortfolioRecord` rows in one transaction; redirects
  to `/portfolio/[id]` (standard `redirect()`-throws-in-server-action
  pattern). Validates `recordIds.length >= 1`, returns an `"error"` state
  otherwise (same `useActionState` contract as the old `analyzeJobGap`).
- `updatePortfolioRecords(portfolioId, recordIds)`: ownership-checks the
  portfolio (`where: { id: portfolioId, userId }`), deletes all existing
  `PortfolioRecord` rows for it and recreates from `recordIds` — replace,
  not diff, simplest correct approach. Does **not** touch `feedback`/
  `analyzedAt` (selection can go stale relative to the last analysis;
  that's fine, see below).
- `analyzePortfolio(portfolioId)`: ownership-checks; loads the portfolio's
  selected records' distinct course IDs; queries `CourseCompetency` scoped
  to those course IDs (mirrors the old `analyzeJobGap`'s query, just
  filtered); calls `analyzeJobRoleRequirements(portfolio.targetJobRole)`
  (unchanged); `buildGapReport(...)` (unchanged); queries `CourseCompetency`
  for the user's *other* courses (not in the selected set) to feed
  `recommendActivities`; writes `feedback` + `analyzedAt`; `revalidatePath`.
  Try/catch around the LLM call, same fail-soft message convention as
  `analyzeJobGap`.
- `deletePortfolio(portfolioId)`: ownership-checked delete.

**`lib/portfolio/queries.ts`** (no changes needed) — the picker's candidate
list reuses the existing `portfolioEligibleWhere(userId)` as-is (a record
with ≥1 of the 6 detail fields filled is exactly what's pickable). The
existing three helpers are otherwise untouched;
`generatePendingNarratives` still uses `portfolioPendingWhere`, just needs
an added `recordIds` filter (see below).

**`lib/actions/portfolio.ts`** (modified) — `generatePendingNarratives` gets
a required `recordIds: number[]` parameter, adds `id: { in: recordIds }` to
the existing `portfolioPendingWhere` query. Everything else (5-per-call cap,
per-record try/catch, `revalidatePath`) is unchanged. Called from the
picker/detail page scoped to whatever's currently selected and missing a
narrative — not "all pending across the whole account" anymore, since that
framing no longer matches the per-portfolio flow.

**`components/PortfolioRecordPicker.tsx`** (`"use client"`) — checkbox list
of the user's portfolio-eligible records, grouped by semester → course.
Each row shows course name, record content snippet, and a narrative-status
badge ("작성됨" / "생성 필요"). Used by both the create and edit flows.
Selected IDs submitted as repeated `recordIds` form fields.

**`components/PortfolioFeedbackPanel.tsx`** — renders `Portfolio.feedback`:
summary paragraph, a `GapItem` card per gap (same visual style as the old
`GapAnalysisForm`'s result cards), and a "이런 활동을 추가해보세요"
section per `RecommendationItem` (course name, competency, candidate record
list with a link to jump into the picker with that record pre-checked).
Shows "아직 분석 안 함" state when `analyzedAt` is null.

**`app/portfolio/page.tsx`** (rewritten) — list view. Query the user's
`Portfolio` rows ordered by `updatedAt desc`; card per portfolio (name,
targetJobRole, "마지막 분석: N일 전" or "분석 전"); empty state ("포트폴리오가
없어요") with a "새 포트폴리오 만들기" button linking to `/portfolio/new`.
Cold-start gate unchanged: if the user has fewer than 2 distinct
competency-scored courses, show the old gap-analysis empty state instead
("과목을 2개 이상 등록하면 포트폴리오를 만들 수 있어요") and don't offer
the create button at all.

**`app/portfolio/new/page.tsx`** — name + targetJobRole inputs +
`<PortfolioRecordPicker />`, submits to `createPortfolio`.

**`app/portfolio/[id]/page.tsx`** — ownership-checked detail page: the
selected records' narratives rendered as one flowing document (same
per-record `NARRATIVE_SECTION_LABELS` rendering the old `/portfolio` used)
+ `<PortfolioFeedbackPanel />` + "다시 분석" button (calls
`analyzePortfolio`) + link to `/portfolio/[id]/edit` + link to
`/portfolio/[id]/pdf`.

**`app/portfolio/[id]/edit/page.tsx`** — same picker, pre-checked with the
current selection, submits to `updatePortfolioRecords`; also allows editing
`name`/`targetJobRole` directly on `Portfolio`.

**`app/portfolio/[id]/pdf/route.tsx`** (replaces `app/portfolio/pdf/route.tsx`)
— same `@react-pdf/renderer` setup (Noto Sans KR font registration
unchanged, including its known-accepted remote-fetch fragility), scoped to
this portfolio's selected + generated records instead of every generated
record account-wide.

### Removed

- `app/gap-analysis/` (entire directory)
- `components/GapAnalysisForm.tsx`
- `lib/actions/gapAnalysis.ts` (logic absorbed into `analyzePortfolio`)
- `components/GeneratePortfolioForm.tsx` (replaced by inline
  narrative-generation triggers in the picker; the old page-wide "generate
  all pending" framing doesn't apply anymore)
- `app/portfolio/pdf/route.tsx` (replaced by the per-portfolio route)
- The "강점 리포트 / 포트폴리오 / 직무 갭 분석" three-button row on
  `/semesters` (`app/semesters/page.tsx`) collapses to two: "강점 리포트"
  (`/report`, untouched) and "포트폴리오" (`/portfolio`, now this new flow).

### Unchanged

`lib/analysis/analyzeJobRole.ts`, `lib/analysis/gapReport.ts`,
`lib/analysis/generateNarrative.ts`, `/report` and everything under
`lib/analysis/analyzeCourse.ts` — none of these need modification.

## Error handling

- **Cold-start gate** (< 2 competency-scored courses): unchanged from the
  old gap-analysis, now gates the whole `/portfolio` create flow instead of
  just the analysis form.
- **Zero records selected on create**: rejected client-side (submit
  disabled) and server-side in `createPortfolio` (returns an `"error"`
  state) — a `Portfolio` with 0 records is never created, though it can
  still *end up* at 0 later via cascading deletes.
- **Portfolio drifts to 0 records after cascading deletes**: allowed state,
  not an error. Detail page shows an inline notice ("선택된 활동이 모두
  삭제됐어요") instead of the narrative document, still lets the user edit
  the selection or delete the portfolio.
- **`analyzePortfolio` LLM call fails**: caught, `feedback`/`analyzedAt`
  left untouched (old snapshot, if any, stays visible), a transient error
  message shown — same fail-soft convention as the old `analyzeJobGap`.
- **No recommendations found** (no other course touches the missing
  competencies): the recommendations section is simply omitted from
  `feedback` — not an error, not a placeholder message either.
- **Selected record still missing narrative at analysis time**: allowed —
  the document just shows that record with an empty/placeholder section
  and a prompt to generate it; doesn't block `analyzePortfolio`, since gap
  analysis reads `CourseCompetency` (independent of `narrative`), not the
  narrative text.
- **Ownership checks**: every action scoped by `userId` in the `where`
  clause (`Portfolio.findFirst({ where: { id, userId } })` before any
  mutation) — same convention as the rest of the app's per-user data
  access.

## Testing

Same convention as both prior features: no automated test framework in
this repo. Verification is `tsc --noEmit` + `eslint` + `next build`, plus
manual browser exercise covering:
- Cold-start gate still shows correctly for a < 2-course account.
- Create flow: pick records across 2+ courses, submit, land on detail page.
- Narrative generation triggered from the picker for a record missing one.
- "분석하기" produces gap cards + at least one recommendation for an
  account with an obvious missing competency.
- Edit flow: change selection, "다시 분석" updates the feedback snapshot;
  *not* re-analyzing after a selection change leaves the stale snapshot
  visible (expected, not a bug).
- PDF export reflects only the portfolio's own selected + generated
  records, not the account's full record set.
- Deleting a record that's part of a portfolio doesn't crash the detail
  page (drifts to fewer records, or 0 with the inline notice).

## Out of scope for this round

- Record-level competency analysis (Approach B) — deferred indefinitely
  unless Approach A's imprecision turns out to matter in practice.
- Analysis history/versioning — only the latest `feedback` snapshot is
  kept, no past-runs list.
- One-click "add this recommended record" — the recommendation panel links
  into the picker with the record pre-checked, but the user still submits
  the edit form; no direct add-from-recommendation mutation.
- Sharing or export formats beyond the existing per-portfolio PDF.
- The AI draft-prefill feature for the 6 narrative detail fields (original
  priority #2) — unrelated to this round, still unbuilt, gets its own spec
  later.
- Any caching or dedup of `analyzeJobRoleRequirements` calls across
  portfolios with the same/similar `targetJobRole` text.
