type RawEnv = Record<string, unknown>;

const nodeEnvs = ['development', 'test', 'production'] as const;

type NodeEnv = (typeof nodeEnvs)[number];

export function validateEnv(config: RawEnv) {
  const port = Number(config.PORT ?? 3000);
  const rawNodeEnv = config.NODE_ENV ?? 'development';
  const databaseUrl = config.DATABASE_URL;
  const jwtSecret = config.JWT_SECRET;

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  if (typeof rawNodeEnv !== 'string') {
    throw new Error('NODE_ENV must be a string');
  }

  const nodeEnv = rawNodeEnv;

  if (!nodeEnvs.includes(nodeEnv as NodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required');
  }

  if (typeof jwtSecret !== 'string' || jwtSecret.length === 0) {
    throw new Error('JWT_SECRET is required');
  }

  return {
    ...config,
    PORT: port,
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
  };
}
