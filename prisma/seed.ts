import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { COMPETENCY_DICTIONARY } from "../lib/analysis/keywordDictionary";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const competency of COMPETENCY_DICTIONARY) {
    await prisma.competency.upsert({
      where: { key: competency.key },
      update: {
        name: competency.name,
        category: competency.category,
        keywords: competency.keywords.join(","),
      },
      create: {
        key: competency.key,
        name: competency.name,
        category: competency.category,
        keywords: competency.keywords.join(","),
      },
    });
  }
  console.log(`Seeded ${COMPETENCY_DICTIONARY.length} competencies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
