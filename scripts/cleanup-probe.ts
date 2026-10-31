import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const company = await prisma.company.findFirst({ where: { name: "Probe Co" } });
  if (company) {
    await prisma.session.deleteMany({ where: { user: { companyId: company.id } } });
    await prisma.user.deleteMany({ where: { companyId: company.id } });
    await prisma.company.delete({ where: { id: company.id } });
    console.log('probe tenant removed');
  } else {
    console.log('no probe tenant found');
  }
}
main().finally(() => prisma.$disconnect());
