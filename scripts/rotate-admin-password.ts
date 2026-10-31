import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// Rotates seeded credentials in place (no data wipe):
//   SEED_ADMIN_PASSWORD → every administrative user
//   SEED_DEMO_PASSWORD   → the demo operator (DEMO_USER_EMAIL)
// All existing sessions are invalidated so tokens issued under the old
// secrets die with them. Run after changing either value in .env:
//   bun scripts/rotate-admin-password.ts
async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  const demoEmail = (process.env.DEMO_USER_EMAIL ?? 'demo@carolinainfrastructure.com').toLowerCase();

  if (!adminPassword || !demoPassword) {
    throw new Error(
      'SEED_ADMIN_PASSWORD and SEED_DEMO_PASSWORD must be set in the environment — ' +
        'refusing to rotate to a hardcoded value. See .env.example.',
    );
  }

  const admins = await prisma.user.updateMany({
    where: { role: 'admin' },
    data: { passwordHash: hashPassword(adminPassword) },
  });

  const demoUser = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (demoUser) {
    await prisma.user.update({
      where: { id: demoUser.id },
      data: { passwordHash: hashPassword(demoPassword) },
    });
  }

  // Invalidate every existing session — a clean slate after credential
  // rotation is the correct posture.
  const sessions = await prisma.session.deleteMany({});

  console.log(
    `rotated ${admins.count} admin password(s)` +
      (demoUser ? `, demo operator ${demoUser.email}` : ' (demo operator not found — skipped)') +
      `, sessions cleared: ${sessions.count}`,
  );
}
main().finally(() => prisma.$disconnect());
