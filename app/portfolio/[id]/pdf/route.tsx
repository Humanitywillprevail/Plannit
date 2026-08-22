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
        orderBy: { record: { createdAt: "desc" } },
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
