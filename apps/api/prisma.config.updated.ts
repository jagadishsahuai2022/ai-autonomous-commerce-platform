// Prisma configuration
export default {
  datasource: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://admin:password@postgres:5432/delegatecart?schema=public',
  },
  migrations: {
    seed: 'node -r ts-node/register ./prisma/seed.ts',
  },
};
