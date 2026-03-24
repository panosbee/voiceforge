import 'dotenv/config';
import { resolve } from 'node:path';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import postgres from 'postgres';

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR
  || resolve(process.cwd(), '../../docker/migrations');

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

try {
  await sql`SELECT pg_advisory_lock(72981)`;

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const applied = await sql`SELECT filename FROM schema_migrations`;
  const appliedSet = new Set(applied.map((r) => r.filename));

  const manifestPath = resolve(MIGRATIONS_DIR, 'manifest.txt');
  const manifest = (await readFile(manifestPath, 'utf-8'))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  const pending = manifest.filter((f) => !appliedSet.has(f));

  for (const file of pending) {
    await access(resolve(MIGRATIONS_DIR, file));
  }

  let count = 0;
  for (const file of pending) {
    const filePath = resolve(MIGRATIONS_DIR, file);
    const content = await readFile(filePath, 'utf-8');
    const checksum = createHash('sha256').update(content).digest('hex');

    console.log(`Applying: ${file}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx.unsafe(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
        [file, checksum]
      );
    });
    count++;
  }

  await sql`SELECT pg_advisory_unlock(72981)`;
  console.log(count > 0 ? `Applied ${count} migration(s)` : 'No pending migrations');
} catch (err) {
  console.error('Migration failed:', err);
  await sql.end();
  process.exit(1);
}

await sql.end();
process.exit(0);
