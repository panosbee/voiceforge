import type { Config } from 'drizzle-kit';
import 'dotenv/config';
import { resolve } from 'path';
import { config } from 'dotenv';

// Load .env from monorepo root if DATABASE_URL not already set
if (!process.env.DATABASE_URL) {
  config({ path: resolve(__dirname, '../../.env') });
}

export default {
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
