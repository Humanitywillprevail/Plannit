export type CompetencyDefinition = {
  key: string;
  name: string;
  category: string;
  keywords: string[];
};

// 역량 사전. 여기가 규칙 기반 분석의 유일한 소스(source of truth)이며,
// prisma/seed.ts가 이 목록을 DB의 Competency 테이블에 반영한다.
// 나중에 고도화(LLM 기반 등) 시에도 이 key 체계를 그대로 유지하면 된다.
export const COMPETENCY_DICTIONARY: CompetencyDefinition[] = [
  {
    key: "programming",
    name: "프로그래밍/개발",
    category: "기술",
    keywords: [
      "프로그래밍", "코딩", "구현", "알고리즘", "자료구조", "디버깅",
      "python", "java", "javascript", "typescript", "c++", "c언어",
      "웹개발", "앱개발", "api", "라이브러리", "프레임워크", "깃허브", "github",
    ],
  },
  {
    key: "data-analysis",
    name: "데이터 분석",
    category: "기술",
    keywords: [
      "데이터 분석", "데이터분석", "통계 분석", "회귀분석", "시각화",
      "엑셀", "spss", "r studio", "pandas", "sql", "데이터셋",
      "머신러닝", "딥러닝", "모델링", "예측 모델", "군집",
    ],
  },
  {
    key: "quantitative",
    name: "수리/통계 능력",
    category: "기술",
    keywords: [
      "미적분", "선형대수", "확률", "통계", "수식", "증명", "계산 문제",
      "최적화", "행렬", "수치해석",
    ],
  },
  {
    key: "logical-thinking",
    name: "논리적 사고/문제해결",
    category: "사고력",
    keywords: [
      "논리적", "문제 해결", "문제해결", "케이스 스터디", "사례 분석",
      "가설", "추론", "비판적 사고", "의사결정", "분석적 사고",
    ],
  },
  {
    key: "research",
    name: "리서치/조사",
    category: "사고력",
    keywords: [
      "문헌 조사", "선행 연구", "설문조사", "인터뷰", "자료 조사", "연구 방법",
      "실험 설계", "논문", "레퍼런스", "citation", "출처",
    ],
  },
  {
    key: "writing",
    name: "글쓰기/문서 작성",
    category: "커뮤니케이션",
    keywords: [
      "리포트", "보고서", "에세이", "레포트", "논술", "요약", "작문",
      "제안서", "기획서", "칼럼",
    ],
  },
  {
    key: "presentation",
    name: "발표/커뮤니케이션",
    category: "커뮤니케이션",
    keywords: [
      "발표", "프레젠테이션", "ppt", "구두 시험", "토론", "스피치",
      "피칭", "질의응답", "브리핑",
    ],
  },
  {
    key: "teamwork",
    name: "협업/팀워크",
    category: "커뮤니케이션",
    keywords: [
      "팀 프로젝트", "조별과제", "협업", "팀워크", "역할 분담", "그룹 프로젝트",
      "공동 작업",
    ],
  },
  {
    key: "creativity",
    name: "창의적 사고/기획",
    category: "사고력",
    keywords: [
      "기획", "아이디어", "브레인스토밍", "디자인 씽킹", "창작", "포트폴리오",
      "작품", "콘텐츠 제작",
    ],
  },
  {
    key: "project-management",
    name: "기획/프로젝트 관리",
    category: "실무",
    keywords: [
      "프로젝트 관리", "일정 관리", "간트차트", "마일스톤", "기획서 작성",
      "요구사항 분석", "리소스 배분",
    ],
  },
  {
    key: "design-engineering",
    name: "설계/실험(공학)",
    category: "실무",
    keywords: [
      "설계", "회로", "실험", "실습", "cad", "시뮬레이션", "제작", "센서",
      "장비", "시제품", "프로토타입",
    ],
  },
  {
    key: "language",
    name: "외국어/어학",
    category: "커뮤니케이션",
    keywords: [
      "영어", "영작", "토익", "토플", "번역", "원서", "외국어 발표",
      "listening", "speaking",
    ],
  },
];
