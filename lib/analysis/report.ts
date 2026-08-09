type CourseCompetencyRow = {
  score: number;
  matchedKeywords: string;
  competency: { key: string; name: string; category: string | null };
  course: { name: string };
};

export type CompetencyReportItem = {
  key: string;
  name: string;
  category: string;
  totalScore: number;
  courseNames: string[];
  topKeywords: string[];
};

export type CompetencyDetailParagraph = {
  key: string;
  name: string;
  paragraph: string;
};

export type CompetencyReport = {
  scopeLabel: string;
  items: CompetencyReportItem[];
  summaryParagraph: string;
  detailParagraphs: CompetencyDetailParagraph[];
};

function joinKoreanList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]}, ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} 그리고 ${items[items.length - 1]}`;
}

function tierPhrase(rank: number): string {
  if (rank === 0) return "가장 두드러지는 역량이에요";
  if (rank === 1) return "그 다음으로 눈에 띄는 역량이에요";
  if (rank === 2) return "꾸준히 드러나고 있는 역량이에요";
  return "이번 기록에서 조금씩 나타난 역량이에요";
}

// 규칙 기반 분석 결과(CourseCompetency)를 사람이 읽는 서술형 리포트로 바꾼다.
// LLM 없이 템플릿으로 생성하므로 문장은 정형화되어 있지만, 실제 과목명/키워드를
// 그대로 인용해서 "근거가 있는" 리포트처럼 읽히게 한다.
export function buildCompetencyReport(
  rows: CourseCompetencyRow[],
  meta: { scopeLabel: string; totalCourses: number }
): CompetencyReport {
  const map = new Map<
    string,
    {
      name: string;
      category: string;
      totalScore: number;
      courseNames: Set<string>;
      keywords: Set<string>;
    }
  >();

  for (const row of rows) {
    const key = row.competency.key;
    const existing = map.get(key);
    const keywords = row.matchedKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (existing) {
      existing.totalScore += row.score;
      existing.courseNames.add(row.course.name);
      keywords.forEach((k) => existing.keywords.add(k));
    } else {
      map.set(key, {
        name: row.competency.name,
        category: row.competency.category ?? "기타",
        totalScore: row.score,
        courseNames: new Set([row.course.name]),
        keywords: new Set(keywords),
      });
    }
  }

  const items: CompetencyReportItem[] = Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      name: v.name,
      category: v.category,
      totalScore: v.totalScore,
      courseNames: Array.from(v.courseNames),
      topKeywords: Array.from(v.keywords).slice(0, 5),
    }))
    .sort((a, b) => b.totalScore - a.totalScore);

  if (items.length === 0) {
    return {
      scopeLabel: meta.scopeLabel,
      items: [],
      summaryParagraph: `아직 ${meta.scopeLabel}에 분석할 만큼 기록이 쌓이지 않았어요. 과목 상세 페이지에서 과제·시험 내용을 기록하면 이 자리에 강점 분석이 채워져요.`,
      detailParagraphs: [],
    };
  }

  const topNames = joinKoreanList(items.slice(0, 3).map((i) => i.name));

  const summaryParagraph = `${meta.scopeLabel} 동안 ${meta.totalCourses}개 과목의 기록을 살펴본 결과, ${topNames} 역량이 두드러지게 나타났어요. 아래 리포트는 과제·시험 기록에 실제로 등장한 표현을 바탕으로 자동 정리한 강점 분석이에요.`;

  const detailParagraphs = items.map((item, rank) => {
    const courseList = joinKoreanList(item.courseNames);
    const keywordList = item.topKeywords.join(", ");
    const paragraph = `${tierPhrase(rank)}. ${courseList} 과목의 기록에서${
      keywordList ? ` '${keywordList}' 같은 표현이` : ""
    } 반복적으로 나타났어요.`;
    return { key: item.key, name: item.name, paragraph };
  });

  return { scopeLabel: meta.scopeLabel, items, summaryParagraph, detailParagraphs };
}
