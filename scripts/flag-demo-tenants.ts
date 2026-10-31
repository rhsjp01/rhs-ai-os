import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const core = await prisma.company.updateMany({
    where: { id: '00000000-0000-0000-0000-000000000000' },
    data: { isDemo: true },
  });
  const cip = await prisma.company.updateMany({
    where: { name: 'Carolina Infrastructure Partners' },
    data: { isDemo: true },
  });
  console.log('flagged core admin:', core.count, '| flagged CIP demo:', cip.count);
}
main().finally(() => prisma.$disconnect());
