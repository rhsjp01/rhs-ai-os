import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const sessions = await prisma.session.findMany({ select: { token: true } });
  console.log('sessions:', sessions.length, '| all sha256 (64 hex):', sessions.every((s) => /^[0-9a-f]{64}$/.test(s.token)));
}
main().finally(() => prisma.$disconnect());
