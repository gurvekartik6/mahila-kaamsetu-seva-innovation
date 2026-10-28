import express from 'express';
import pg from 'pg';
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
  randomUUID
} from 'node:crypto';
import { promisify } from 'node:util';

const { Pool } = pg;
const scrypt = promisify(scryptCallback);
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(),geolocation=(),payment=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  next();
});

app.use(express.json({ limit: '4.2mb' }));

app.use((req, _res, next) => {
  if (req.path === '/api/index.js' && typeof req.query.route === 'string') {
    req.url = `/api/${req.query.route}`;
  }
  next();
});

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_SSL === 'true' ||
        /sslmode=require/i.test(process.env.DATABASE_URL)
          ? {
              rejectUnauthorized:
                process.env.DATABASE_SSL_STRICT !== 'false'
            }
          : undefined,
      max: Number(process.env.PG_POOL_MAX || 5),
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000
    })
  : null;

const types = new Set(['work', 'health', 'docs', 'saheli', 'other']);
const langs = new Set(['mr', 'hi', 'en']);
const replies = new Set(['web', 'saheli', 'phone']);
const statuses = new Set([
  'created',
  'review',
  'in_progress',
  'waiting_user',
  'completed',
  'rejected'
]);

const cookieName =
  process.env.NODE_ENV === 'production'
    ? '__Host-kaamsetu_session'
    : 'kaamsetu_session';

const memory = {
  users: [],
  sessions: new Map(),
  requests: [],
  opportunities: [],
  documents: [],
  audits: [],
  rateLimits: new Map()
};

const digest = (value) =>
  createHash('sha256').update(value).digest('hex');

function getCookie(req) {
  const item = (req.headers.cookie || '')
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(cookieName + '='));

  return item
    ? decodeURIComponent(item.slice(cookieName.length + 1))
    : '';
}

function setCookie(res, token, age) {
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
}

function clearCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
}

function safeUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name || user.fullName,
    role: user.role,
    language: user.preferred_language || user.language || 'mr',
    active: user.active !== false
  };
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = Buffer.from(await scrypt(password, salt, 64)).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

async function verifyPassword(password, hash) {
  const [scheme, salt, hex] = String(hash || '').split(':');

  if (scheme !== 'scrypt' || !salt || !hex) {
    return false;
  }

  const actual = Buffer.from(await scrypt(password, salt, 64));
  const expected = Buffer.from(hex, 'hex');

  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}

async function userFor(req) {
  const token = getCookie(req);
  if (!token) return null;

  if (pool) {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.preferred_language
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.expires_at > NOW()
         AND u.active = TRUE`,
      [digest(token)]
    );

    return result.rows[0] || null;
  }

  const session = memory.sessions.get(digest(token));

  return session && session.expiresAt > Date.now()
    ? session.user
    : null;
}

async function audit(actor, action, entity, id = '', metadata = {}) {
  if (pool) {
    await pool.query(
      `INSERT INTO audit_logs
       (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [actor || null, action, entity, String(id), JSON.stringify(metadata)]
    );
  } else {
    memory.audits.unshift({
      actor,
      action,
      entity,
      id,
      metadata,
      createdAt: new Date().toISOString()
    });
  }
}

function auth(req, res, next) {
  userFor(req)
    .then((user) => {
      if (!user) {
        return res.status(401).json({
          error: 'Please sign in to continue.'
        });
      }

      req.user = safeUser(user);
      next();
    })
    .catch(next);
}

function roles(...allowed) {
  return (req, res, next) => {
    if (req.user && allowed.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      error: 'You do not have permission to do this.'
    });
  };
}

function originGuard(req, res, next) {
  if (
    !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ||
    !req.headers.origin
  ) {
    return next();
  }

  try {
    if (new URL(req.headers.origin).host !== req.headers.host) {
      return res.status(403).json({
        error: 'Request origin is not allowed.'
      });
    }
  } catch {
    return res.status(403).json({
      error: 'Invalid request origin.'
    });
  }

  next();
}

app.use('/api', originGuard);

async function rateLimit(req, res, next) {
  const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}:${req.path}`;

  try {
    if (pool) {
      const result = await pool.query(
        `INSERT INTO rate_limits (key, count, window_started_at)
         VALUES ($1, 1, NOW())
         ON CONFLICT (key) DO UPDATE SET
           count = CASE
             WHEN rate_limits.window_started_at < NOW() - INTERVAL '15 minutes'
             THEN 1
             ELSE rate_limits.count + 1
           END,
           window_started_at = CASE
             WHEN rate_limits.window_started_at < NOW() - INTERVAL '15 minutes'
             THEN NOW()
             ELSE rate_limits.window_started_at
           END
         RETURNING count`,
        [key]
      );

      if (result.rows[0].count > 20) {
        return res.status(429).json({
          error: 'Too many attempts. Wait and try again.'
        });
      }

      return next();
    }
  } catch {
    // Fall back to a per-process limiter if PostgreSQL is temporarily unavailable.
  }

  const now = Date.now();
  let entry = memory.rateLimits.get(key);

  if (!entry || now - entry.startedAt >= 15 * 60 * 1000) {
    entry = { count: 0, startedAt: now };
    memory.rateLimits.set(key, entry);
  }

  entry.count += 1;

  if (memory.rateLimits.size > 5000) {
    for (const [storedKey, value] of memory.rateLimits) {
      if (now - value.startedAt >= 15 * 60 * 1000) {
        memory.rateLimits.delete(storedKey);
      }

      if (memory.rateLimits.size <= 4000) break;
    }
  }

  if (entry.count > 20) {
    return res.status(429).json({
      error: 'Too many attempts. Wait and try again.'
    });
  }

  return next();
}

function requireDb(res) {
  if (!pool) {
    res.status(503).json({
      error: 'Database not configured. Set DATABASE_URL and run db/schema.sql.'
    });
    return false;
  }

  return true;
}

function encodeRequest(request) {
  return {
    id: request.public_id || request.id,
    type: request.request_type || request.type,
    description: request.description,
    village: request.village || '',
    replyPreference:
      request.reply_preference || request.replyPreference || 'web',
    language: request.language || 'mr',
    status: request.status,
    createdAt: request.created_at || request.createdAt,
    updatedAt: request.updated_at || request.updatedAt,
    ownerName: request.owner_name || undefined
  };
}

function encodeOpportunity(opportunity) {
  return {
    id: opportunity.id,
    title: opportunity.title,
    description: opportunity.description,
    kind: opportunity.kind,
    organisation: opportunity.organisation,
    location: opportunity.location || '',
    eligibility: opportunity.eligibility || '',
    compensation: opportunity.compensation || '',
    applicationUrl: opportunity.application_url || null,
    contact: opportunity.contact || '',
    language: opportunity.language || 'mr',
    verified: opportunity.verified === true,
    published: opportunity.published === true,
    validUntil: opportunity.valid_until || null
  };
}

app.get('/api/health', async (_req, res) => {
  let database = 'not-configured';

  if (pool) {
    try {
      await pool.query('SELECT 1');
      database = 'connected';
    } catch {
      database = 'unavailable';
    }
  }

  res
    .status(database === 'unavailable' ? 503 : 200)
    .json({
      ok: database !== 'unavailable',
      database,
      product: 'Mahila KaamSetu'
    });
});

app.post('/api/assistant', rateLimit, async (req, res) => {
  const { message, language = 'mr' } = req.body || {};

  if (
    typeof message !== 'string' ||
    message.trim().length < 2 ||
    message.length > 3000
  ) {
    return res.status(400).json({
      error: 'Enter a question between 2 and 3000 characters.'
    });
  }

  if (!langs.has(language)) {
    return res.status(400).json({ error: 'Invalid language.' });
  }

  const base = (
    process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'
  ).replace(/\/$/, '');

  try {
    const response = await fetch(`${base}/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim(), language }),
      signal: AbortSignal.timeout(15000)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(503).json({
        error: 'AI assistant is temporarily unavailable.'
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json(data);
  } catch {
    res.status(503).json({
      error: 'AI assistant is not connected. Start the Python LangGraph service and check AI_SERVICE_URL.'
    });
  }
});

app.get('/api/auth/me', (req, res, next) => {
  userFor(req)
    .then((user) => res.json({ user: user ? safeUser(user) : null }))
    .catch(next);
});

app.post('/api/auth/register', rateLimit, async (req, res) => {
  if (!requireDb(res)) return;

  const {
    email,
    password,
    fullName,
    language = 'mr'
  } = req.body || {};

  if (
    typeof fullName !== 'string' ||
    fullName.trim().length < 2 ||
    fullName.trim().length > 120
  ) {
    return res.status(400).json({ error: 'Enter your full name.' });
  }

  if (
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254
  ) {
    return res.status(400).json({ error: 'Enter a valid email.' });
  }

  if (
    typeof password !== 'string' ||
    password.length < 10 ||
    password.length > 200 ||
    !/[0-9]/.test(password)
  ) {
    return res.status(400).json({
      error: 'Password must be 10+ characters and include a number.'
    });
  }

  if (!langs.has(language)) {
    return res.status(400).json({ error: 'Invalid language.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO users
       (email, full_name, password_hash, preferred_language)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, preferred_language`,
      [
        email.trim().toLowerCase(),
        fullName.trim(),
        await hashPassword(password),
        language
      ]
    );

    const token = randomBytes(32).toString('base64url');
    const days = Math.min(
      30,
      Math.max(1, Number(process.env.SESSION_DAYS || 7))
    );

    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 day'))`,
      [result.rows[0].id, digest(token), days]
    );

    await audit(
      result.rows[0].id,
      'account.created',
      'user',
      result.rows[0].id
    );

    setCookie(res, token, days * 86400);
    res.status(201).json({ user: safeUser(result.rows[0]) });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'An account with this email already exists.'
      });
    }

    console.error(error.message);
    res.status(503).json({ error: 'Could not create account.' });
  }
});

app.post('/api/auth/login', rateLimit, async (req, res) => {
  if (!requireDb(res)) return;

  const { email, password } = req.body || {};

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    password.length > 200
  ) {
    return res.status(400).json({
      error: 'Enter email and password.'
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, full_name, role, preferred_language,
              password_hash, active
       FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];

    if (
      !user ||
      !user.active ||
      !(await verifyPassword(password, user.password_hash))
    ) {
      return res.status(401).json({
        error: 'Email or password is incorrect.'
      });
    }

    const expectedRole = req.body?.expectedRole;

    if (
      expectedRole !== undefined &&
      (
        !['member', 'staff', 'admin'].includes(expectedRole) ||
        user.role !== expectedRole
      )
    ) {
      return res.status(403).json({
        error: 'This account does not have the selected access role.'
      });
    }

    const token = randomBytes(32).toString('base64url');
    const days = Math.min(
      30,
      Math.max(1, Number(process.env.SESSION_DAYS || 7))
    );

    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 day'))`,
      [user.id, digest(token), days]
    );

    await audit(user.id, 'account.login', 'user', user.id);
    setCookie(res, token, days * 86400);
    res.json({ user: safeUser(user) });
  } catch (error) {
    console.error(error.message);
    res.status(503).json({
      error: 'Sign-in service unavailable.'
    });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const token = getCookie(req);

  if (token && pool) {
    await pool
      .query('DELETE FROM sessions WHERE token_hash = $1', [digest(token)])
      .catch(() => {});
  }

  clearCookie(res);
  res.json({ ok: true });
});

app.patch('/api/auth/language', auth, async (req, res) => {
  if (!langs.has(req.body?.language)) {
    return res.status(400).json({ error: 'Invalid language.' });
  }

  await pool.query(
    'UPDATE users SET preferred_language = $1, updated_at = NOW() WHERE id = $2',
    [req.body.language, req.user.id]
  );

  res.json({ ok: true });
});

app.get('/api/requests', auth, async (req, res) => {
  if (!requireDb(res)) return;

  const staff = ['admin', 'staff'].includes(req.user.role);

  const result = staff
    ? await pool.query(
        `SELECT r.*, u.full_name AS owner_name
         FROM support_requests r
         JOIN users u ON u.id = r.user_id
         ORDER BY r.created_at DESC
         LIMIT 500`
      )
    : await pool.query(
        `SELECT * FROM support_requests
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [req.user.id]
      );

  res.json({ requests: result.rows.map(encodeRequest) });
});

app.post('/api/requests', auth, async (req, res) => {
  const {
    type,
    description,
    village = '',
    replyPreference = 'web',
    language = req.user.language || 'mr'
  } = req.body || {};

  if (!types.has(type)) {
    return res.status(400).json({
      error: 'Choose a valid request type.'
    });
  }

  if (
    typeof description !== 'string' ||
    description.trim().length < 3 ||
    description.trim().length > 3000
  ) {
    return res.status(400).json({
      error: 'Description must be 3–3000 characters.'
    });
  }

  if (
    typeof village !== 'string' ||
    village.length > 120 ||
    !replies.has(replyPreference) ||
    !langs.has(language)
  ) {
    return res.status(400).json({
      error: 'Invalid request details.'
    });
  }

  if (!requireDb(res)) return;

  try {
    const publicId = `MK-${randomUUID().slice(0, 8).toUpperCase()}`;

    const result = await pool.query(
      `INSERT INTO support_requests
       (public_id, user_id, request_type, description, village,
        reply_preference, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        publicId,
        req.user.id,
        type,
        description.trim(),
        village.trim(),
        replyPreference,
        language
      ]
    );

    await audit(
      req.user.id,
      'request.created',
      'support_request',
      publicId
    );

    res.status(201).json({
      request: encodeRequest(result.rows[0])
    });
  } catch (error) {
    console.error(error.message);
    res.status(503).json({ error: 'Could not save request.' });
  }
});

app.patch(
  '/api/requests/:id/status',
  auth,
  roles('staff', 'admin'),
  async (req, res) => {
    const { status, staffNote = '' } = req.body || {};

    if (
      !statuses.has(status) ||
      typeof staffNote !== 'string' ||
      staffNote.length > 2000
    ) {
      return res.status(400).json({
        error: 'Invalid status or note.'
      });
    }

    if (!requireDb(res)) return;

    const result = await pool.query(
      `UPDATE support_requests
       SET status = $1, staff_note = $2, updated_at = NOW()
       WHERE public_id = $3
       RETURNING *`,
      [status, staffNote.trim(), req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    await audit(
      req.user.id,
      'request.status_changed',
      'support_request',
      req.params.id,
      { status }
    );

    res.json({ request: encodeRequest(result.rows[0]) });
  }
);

app.get('/api/opportunities', async (req, res) => {
  const kind = String(req.query.kind || 'all');

  if (!['all', 'work', 'training', 'support'].includes(kind)) {
    return res.status(400).json({ error: 'Invalid type.' });
  }

  if (!pool) return res.json({ opportunities: [] });

  const result = await pool.query(
    `SELECT * FROM opportunities
     WHERE published
       AND verified
       AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
       AND ($1 = 'all' OR kind = $1)
     ORDER BY created_at DESC
     LIMIT 100`,
    [kind]
  );

  res.json({
    opportunities: result.rows.map(encodeOpportunity)
  });
});

app.post(
  '/api/opportunities',
  auth,
  roles('staff', 'admin'),
  async (req, res) => {
    if (!requireDb(res)) return;

    const body = req.body || {};

    if (
      (body.verified !== undefined && typeof body.verified !== 'boolean') ||
      (body.published !== undefined && typeof body.published !== 'boolean')
    ) {
      return res.status(400).json({
        error: 'verified and published must be boolean values.'
      });
    }

    if (
      req.user.role !== 'admin' &&
      (body.verified === true || body.published === true)
    ) {
      return res.status(403).json({
        error: 'Only an administrator can verify or publish an opportunity.'
      });
    }

    if (
      typeof body.title !== 'string' ||
      body.title.trim().length < 3 ||
      body.title.length > 180 ||
      typeof body.description !== 'string' ||
      body.description.trim().length < 3 ||
      body.description.length > 3000 ||
      !['training', 'work', 'support'].includes(body.kind) ||
      typeof body.organisation !== 'string' ||
      body.organisation.trim().length < 2
    ) {
      return res.status(400).json({
        error: 'Invalid opportunity details.'
      });
    }

    if (
      body.applicationUrl !== undefined &&
      body.applicationUrl !== null &&
      body.applicationUrl !== '' &&
      (
        typeof body.applicationUrl !== 'string' ||
        !/^https:\/\//i.test(body.applicationUrl)
      )
    ) {
      return res.status(400).json({
        error: 'Application links must use HTTPS.'
      });
    }

    for (const key of ['location', 'eligibility', 'compensation', 'contact']) {
      if (body[key] !== undefined && typeof body[key] !== 'string') {
        return res.status(400).json({
          error: `${key} must be text.`
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO opportunities
       (title, description, kind, organisation, location, eligibility,
        compensation, application_url, contact, language, verified,
        published, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        body.title.trim(),
        body.description.trim(),
        body.kind,
        body.organisation.trim(),
        String(body.location || '').slice(0, 180),
        String(body.eligibility || '').slice(0, 1000),
        String(body.compensation || '').slice(0, 180),
        body.applicationUrl || null,
        String(body.contact || '').slice(0, 180),
        langs.has(body.language) ? body.language : 'mr',
        body.verified === true,
        body.published === true,
        req.user.id
      ]
    );

    await audit(
      req.user.id,
      'opportunity.created',
      'opportunity',
      result.rows[0].id
    );

    res.status(201).json({
      opportunity: encodeOpportunity(result.rows[0])
    });
  }
);

app.patch(
  '/api/opportunities/:id',
  auth,
  roles('admin'),
  async (req, res) => {
    if (!requireDb(res)) return;

    const { published, verified } = req.body || {};

    if (
      typeof published !== 'boolean' &&
      typeof verified !== 'boolean'
    ) {
      return res.status(400).json({
        error: 'No changes supplied.'
      });
    }

    const result = await pool.query(
      `UPDATE opportunities
       SET published = COALESCE($1, published),
           verified = COALESCE($2, verified),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [
        typeof published === 'boolean' ? published : null,
        typeof verified === 'boolean' ? verified : null,
        req.params.id
      ]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        error: 'Opportunity not found.'
      });
    }

    await audit(
      req.user.id,
      'opportunity.updated',
      'opportunity',
      req.params.id,
      { published, verified }
    );

    res.json({ opportunity: encodeOpportunity(result.rows[0]) });
  }
);

function encryptionKey() {
  const key = process.env.DOCUMENT_ENCRYPTION_KEY || '';

  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error(
      'DOCUMENT_ENCRYPTION_KEY must be 64 hex characters.'
    );
  }

  return Buffer.from(key, 'hex');
}

function encrypt(buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([
    cipher.update(buffer),
    cipher.final()
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}

function decrypt(buffer) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    buffer.subarray(0, 12)
  );

  decipher.setAuthTag(buffer.subarray(12, 28));

  return Buffer.concat([
    decipher.update(buffer.subarray(28)),
    decipher.final()
  ]);
}

app.get('/api/documents', auth, async (req, res) => {
  if (!requireDb(res)) return;

  const result = await pool.query(
    `SELECT id,
            original_name AS "originalName",
            mime_type AS "mimeType",
            byte_size AS "byteSize",
            created_at AS "createdAt"
     FROM documents
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [req.user.id]
  );

  res.json({ documents: result.rows });
});

app.post('/api/documents', auth, async (req, res) => {
  if (!requireDb(res)) return;

  const { name, mimeType, contentBase64 } = req.body || {};

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 180 ||
    /[\\/]/.test(name) ||
    !['application/pdf', 'image/jpeg', 'image/png'].includes(mimeType) ||
    typeof contentBase64 !== 'string' ||
    contentBase64.length > 4_200_000 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(contentBase64)
  ) {
    return res.status(400).json({
      error: 'Invalid document or file type.'
    });
  }

  const buffer = Buffer.from(contentBase64, 'base64');

  if (!buffer.length || buffer.length > 3 * 1024 * 1024) {
    return res.status(413).json({
      error: 'Files must be 3 MB or smaller.'
    });
  }

  const validSignature =
    mimeType === 'application/pdf'
      ? buffer.subarray(0, 5).toString() === '%PDF-'
      : mimeType === 'image/png'
        ? buffer.subarray(0, 8).equals(
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
          )
        : buffer[0] === 0xff &&
          buffer[1] === 0xd8 &&
          buffer[2] === 0xff;

  if (!validSignature) {
    return res.status(400).json({
      error: 'File contents do not match the selected file type.'
    });
  }

  try {
    const encrypted = encrypt(buffer);

    const result = await pool.query(
      `INSERT INTO documents
       (user_id, original_name, mime_type, byte_size, encrypted_content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id,
                 original_name AS "originalName",
                 mime_type AS "mimeType",
                 byte_size AS "byteSize",
                 created_at AS "createdAt"`,
      [
        req.user.id,
        name.trim(),
        mimeType,
        buffer.length,
        encrypted
      ]
    );

    await audit(
      req.user.id,
      'document.uploaded',
      'document',
      result.rows[0].id
    );

    res.status(201).json({ document: result.rows[0] });
  } catch (error) {
    console.error(error.message);

    res.status(503).json({
      error: error.message.includes('DOCUMENT_ENCRYPTION_KEY')
        ? 'Secure document storage is not configured.'
        : 'Could not save document.'
    });
  }
});

app.get('/api/documents/:id/download', auth, async (req, res) => {
  if (!requireDb(res)) return;

  const result = await pool.query(
    'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );

  if (!result.rowCount) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  try {
    const data = decrypt(result.rows[0].encrypted_content);

    await audit(
      req.user.id,
      'document.downloaded',
      'document',
      req.params.id
    );

    res.setHeader('Content-Type', result.rows[0].mime_type);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(result.rows[0].original_name)}`
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Could not decrypt document.' });
  }
});

app.delete('/api/documents/:id', auth, async (req, res) => {
  if (!requireDb(res)) return;

  const result = await pool.query(
    'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );

  if (!result.rowCount) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  await audit(
    req.user.id,
    'document.deleted',
    'document',
    req.params.id
  );

  res.json({ ok: true });
});

app.get(
  '/api/admin/summary',
  auth,
  roles('staff', 'admin'),
  async (_req, res) => {
    if (!requireDb(res)) return;

    const [users, requests, opportunities, audits] = await Promise.all([
      pool.query('SELECT COUNT(*)::int n FROM users'),
      pool.query(
        `SELECT COUNT(*)::int n,
                COUNT(*) FILTER (
                  WHERE status NOT IN ('completed', 'rejected')
                )::int open
         FROM support_requests`
      ),
      pool.query('SELECT COUNT(*)::int n FROM opportunities'),
      pool.query(
        `SELECT a.id, a.action, a.entity_type "entityType",
                a.entity_id "entityId", a.created_at "createdAt",
                u.email actor
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_user_id
         ORDER BY a.created_at DESC
         LIMIT 50`
      )
    ]);

    res.json({
      users: users.rows[0].n,
      requests: requests.rows[0].n,
      openRequests: requests.rows[0].open,
      opportunities: opportunities.rows[0].n,
      audits: audits.rows
    });
  }
);

/* Staff-to-administrator messaging.
   Staff can only read their own messages.
   Administrators can read all messages and respond. */

function encodeStaffMessage(message) {
  return {
    id: message.id,
    subject: message.subject,
    message: message.message,
    status: message.status,
    adminReply: message.admin_reply || '',
    createdAt: message.created_at,
    updatedAt: message.updated_at,
    respondedAt: message.responded_at,
    staffName: message.staff_name || '',
    staffEmail: message.staff_email || ''
  };
}

app.get(
  '/api/staff/messages',
  auth,
  roles('staff'),
  async (req, res) => {
    if (!requireDb(res)) return;

    try {
      const result = await pool.query(
        `SELECT *
         FROM staff_admin_messages
         WHERE staff_user_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [req.user.id]
      );

      res.json({
        messages: result.rows.map(encodeStaffMessage)
      });
    } catch (error) {
      console.error(error.message);

      res.status(503).json({
        error: 'Could not load your messages. Ensure the latest database schema is applied.'
      });
    }
  }
);

app.post(
  '/api/staff/messages',
  auth,
  roles('staff'),
  async (req, res) => {
    if (!requireDb(res)) return;

    const { subject, message } = req.body || {};

    if (
      typeof subject !== 'string' ||
      subject.trim().length < 3 ||
      subject.trim().length > 160 ||
      typeof message !== 'string' ||
      message.trim().length < 3 ||
      message.trim().length > 3000
    ) {
      return res.status(400).json({
        error: 'Subject must be 3–160 characters and message 3–3000 characters.'
      });
    }

    try {
      const result = await pool.query(
        `INSERT INTO staff_admin_messages
         (staff_user_id, subject, message)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [req.user.id, subject.trim(), message.trim()]
      );

      await audit(
        req.user.id,
        'staff_admin_message.created',
        'staff_admin_message',
        result.rows[0].id
      );

      res.status(201).json({
        message: encodeStaffMessage(result.rows[0])
      });
    } catch (error) {
      console.error(error.message);

      res.status(503).json({
        error: 'Could not send your message. Ensure the latest database schema is applied.'
      });
    }
  }
);

app.get(
  '/api/admin/staff-messages',
  auth,
  roles('admin'),
  async (_req, res) => {
    if (!requireDb(res)) return;

    try {
      const result = await pool.query(
        `SELECT m.*,
                u.full_name AS staff_name,
                u.email AS staff_email
         FROM staff_admin_messages m
         JOIN users u ON u.id = m.staff_user_id
         ORDER BY
           CASE WHEN m.status = 'open' THEN 0 ELSE 1 END,
           m.created_at DESC
         LIMIT 500`
      );

      res.json({
        messages: result.rows.map(encodeStaffMessage)
      });
    } catch (error) {
      console.error(error.message);

      res.status(503).json({
        error: 'Could not load staff messages. Ensure the latest database schema is applied.'
      });
    }
  }
);

app.patch(
  '/api/admin/staff-messages/:id/reply',
  auth,
  roles('admin'),
  async (req, res) => {
    if (!requireDb(res)) return;

    const { reply, status = 'answered' } = req.body || {};

    if (
      typeof reply !== 'string' ||
      reply.trim().length < 2 ||
      reply.trim().length > 3000 ||
      !['answered', 'closed'].includes(status)
    ) {
      return res.status(400).json({
        error: 'Reply must be 2–3000 characters and status must be answered or closed.'
      });
    }

    try {
      const result = await pool.query(
        `UPDATE staff_admin_messages
         SET admin_reply = $1,
             status = $2,
             responded_by = $3,
             responded_at = NOW(),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [reply.trim(), status, req.user.id, req.params.id]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          error: 'Staff message not found.'
        });
      }

      await audit(
        req.user.id,
        'staff_admin_message.replied',
        'staff_admin_message',
        req.params.id,
        { status }
      );

      const joined = await pool.query(
        `SELECT m.*,
                u.full_name AS staff_name,
                u.email AS staff_email
         FROM staff_admin_messages m
         JOIN users u ON u.id = m.staff_user_id
         WHERE m.id = $1`,
        [req.params.id]
      );

      res.json({
        message: encodeStaffMessage(joined.rows[0])
      });
    } catch (error) {
      console.error(error.message);

      res.status(503).json({
        error: 'Could not save the administrator response.'
      });
    }
  }
);

app.get(
  '/api/admin/users',
  auth,
  roles('admin'),
  async (_req, res) => {
    if (!requireDb(res)) return;

    const result = await pool.query(
      `SELECT id, email, full_name, role, preferred_language,
              active, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 500`
    );

    res.json({ users: result.rows.map(safeUser) });
  }
);

app.patch(
  '/api/admin/users/:id',
  auth,
  roles('admin'),
  async (req, res) => {
    if (!requireDb(res)) return;

    const { role: nextRole, active } = req.body || {};

    if (
      (
        nextRole !== undefined &&
        !['member', 'staff', 'admin'].includes(nextRole)
      ) ||
      (active !== undefined && typeof active !== 'boolean')
    ) {
      return res.status(400).json({
        error: 'Invalid role or active value.'
      });
    }

    if (
      Number(req.params.id) === Number(req.user.id) &&
      (
        (nextRole && nextRole !== 'admin') ||
        active === false
      )
    ) {
      return res.status(400).json({
        error: 'You cannot disable your own admin account.'
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET role = COALESCE($1, role),
           active = COALESCE($2, active),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, full_name, role, preferred_language, active`,
      [nextRole ?? null, active ?? null, req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (active === false) {
      await pool.query(
        'DELETE FROM sessions WHERE user_id = $1',
        [req.params.id]
      );
    }

    await audit(
      req.user.id,
      'user.updated',
      'user',
      req.params.id,
      { role: nextRole, active }
    );

    res.json({ user: safeUser(result.rows[0]) });
  }
);

app.get(
  '/api/admin/audit',
  auth,
  roles('admin'),
  async (_req, res) => {
    if (!requireDb(res)) return;

    const result = await pool.query(
      `SELECT a.id, a.action, a.entity_type "entityType",
              a.entity_id "entityId", a.metadata,
              a.created_at "createdAt", u.email actor
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_user_id
       ORDER BY a.created_at DESC
       LIMIT 500`
    );

    res.json({ logs: result.rows });
  }
);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});

app.use((error, _req, res, _next) => {
  console.error('API error:', error.message);

  if (!res.headersSent) {
    res.status(error.status === 413 ? 413 : 500).json({
      error:
        error.status === 413
          ? 'Request is too large.'
          : 'Unexpected server error.'
    });
  }
});

export default app;