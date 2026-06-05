// Prisma configuration - see schema.prisma for the actual schema configuration

export default {
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://admin:password@localhost:5432/delegatecart?schema=public',
  },
  migrations: {
    seed: 'node -r ts-node/register ./prisma/seed.ts',
  },
};
