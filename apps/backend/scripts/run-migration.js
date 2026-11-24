"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function runMigrations() {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
        console.error('Missing SUPABASE_URL');
        process.exit(1);
    }
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    const host = process.env.DB_HOST || `db.${ref}.supabase.co`;
    const port = parseInt(process.env.DB_PORT || '5432', 10);
    const user = process.env.DB_USER || 'postgres';
    const client = new pg_1.Client({
        host,
        port,
        database: 'postgres',
        user,
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false },
    });
    console.log(`Connecting to ${host}:${port} as ${user}...`);
    try {
        await client.connect();
        console.log('Connected to PostgreSQL');
        await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
        const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
        const files = fs.readdirSync(migrationsDir).sort();
        const { rows: executed } = await client.query('SELECT name FROM _migrations');
        const executedSet = new Set(executed.map((r) => r.name));
        let ran = 0;
        for (const file of files) {
            if (!file.endsWith('.sql'))
                continue;
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
        }
        else {
            console.log(`\n${ran} migration(s) completed successfully!`);
        }
    }
    catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
    finally {
        await client.end();
    }
}
runMigrations();
//# sourceMappingURL=run-migration.js.map