import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigrations(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('Missing SUPABASE_URL');
    process.exit(1);
  }

  const ref = new URL(supabaseUrl).hostname.split('.')[0];

  const client = new Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    // Get already executed migrations
    const { rows: executed } = await client.query('SELECT name FROM _migrations');
    const executedSet = new Set(executed.map((r: { name: string }) => r.name));

    let ran = 0;
    for (const file of files) {
      if (!file.endsWith('.sql')) continue;

      if (executedSet.has(file)) {
        console.log(`⏭️  ${file} (already executed)`);
        continue;
      }

      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      console.log(`✅ ${file} completed`);
      ran++;
    }

    if (ran === 0) {
      console.log('\nNo new migrations to run.');
    } else {
      console.log(`\n${ran} migration(s) completed successfully!`);
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
