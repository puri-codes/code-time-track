import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  port: toNumber(process.env.PORT, 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  githubToken: process.env.GITHUB_TOKEN,
  databasePath:
    process.env.ANALYTICS_DB_PATH ?? path.resolve(process.cwd(), 'backend', 'data', 'analytics.db')
};

