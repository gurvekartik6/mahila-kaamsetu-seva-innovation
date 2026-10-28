import pg from 'pg';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const { Pool } = pg;
const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'KaamSetu Administrator', DATABASE_SSL, DATABASE_SSL_STRICT } = process.env;
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD in your environment before running npm run admin:create.');
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 14 || !/[A-Z]/.test(ADMIN_PASSWORD) || !/[a-z]/.test(ADMIN_PASSWORD) || !/[0-9]/.test(ADMIN_PASSWORD) || !/[^A-Za-z0-9]/.test(ADMIN_PASSWORD)) {
  console.error('ADMIN_PASSWORD must be at least 14 characters and include uppercase, lowercase, number, and symbol.');
  process.exit(1);
}
const pool = new Pool({ connectionString: DATABASE_URL, ssl: DATABASE_SSL === 'true' || /sslmode=require/i.test(DATABASE_URL) ? { rejectUnauthorized: DATABASE_SSL_STRICT !== 'false' } : undefined, max: 1 });
try {
  const salt = randomBytes(16).toString('hex');
  const passwordHash = `scrypt:${salt}:${Buffer.from(await scrypt(ADMIN_PASSWORD, salt, 64)).toString('hex')}`;
  const result = await pool.query(`INSERT INTO users(email,full_name,password_hash,role,preferred_language) VALUES($1,$2,$3,'admin','en') ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,password_hash=EXCLUDED.password_hash,role='admin',active=TRUE,updated_at=NOW() RETURNING id,email,role`, [ADMIN_EMAIL.trim().toLowerCase(), ADMIN_NAME, passwordHash]);
  console.log(`Admin account provisioned: ${result.rows[0].email} (id ${result.rows[0].id}). Remove ADMIN_PASSWORD from the environment now.`);
} catch (error) {
  console.error('Could not provision admin:', error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
